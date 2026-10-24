// the live engine: one loop per active match, owned by the server (the only authority).
// real live game: tick every 5 s on the cached api (10 s ttl). demo replay: tick every 1 s on
// a finished game replayed at DEMO_REPLAY_SPEED. each tick: lock, cancel or resolve calls,
// maybe open the next one, re-render on changes, and broadcast to "match:{id}"
import { parseMatchId, type LiigaGame } from "@/features/liiga";
import { getGame, getGamesOn, helsinkiDate, liigaNow } from "@/features/liiga/server";
import { getDb, type DbCall } from "@/shared/db";
import type { LiveCall, LiveStakes, LiveState, MatchEvent, RoomLeaderboardRow, Score } from "@/shared/types";
import { wordCall } from "../engine/phrases";
import { gameAt, nextMomentAfter, replayEnd, replayTime, type ReplayClock } from "../engine/replay";
import { decidedInWindow, nextCall, resolve, type CallDraft, type ResolveRule } from "../engine/rules";
import { publish, type MatchEvent as Broadcast } from "./realtime";

export interface RenderedMatch {
  stakes: LiveStakes;
  /** newest first */
  events: MatchEvent[];
  periodScores: (Score | null)[];
}

/** the site server turns a game state into ui pieces; the engine stays free of ui code */
export interface MatchRenderer {
  /** on a goal, penalty, period or status change */
  render(matchId: string, game: LiigaGame, names: Map<number, string>): Promise<RenderedMatch>;
  /** every tick: "2nd period", "14:26" */
  clock(game: LiigaGame): { label: string; clock: string };
  stakesLine(matchId: string, game: LiigaGame, draft: CallDraft): Promise<string | null>;
  leaderboard(matchId: string): Promise<{ rows: RoomLeaderboardRow[]; watching: number }>;
}

let renderer: MatchRenderer | null = null;
const ANSWER_MS = Number(process.env.CALL_ANSWER_SECONDS ?? 20) * 1000;
export const CALL_POINTS = 20;

type Message = { event: Broadcast; payload: Record<string, unknown> };

const splitOf = (options: { id: string }[], answers: { optionId: string }[]) =>
  Object.fromEntries(options.map((o) => [o.id, answers.length ? Math.round((100 * answers.filter((a) => a.optionId === o.id).length) / answers.length) : 0]));

class MatchLoop {
  private timer: ReturnType<typeof setInterval> | null = null;
  private busy = false;
  private forceAgain = false;
  private calls: DbCall[] = [];
  private splits = new Map<string, Record<string, number>>();
  private seenEvents = new Set<string>();
  private lastOpenedAt: number | null = null;
  private rendered: RenderedMatch | null = null;
  private board: { rows: RoomLeaderboardRow[]; watching: number } = { rows: [], watching: 0 };
  visible: LiigaGame | null = null;
  state: LiveState | null = null;
  /** a replay can run many times: the match leaderboard counts points from this run on */
  runSince = new Date().toISOString();

  constructor(
    readonly matchId: string,
    readonly kind: "live" | "replay",
    public names: Map<number, string>,
    private full: LiigaGame | null = null,
    readonly clock: ReplayClock = { startedAt: null, pausedAt: null, offset: 0, speed: 1 },
  ) {
    this.baseSpeed = clock.speed;
  }

  private baseSpeed: number;

  /**
   * a replay runs at 1x while a call takes answers: 20 s to answer is then 20 s of game time, as
   * in a live game. at 15x it would be 5 minutes, and a power play would be over before the lock
   */
  private setSpeed(speed: number, now: number) {
    const c = this.clock;
    if (this.kind !== "replay" || c.speed === speed) return;
    const t = replayTime(c, now);
    Object.assign(c, { offset: t, startedAt: c.startedAt === null ? null : now, pausedAt: c.pausedAt ? now : null, speed });
  }

  async start() {
    const db = getDb();
    const stored = await db.calls.listForMatch(this.matchId);
    for (const c of stored.filter((x) => x.status === "open" || x.status === "locked")) {
      // a replay starts over; a live game keeps calls that were locked before a restart
      if (this.kind === "replay" || c.status === "open") await db.calls.update(c.id, { status: "cancelled", resolvedAt: new Date().toISOString() });
    }
    // a live game remembers its calls (no trigger fires twice after a restart); a replay starts clean
    this.calls = this.kind === "live" ? await db.calls.listForMatch(this.matchId) : [];
    this.lastOpenedAt = this.calls.length ? Math.max(...this.calls.map((c) => c.openedGameTime)) : null;
    this.timer = setInterval(() => void this.tick(), this.kind === "replay" ? 1000 : 5000);
    await this.tick();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  get replayClockSeconds() {
    return replayTime(this.clock, Date.now());
  }

  private async currentGame(): Promise<LiigaGame | null> {
    if (this.kind === "replay" && this.full) return gameAt(this.full, replayTime(this.clock, Date.now()));
    const ids = parseMatchId(this.matchId);
    if (!ids) return null;
    const res = await getGame(ids.season, ids.gameId).catch(() => null);
    if (res) this.names = res.data.names;
    return res?.data.game ?? null;
  }

  async tick(force = false) {
    if (!renderer) return;
    if (this.busy) {
      // a host action during a tick still gets its forced re-render, right after
      if (force) this.forceAgain = true;
      return;
    }
    this.busy = true;
    try {
      const now = Date.now();
      const game = await this.currentGame();
      if (!game) return;
      const prev = this.visible;
      this.visible = game;
      const changed =
        force ||
        !prev ||
        prev.status !== game.status ||
        prev.goals.length !== game.goals.length ||
        prev.penalties.length !== game.penalties.length ||
        prev.currentPeriod !== game.currentPeriod;
      const messages: Message[] = [];

      await this.updateCalls(game, now, messages);
      this.setSpeed(this.calls.some((c) => c.status === "open") ? 1 : this.baseSpeed, now);

      if (changed || !this.rendered) {
        const scoreChanged = !prev || prev.goals.length !== game.goals.length || prev.status !== game.status;
        this.rendered = await renderer.render(this.matchId, game, this.names);
        if (scoreChanged || force) messages.push({ event: "stakes", payload: { ...this.rendered.stakes, serverNow: now } });
      }
      const fresh = this.rendered.events.filter((e) => !this.seenEvents.has(e.id));
      for (const e of fresh) this.seenEvents.add(e.id);
      if (!this.board.rows.length || changed) this.board = await renderer.leaderboard(this.matchId);

      this.state = this.buildState(game, now);
      messages.push({
        event: "state",
        payload: {
          serverNow: now,
          isReplay: this.kind === "replay",
          status: this.state.status,
          clock: this.state.clock,
          score: this.state.score,
          periodScores: this.state.periodScores,
          events: fresh,
        },
      });
      if (game.status === "final" && prev && prev.status !== "final") {
        messages.push({ event: "game_end", payload: { score: this.state.score, decidedIn: game.decidedIn, serverNow: now } });
      }
      await publish(this.matchId, messages);
      if (this.kind === "live" && game.status === "final") {
        this.stop();
        loops.delete(this.matchId);
      }
    } catch (err) {
      console.error(`live: tick failed for ${this.matchId}: ${(err as Error).message}`);
    } finally {
      this.busy = false;
      if (this.forceAgain) {
        this.forceAgain = false;
        void this.tick(true);
      }
    }
  }

  private async updateCalls(game: LiigaGame, now: number, messages: Message[]) {
    const db = getDb();
    for (const c of this.calls) {
      const rule = c.resolvesRule as ResolveRule;
      if (c.status === "open" && now >= Date.parse(c.locksAt)) {
        const answers = await db.answers.listForCall(c.id);
        const split = splitOf(c.options, answers);
        this.splits.set(c.id, split);
        Object.assign(c, await db.calls.update(c.id, { status: "locked", lockGameTime: game.gameTime }));
        messages.push({ event: "call_locked", payload: { callId: c.id, split, serverNow: now } });
      }
      if (c.status !== "open" && c.status !== "locked") continue;
      const windowEnd = c.status === "open" ? game.gameTime : (c.lockGameTime ?? game.gameTime);
      if (decidedInWindow(rule, game, c.openedGameTime, windowEnd)) {
        Object.assign(c, await db.calls.update(c.id, { status: "cancelled", resolvedAt: new Date(now).toISOString() }));
        messages.push({ event: "call_cancelled", payload: { callId: c.id, reason: "decided while answers were open", serverNow: now } });
        continue;
      }
      if (c.status !== "locked") continue;
      const correct = resolve(rule, game, c.lockGameTime ?? game.gameTime);
      if (!correct) continue;
      Object.assign(c, await db.calls.update(c.id, { status: "resolved", correctOptionId: correct, resolvedAt: new Date(now).toISOString() }));
      await db.answers.setCorrect(c.id, correct);
      const answers = await db.answers.listForCall(c.id);
      // our clock, not the db's: runSince is compared against it
      const createdAt = new Date(now).toISOString();
      await Promise.all(
        answers
          .filter((x) => x.optionId === correct)
          .map((a) => db.points.award({ userId: a.userId, matchId: this.matchId, callId: c.id, points: CALL_POINTS, reason: `call: ${c.question}`, createdAt })),
      );
      const split = this.splits.get(c.id) ?? splitOf(c.options, answers);
      messages.push({ event: "call_resolved", payload: { callId: c.id, correctOptionId: correct, split, serverNow: now } });
      this.board = await renderer!.leaderboard(this.matchId);
      messages.push({ event: "leaderboard", payload: { leaderboard: this.board.rows, watching: this.board.watching } });
    }

    const draft = nextCall(game, {
      lastOpenedAt: this.lastOpenedAt,
      hasOpenCall: this.calls.some((c) => c.status === "open"),
      used: new Set(this.calls.map((c) => c.trigger)),
    });
    if (!draft) return;
    const approved = await db.phrases.listApproved(draft.kind, "en").catch(() => []);
    const call = await db.calls.create({
      matchId: this.matchId,
      type: draft.kind,
      trigger: draft.trigger,
      question: wordCall(draft.kind, draft.vars, approved),
      options: draft.options,
      stakesLine: await renderer!.stakesLine(this.matchId, game, draft).catch(() => null),
      openedGameTime: game.gameTime,
      openedAt: new Date(now).toISOString(),
      locksAt: new Date(now + ANSWER_MS).toISOString(),
      lockGameTime: null,
      resolvesRule: draft.rule as unknown as Record<string, unknown>,
      status: "open",
      correctOptionId: null,
      resolvedAt: null,
    });
    this.calls.push(call);
    this.lastOpenedAt = game.gameTime;
    messages.push({ event: "call_open", payload: { call: this.toLive(call), serverNow: now } });
  }

  /** a call as fans may see it: the answer only once resolved, the split once locked */
  toLive(c: DbCall): LiveCall {
    return {
      id: c.id,
      type: c.type,
      question: c.question,
      options: c.options,
      stakesLine: c.stakesLine,
      points: CALL_POINTS,
      status: c.status,
      openedAt: Date.parse(c.openedAt),
      locksAt: Date.parse(c.locksAt),
      split: c.status === "open" ? null : (this.splits.get(c.id) ?? null),
      correctOptionId: c.status === "resolved" ? c.correctOptionId : null,
      reason: c.status === "cancelled" ? "decided while answers were open" : null,
    };
  }

  private buildState(game: LiigaGame, now: number): LiveState {
    const r = this.rendered!;
    const clock = renderer!.clock(game);
    const newestFirst = [...this.calls].reverse();
    const current = newestFirst.find((c) => c.status === "open" || c.status === "locked") ?? null;
    const last = newestFirst.find((c) => c.status === "resolved" || c.status === "cancelled") ?? null;
    return {
      matchId: this.matchId,
      serverNow: now,
      isReplay: this.kind === "replay",
      status: game.status === "final" ? "final" : game.status === "live" ? "live" : "scheduled",
      clock: { period: game.currentPeriod ?? 0, gameTime: game.gameTime, ...clock },
      score: { home: game.home.goals, away: game.away.goals },
      periodScores: r.periodScores,
      events: r.events,
      stakes: r.stakes,
      call: current ? this.toLive(current) : null,
      lastCall: last ? this.toLive(last) : null,
      leaderboard: this.board.rows,
      watching: this.board.watching,
      me: null,
    };
  }

  /** host controls for the demo replay */
  async control(action: string): Promise<string | null> {
    const now = Date.now();
    const c = this.clock;
    const t = replayTime(c, now);
    switch (action) {
      case "start":
        // puck drop: the clock starts at 0:01, so the game is live (and the first call open) at once
        if (c.startedAt === null) Object.assign(c, { startedAt: now, pausedAt: null, offset: Math.max(1, c.offset) });
        else if (c.pausedAt) Object.assign(c, { startedAt: now, pausedAt: null, offset: t });
        break;
      case "pause":
        if (c.startedAt !== null && !c.pausedAt) Object.assign(c, { offset: t, startedAt: now, pausedAt: now });
        break;
      case "resume":
        if (c.startedAt !== null) Object.assign(c, { startedAt: now, pausedAt: null, offset: t });
        break;
      case "skip": {
        const next = this.full ? nextMomentAfter(this.full, t) : null;
        Object.assign(c, { offset: next !== null ? next + 1 : t, startedAt: now, pausedAt: c.pausedAt ? now : null });
        break;
      }
      case "reset": {
        const db = getDb();
        for (const call of this.calls.filter((x) => x.status === "open" || x.status === "locked")) {
          await db.calls.update(call.id, { status: "cancelled", resolvedAt: new Date(now).toISOString() });
        }
        Object.assign(c, { startedAt: null, pausedAt: null, offset: 0, speed: this.baseSpeed });
        this.runSince = new Date(now).toISOString();
        this.calls = [];
        this.splits.clear();
        this.seenEvents.clear();
        this.lastOpenedAt = null;
        this.visible = null;
        break;
      }
      default:
        return `unknown action "${action}"`;
    }
    await this.tick(true);
    return null;
  }

  /** true once the replayed game is over */
  get replayDone() {
    return this.full ? replayTime(this.clock, Date.now()) >= replayEnd(this.full) : false;
  }
}

const loops = new Map<string, MatchLoop>();

async function startReplay(matchId: string, speed: number, autostart: boolean) {
  const ids = parseMatchId(matchId);
  if (!ids) return console.warn(`live: DEMO_REPLAY_MATCH_ID "${matchId}" is not a match id like 2027-2701404`);
  const res = await getGame(ids.season, ids.gameId).catch(() => null);
  if (!res || res.data.game.status !== "final") return console.warn(`live: demo replay needs a finished game, ${matchId} is ${res?.data.game.status ?? "missing"}`);
  const loop = new MatchLoop(matchId, "replay", res.data.names, res.data.game, { startedAt: autostart ? Date.now() : null, pausedAt: null, offset: 0, speed });
  loops.set(matchId, loop);
  await loop.start();
  console.log(`live: demo replay of ${matchId} (${res.data.game.home.name}–${res.data.game.away.name}) at ${speed}x, ${autostart ? "running" : "waiting for host start"}`);
}

/** a loop for a real game that is live now (idempotent) */
export async function ensureLiveLoop(matchId: string, game?: LiigaGame) {
  if (loops.has(matchId) || game?.status !== "live") return;
  const loop = new MatchLoop(matchId, "live", new Map());
  loops.set(matchId, loop);
  await loop.start();
  console.log(`live: following ${matchId} (${game.home.name}–${game.away.name})`);
}

async function discoverLiveGames() {
  const today = await getGamesOn(helsinkiDate(liigaNow())).catch(() => null);
  for (const g of today?.data ?? []) if (g.status === "live") await ensureLiveLoop(g.id, g);
}

export async function startEngine(r: MatchRenderer) {
  renderer = r;
  const demo = process.env.DEMO_REPLAY_MATCH_ID;
  if (demo) await startReplay(demo, Number(process.env.DEMO_REPLAY_SPEED ?? 15), process.env.DEMO_REPLAY_AUTOSTART === "true");
  await discoverLiveGames();
  setInterval(() => void discoverLiveGames(), 60_000).unref();
}

export interface EngineMatch {
  state: LiveState | null;
  visible: LiigaGame | null;
  isReplay: boolean;
  names: Map<number, string>;
}

/** the engine's view of a match, when it runs one */
export function engineMatch(matchId: string): EngineMatch | null {
  const loop = loops.get(matchId);
  if (!loop) return null;
  return { state: loop.state, visible: loop.visible, isReplay: loop.kind === "replay", names: loop.names };
}

/** where a match's points and calls start counting: the current replay run, else the beginning */
export function matchSince(matchId: string): string {
  const loop = loops.get(matchId);
  return loop?.kind === "replay" ? loop.runSince : new Date(0).toISOString();
}

/** the visible state of every demo replay, for the home page */
export function activeReplays(): { matchId: string; visible: LiigaGame; openCalls: number }[] {
  return [...loops.values()]
    .filter((l) => l.kind === "replay" && l.visible)
    .map((l) => ({ matchId: l.matchId, visible: l.visible!, openCalls: l.state?.call?.status === "open" ? 1 : 0 }));
}

/** host control of the demo replay; null when done, else an error message */
export async function controlReplay(matchId: string, action: string): Promise<string | null> {
  const loop = loops.get(matchId);
  if (!loop || loop.kind !== "replay") return "no demo replay runs for this match (set DEMO_REPLAY_MATCH_ID)";
  return loop.control(action);
}
