// the live engine: one loop per active match, owned by the server (the only authority).
// real live game: tick every 5 s on the cached api (10 s ttl). demo replay (DEMO_REPLAY_MATCH_ID):
// tick every 1 s on a finished game replayed at DEMO_REPLAY_SPEED. demo rotation (DEMO_MODE):
// tick every 0.5 s; the game follows its highlight video and calls are planned ahead from the cues.
// each tick: lock, cancel or resolve calls, maybe open the next one, re-render on changes,
// and broadcast to "match:{id}"
import { parseMatchId, unplayedGame, type LiigaGame } from "@/features/liiga";
import { getGame, getGamesOn, helsinkiDate, liigaNow } from "@/features/liiga/server";
import { demoMode } from "@/shared/clock";
import { getDb, type DbCall } from "@/shared/db";
import type { RotationMatchConfig } from "@/shared/demo";
import type { LiveCall, LiveRotation, LiveStakes, LiveState, MatchEvent, RoomLeaderboardRow, Score } from "@/shared/types";
import { optionsFi, wordCall } from "../engine/phrases";
import { gameAt, nextMomentAfter, replayEnd, replayTime, type ReplayClock } from "../engine/replay";
import { gameAtVideo, goalVideoTimes, planCalls, type PlannedCall } from "../engine/rotation";
import { decidedInWindow, nextCall, resolve, whoWinsDraft, type CallDraft, type ResolveRule } from "../engine/rules";
import { publish, type MatchEvent as Broadcast } from "./realtime";
import { initRotation, isRotationMatch, phaseOf, rotationConfig, rotationMatch, rotationNow } from "./rotation";

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
/** a planned call more than this late (a restart mid-highlight) is skipped, not opened late */
const PLAN_LATE_MS = 2000;

type Message = { event: Broadcast; payload: Record<string, unknown> };
type Kind = "live" | "replay" | "rotation";

/** one in-app notification per fan who answered and wants them (bots never get one), in one insert */
async function notifyResults(matchId: string, c: DbCall, correct: string, answers: { userId: string; optionId: string }[]) {
  const db = getDb();
  const wants = new Set((await db.users.getMany([...new Set(answers.map((a) => a.userId))])).filter((u) => !u.isBot && u.notificationPrefs.callResults).map((u) => u.id));
  const answer = c.options.find((o) => o.id === correct)?.label ?? correct;
  await db.notifications.create(
    answers
      .filter((a) => wants.has(a.userId))
      .map((a) => {
        const won = a.optionId === correct;
        return {
          userId: a.userId,
          type: "call_result",
          title: won ? `You got it! +${CALL_POINTS} pts` : "Not this time",
          body: won ? `${c.question} ${answer}.` : `${c.question} The answer was ${answer}.`,
          link: `/match/${matchId}`,
          dedupeKey: `call:${c.id}:${a.userId}`,
        };
      }),
  );
}

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
  // rotation only: the calls planned from the cues, the next one, and the cycle they belong to
  private plan: PlannedCall[] = [];
  private planIndex = 0;
  private cycle: string | null = null;
  private lastPublishedAt = 0;
  private rotation: LiveRotation | null = null;
  visible: LiigaGame | null = null;
  state: LiveState | null = null;
  /** a replay can run many times: the match leaderboard counts points from this run on */
  runSince = new Date().toISOString();

  constructor(
    readonly matchId: string,
    readonly kind: Kind,
    public names: Map<number, string>,
    private full: LiigaGame | null = null,
    readonly clock: ReplayClock = { startedAt: null, pausedAt: null, offset: 0, speed: 1 },
    private rot: RotationMatchConfig | null = null,
  ) {
    this.baseSpeed = clock.speed;
    if (rot && full) this.plan = planCalls(full, rot.cues, rot.durationSec, { answerSeconds: ANSWER_MS / 1000 });
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
      // a replay or rotation starts over; a live game keeps calls that were locked before a restart
      if (this.kind !== "live" || c.status === "open") await db.calls.update(c.id, { status: "cancelled", resolvedAt: new Date().toISOString() });
    }
    // a live game remembers its calls (no trigger fires twice after a restart); a replay starts clean
    this.calls = this.kind === "live" ? await db.calls.listForMatch(this.matchId) : [];
    this.lastOpenedAt = this.calls.length ? Math.max(...this.calls.map((c) => c.openedGameTime)) : null;
    this.timer = setInterval(() => void this.tick(), this.kind === "live" ? 5000 : this.kind === "replay" ? 1000 : 500);
    await this.tick();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** the rotation's view of this match right now, and the game as it stands in it */
  private rotationGame(now: number): LiigaGame | null {
    const p = phaseOf(this.matchId, now);
    if (!p || !this.full || !this.rot) return null;
    const { phase, slot, r } = p;
    // a new cycle: everything about the last one (calls, splits, seen events) starts over
    if (this.cycle !== r.cycleKey) {
      this.cycle = r.cycleKey;
      this.calls = [];
      this.splits.clear();
      this.seenEvents.clear();
      this.planIndex = 0;
      this.rendered = null;
      this.board = { rows: [], watching: 0 };
    }
    const next = rotationMatch(r.next.matchId);
    // r.at is now, or the moment of the pause: a paused highlight stays on its second
    const videoSec = phase === "live" ? Math.max(0, (r.at - slot.liveAt) / 1000) : null;
    this.rotation = {
      phase,
      phaseEndsAt: phase === "idle" ? slot.lobbyAt : r.phaseEnd,
      liveStartedAt: slot.liveAt,
      videoSec,
      durationSec: this.rot.durationSec,
      paused: r.paused,
      next: next ? { matchId: next.matchId, title: next.title, startsAt: r.next.lobbyAt } : null,
    };
    // idle and lobby: a game not played yet; live: where the highlight is; summary: the result
    if (phase === "idle" || phase === "lobby") return unplayedGame(this.full);
    if (phase === "summary") return gameAt(this.full, replayEnd(this.full));
    return gameAtVideo(this.full, this.rot.cues, this.rot.durationSec, videoSec ?? 0);
  }

  private async currentGame(now: number): Promise<LiigaGame | null> {
    if (this.kind === "rotation") return this.rotationGame(now);
    if (this.kind === "replay" && this.full) return gameAt(this.full, replayTime(this.clock, now));
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
      const game = await this.currentGame(now);
      if (!game) return;
      const prev = this.visible;
      const prevPhase = this.state?.rotation?.phase;
      this.visible = game;
      const changed =
        force ||
        !prev ||
        !this.rendered ||
        prev.status !== game.status ||
        prev.goals.length !== game.goals.length ||
        prev.penalties.length !== game.penalties.length ||
        prev.currentPeriod !== game.currentPeriod ||
        prevPhase !== this.rotation?.phase;
      const messages: Message[] = [];

      await this.settleCalls(game, now, messages);
      if (this.kind === "rotation") await this.openRotationCalls(game, now, messages);
      else await this.openNextCall(game, now, messages);
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
      // a rotation match nobody is watching (idle) only says so when something changes
      const quiet = this.kind === "rotation" && this.rotation?.phase === "idle" && !changed && !messages.length && now - this.lastPublishedAt < 15_000;
      if (!quiet) {
        messages.push({
          event: "state",
          payload: {
            serverNow: now,
            isReplay: this.kind !== "live",
            status: this.state.status,
            clock: this.state.clock,
            score: this.state.score,
            periodScores: this.state.periodScores,
            events: fresh,
            rotation: this.state.rotation ?? null,
          },
        });
        this.lastPublishedAt = now;
      }
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

  /** lock calls whose time is up, cancel the ones decided while answers were open, resolve the rest */
  private async settleCalls(game: LiigaGame, now: number, messages: Message[]) {
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
      // our clock, not the db's: room scopes (runSince, a rotation cycle) are compared against it
      const createdAt = new Date(now).toISOString();
      await Promise.all(
        answers
          .filter((x) => x.optionId === correct)
          .map((a) => db.points.award({ userId: a.userId, matchId: this.matchId, callId: c.id, points: CALL_POINTS, reason: `call: ${c.question}`, createdAt })),
      );
      await notifyResults(this.matchId, c, correct, answers).catch((err) => console.warn(`live: notifications failed: ${(err as Error).message}`));
      const split = this.splits.get(c.id) ?? splitOf(c.options, answers);
      messages.push({ event: "call_resolved", payload: { callId: c.id, correctOptionId: correct, split, serverNow: now } });
      this.board = await renderer!.leaderboard(this.matchId);
      messages.push({ event: "leaderboard", payload: { leaderboard: this.board.rows, watching: this.board.watching } });
    }
  }

  /** a live game or a speed replay: the trigger rules decide the next call on the spot */
  private async openNextCall(game: LiigaGame, now: number, messages: Message[]) {
    const draft = nextCall(game, {
      lastOpenedAt: this.lastOpenedAt,
      hasOpenCall: this.calls.some((c) => c.status === "open"),
      used: new Set(this.calls.map((c) => c.trigger)),
    });
    if (draft) await this.openCall(draft, game, now, now + ANSWER_MS, messages);
  }

  /** the rotation: "who wins?" in the lobby (answers close when the game starts), then the planned calls */
  private async openRotationCalls(game: LiigaGame, now: number, messages: Message[]) {
    const rot = this.rotation;
    if (!rot || rot.paused || !this.full) return;
    if (rot.phase === "lobby" && !this.calls.some((c) => c.type === "who_wins")) {
      await this.openCall(whoWinsDraft(this.full), game, now, rot.liveStartedAt, messages);
    }
    if (rot.phase !== "live" || rot.videoSec === null) return;
    const videoMs = rot.videoSec * 1000;
    while (this.planIndex < this.plan.length && this.plan[this.planIndex].videoSec * 1000 <= videoMs) {
      const p = this.plan[this.planIndex++];
      if (videoMs - p.videoSec * 1000 > PLAN_LATE_MS || this.calls.some((c) => c.status === "open")) continue;
      await this.openCall(p.draft, game, now, now + ANSWER_MS, messages);
    }
  }

  private async openCall(draft: CallDraft, game: LiigaGame, now: number, locksAt: number, messages: Message[]) {
    const db = getDb();
    const [approved, approvedFi] = await Promise.all([
      db.phrases.listApproved(draft.kind, "en").catch(() => []),
      db.phrases.listApproved(draft.kind, "fi").catch(() => []),
    ]);
    const call = await db.calls.create({
      // every fan gets the same call; a finnish-speaking fan reads it in finnish
      i18n: { fi: { question: wordCall(draft.kind, draft.vars, approvedFi, "fi"), options: optionsFi(draft.options, draft.vars) } },
      matchId: this.matchId,
      type: draft.kind,
      // a rotation plays the same game every cycle: the cycle keeps each run's calls apart
      trigger: this.cycle === null ? draft.trigger : `${this.cycle}:${draft.trigger}`,
      question: wordCall(draft.kind, draft.vars, approved),
      options: draft.options,
      stakesLine: await renderer!.stakesLine(this.matchId, game, draft).catch(() => null),
      openedGameTime: game.gameTime,
      openedAt: new Date(now).toISOString(),
      locksAt: new Date(locksAt).toISOString(),
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
      fi: c.i18n?.fi ?? null,
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
      isReplay: this.kind !== "live",
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
      rotation: this.rotation,
      me: null,
    };
  }

  /** the watch together room changed (a fan joined, left or timed out): re-read it, tell everyone */
  async refreshRoom() {
    if (!renderer) return;
    this.board = await renderer.leaderboard(this.matchId);
    if (this.state) this.state = { ...this.state, leaderboard: this.board.rows, watching: this.board.watching };
    await publish(this.matchId, [{ event: "room", payload: { leaderboard: this.board.rows, watching: this.board.watching } }]);
  }

  /** host controls for the demo replay */
  async control(action: string): Promise<string | null> {
    const now = Date.now();
    const c = this.clock;
    const t = replayTime(c, now);
    switch (action) {
      case "start":
        // the game starts: the clock starts at 0:01, so the game is live (and the first call open) at once
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

  /** a goal's second in this rotation match's highlight (only goals already played are asked for) */
  goalVideoSec(goalId: string): number | null {
    if (!this.full || !this.rot) return null;
    return goalVideoTimes(this.full, this.rot.cues, this.rot.durationSec).get(goalId) ?? null;
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

/** the rotation's three matches, each with its full (unmasked) game */
async function startRotation() {
  const config = await initRotation();
  for (const m of config?.matches ?? []) {
    const ids = parseMatchId(m.matchId)!;
    const res = await getGame(ids.season, ids.gameId, { unmasked: true }).catch(() => null);
    if (!res || res.data.game.status !== "final") {
      console.warn(`demo: rotation match ${m.matchId} is ${res?.data.game.status ?? "missing"}; it needs a finished game (npm run snapshot)`);
      continue;
    }
    const loop = new MatchLoop(m.matchId, "rotation", res.data.names, res.data.game, undefined, m);
    loops.set(m.matchId, loop);
    await loop.start();
  }
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
  // demo mode is the rotation; the league clock is frozen, so there are no real live games
  if (demoMode()) return startRotation();
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
  /** rotation matches: their phase now */
  rotation: LiveRotation | null;
}

/** the engine's view of a match, when it runs one */
export function engineMatch(matchId: string): EngineMatch | null {
  const loop = loops.get(matchId);
  if (!loop) return null;
  return { state: loop.state, visible: loop.visible, isReplay: loop.kind !== "live", names: loop.names, rotation: loop.state?.rotation ?? null };
}

/** a fan joined, left or timed out of a match's room: the new count and board, to everyone */
export async function refreshRoom(matchId: string): Promise<void> {
  await loops.get(matchId)?.refreshRoom();
}

/** a goal's second in a rotation match's highlight, for its "Watch" button */
export const goalVideoSec = (matchId: string, goalId: string) => loops.get(matchId)?.goalVideoSec(goalId) ?? null;

/** where a match's points and calls start counting: the current replay run, else the beginning */
export function matchSince(matchId: string): string {
  const loop = loops.get(matchId);
  return loop?.kind === "replay" ? loop.runSince : new Date(0).toISOString();
}

/** the watch together room a match belongs to: its db key, since when it counts, and its matches */
export interface RoomScope {
  key: string;
  since: string;
  matchIds: string[];
}

/**
 * the rotation's three matches share one room, counted from the start of the current cycle
 * (so it grows across matches 1-3 and starts over with match 1); any other match is its own room
 */
export function roomScope(matchId: string): RoomScope {
  const r = isRotationMatch(matchId) ? rotationNow() : null;
  if (r) return { key: "rotation", since: new Date(r.cycleStartedAt).toISOString(), matchIds: rotationConfig()!.matches.map((m) => m.matchId) };
  return { key: matchId, since: matchSince(matchId), matchIds: [matchId] };
}

/** the match whose watch together room is on now: the rotation's, else the demo replay */
export function roomMatchNow(): string | null {
  return rotationNow()?.current.matchId ?? [...loops.values()].find((l) => l.kind === "replay")?.matchId ?? null;
}

/** every call taking or waiting on answers right now, across matches */
export function openCalls(): { id: string; matchId: string }[] {
  return [...loops.values()].flatMap((l) => {
    const c = l.state?.call;
    return c ? [{ id: c.id, matchId: l.matchId }] : [];
  });
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

/** re-renders every rotation match now (after a host action), instead of on their next tick */
export async function refreshRotation() {
  await Promise.all([...loops.values()].filter((l) => l.kind === "rotation").map((l) => l.tick(true)));
}
