// the live engine: one loop per active match, owned by the server (the only authority).
// real live game: tick every 5 s on the cached api (10 s ttl). demo replay (DEMO_REPLAY_MATCH_ID):
// tick every 1 s on a finished game replayed at DEMO_REPLAY_SPEED. demo rotation (DEMO_MODE):
// tick every 0.5 s; the game follows its highlight video and calls are planned ahead from the cues.
// each tick on the leader (./leader.ts): lock, cancel or resolve calls, maybe open the next one
// (or a trivia question in a play gap), re-render on changes, and broadcast to "match:{id}".
// on a follower the same loops are mirrors: they read the leader's calls from the database to
// serve pages and never open, settle, pay or broadcast anything. a promoted follower adopts the
// calls it mirrored, so an open question carries on through a takeover
import { parseMatchId, unplayedGame, type LiigaGame } from "@/features/liiga";
import { getGame, getGamesOn, helsinkiDate, liigaNow } from "@/features/liiga/server";
import { demoMode } from "@/shared/clock";
import { getDb, type DbCall } from "@/shared/db";
import type { RotationMatchConfig } from "@/shared/demo";
import type { LiveCall, LiveRotation, LiveStakes, LiveState, MatchEvent, PartyMember, RoomLeaderboardRow, Score } from "@/shared/types";
import { optionsFi, wordCall } from "../engine/phrases";
import { gameAt, nextMomentAfter, replayEnd, replayTime, type ReplayClock } from "../engine/replay";
import { gameAtVideo, goalVideoTimes, planCalls, type PlannedCall } from "../engine/rotation";
import { decidedInWindow, nextCall, resolve, whoWinsDraft, type CallDraft, type ResolveRule } from "../engine/rules";
import { isLeader, onLeadership } from "./leader";
import { publish, type MatchEvent as Broadcast } from "./realtime";
import { initRotation, isRotationMatch, phaseOf, rotationMatch, rotationNow } from "./rotation";

export interface RenderedMatch {
  stakes: LiveStakes;
  /** newest first */
  events: MatchEvent[];
  periodScores: (Score | null)[];
}

/** the party as everyone sees it: the board (every participant, 0 points too), who is active */
export interface PartyBoard {
  rows: RoomLeaderboardRow[];
  watching: number;
  members: PartyMember[];
}

/** a trivia question built from the match's player and team data, with its verified answer */
export interface TriviaDraft {
  question: string;
  options: { id: string; label: string }[];
  answer: string;
  fi?: { question: string; options: { id: string; label: string }[] } | null;
}

/** a line the engine puts in the party feed: a goal, a result, a trivia card */
export interface PartyLine {
  text: string;
  /** posted once per key, whatever restarts or leader changes happen */
  key: string;
  kind?: "system" | "trivia";
  data?: Record<string, unknown>;
}

/** the site server turns a game state into ui pieces; the engine stays free of ui code */
export interface MatchRenderer {
  /** on a goal, penalty, period or status change */
  render(matchId: string, game: LiigaGame, names: Map<number, string>): Promise<RenderedMatch>;
  /** every tick: "2nd period", "14:26" */
  clock(game: LiigaGame): { label: string; clock: string };
  stakesLine(matchId: string, game: LiigaGame, draft: CallDraft): Promise<string | null>;
  /** the party: board, watching count and who is here */
  leaderboard(matchId: string): Promise<PartyBoard>;
  /** "GOAL! Kärpät 2–1 · 11:40" */
  goalLine(game: LiigaGame, goal: LiigaGame["goals"][number]): string;
  /** puts a line in the party feed; the comment to broadcast, null when the key was posted already */
  post(matchId: string, cycle: string, line: PartyLine): Promise<Record<string, unknown> | null>;
  /** a trivia question for a play gap (null when none fits the data) */
  trivia(matchId: string, game: LiigaGame, n: number): Promise<TriviaDraft | null>;
}

let renderer: MatchRenderer | null = null;
const ANSWER_MS = Number(process.env.CALL_ANSWER_SECONDS ?? 20) * 1000;
export const CALL_POINTS = 20;
/** trivia: fixed points, a shorter window, and spacing so it only fills the gaps */
export const TRIVIA_POINTS = 10;
const TRIVIA_MS = Number(process.env.TRIVIA_ANSWER_SECONDS ?? 15) * 1000;
/** a play gap: this long since the last question or trivia (rehearsals can shorten both) */
const TRIVIA_GAP_MS = Number(process.env.TRIVIA_GAP_SECONDS ?? 90) * 1000;
const TRIVIA_EVERY_MS = Number(process.env.TRIVIA_EVERY_SECONDS ?? 120) * 1000;
/** a planned call more than this late (a restart mid-highlight) is skipped, not opened late */
const PLAN_LATE_MS = 2000;
/** the board (watching, who's here) is re-read this often while a match is on */
const BOARD_LEADER_MS = 1000;
const BOARD_MIRROR_MS = 2500;
/** a follower re-reads the leader's calls this often */
const MIRROR_MS = 1000;

type Message = { event: Broadcast; payload: Record<string, unknown> };
type Kind = "live" | "replay" | "rotation";

const isTrivia = (c: DbCall) => c.type === "trivia";

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
  private board: PartyBoard = { rows: [], watching: 0, members: [] };
  private boardKey = "";
  private boardAt = 0;
  // rotation only: the calls planned from the cues, the next one, and the cycle they belong to
  private plan: PlannedCall[] = [];
  private planIndex = 0;
  private cycle: string | null = null;
  private lastPublishedAt = 0;
  private rotation: LiveRotation | null = null;
  // the leader adopts the database's calls (and goals already seen) on its first tick and on a new cycle
  private needSync = true;
  private syncedAt = 0;
  private led = false;
  /** goals already in the party feed (or there before this loop looked): only new ones are announced */
  private announced = new Set<string>();
  /** the open your call! question's answer count, for "8 of 12 have answered" */
  private answered: { callId: string; count: number } | null = null;
  private answeredAt = 0;
  /** wall clock of the last question or trivia, and of the last trivia */
  private lastQuestionAt = Date.now();
  private lastTriviaAt = 0;
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

  /** the party this loop's calls, feed lines and presence belong to (see roomScope) */
  partyCycle(): string {
    if (this.kind === "rotation") return this.cycle ?? "";
    if (this.kind === "replay") return `run:${this.runSince}`;
    return "";
  }

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
    if (this.kind === "replay" && isLeader()) {
      // a replay starts over: calls an earlier run left open are cancelled
      for (const c of (await db.calls.listForMatch(this.matchId)).filter((x) => x.status === "open" || x.status === "locked")) {
        await db.calls.update(c.id, { status: "cancelled", resolvedAt: new Date().toISOString() });
      }
    }
    if (this.kind === "live") {
      // a live game remembers its calls (no trigger fires twice after a restart); open ones from
      // before a restart are cancelled, locked ones still resolve
      const stored = await db.calls.listForMatch(this.matchId);
      if (isLeader()) for (const c of stored.filter((x) => x.status === "open")) await db.calls.update(c.id, { status: "cancelled", resolvedAt: new Date().toISOString() });
      this.calls = await db.calls.listForMatch(this.matchId);
      this.lastOpenedAt = this.calls.filter((c) => !isTrivia(c)).reduce<number | null>((m, c) => Math.max(m ?? 0, c.openedGameTime), null);
    }
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
      this.announced.clear();
      this.planIndex = 0;
      this.rendered = null;
      this.board = { rows: [], watching: 0, members: [] };
      this.boardKey = "";
      this.answered = null;
      this.lastQuestionAt = now;
      this.lastTriviaAt = 0;
      this.needSync = true;
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

  /** a call of this loop's run: a rotation cycle's own, a live game's every call */
  private owns(c: DbCall): boolean {
    if (this.kind === "rotation") return this.cycle !== null && c.trigger.startsWith(`${this.cycle}:`);
    return this.kind === "live";
  }

  /**
   * this run's calls from the database. a follower mirrors the leader with it; a new leader (or a
   * new cycle) adopts what is there, so nothing opens twice and an open call still settles
   */
  private async syncCalls(game: LiigaGame, now: number) {
    if (this.kind === "replay") return;
    const db = getDb();
    const rows = await db.calls.listForMatch(this.matchId);
    if (isLeader() && this.kind === "rotation") {
      // a call from an earlier cycle left open by a server that stopped: nobody would settle it
      for (const c of rows.filter((x) => !this.owns(x) && (x.status === "open" || x.status === "locked"))) {
        await db.calls.update(c.id, { status: "cancelled", resolvedAt: new Date(now).toISOString() });
      }
    }
    const mine = rows.filter((c) => this.owns(c));
    for (const c of mine) {
      if (c.status !== "open" && !isTrivia(c) && !this.splits.has(c.id)) this.splits.set(c.id, splitOf(c.options, await db.answers.listForCall(c.id)));
    }
    this.calls = mine;
    const asked = mine.filter((c) => !isTrivia(c));
    this.lastOpenedAt = asked.length ? Math.max(...asked.map((c) => c.openedGameTime)) : null;
    const at = (list: DbCall[]) => (list.length ? Math.max(...list.map((c) => Date.parse(c.openedAt))) : 0);
    this.lastQuestionAt = Math.max(this.lastQuestionAt, at(mine));
    this.lastTriviaAt = Math.max(this.lastTriviaAt, at(mine.filter(isTrivia)));
    // goals already on screen are not news: only later ones get a line in the feed
    for (const g of game.goals) this.announced.add(g.id);
    this.syncedAt = now;
    this.needSync = false;
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
      const leading = isLeader();
      // just promoted: adopt what the last leader left before doing anything
      if (leading && !this.led) this.needSync = true;
      this.led = leading;
      if (this.needSync || (!leading && now - this.syncedAt >= MIRROR_MS)) await this.syncCalls(game, now);

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

      if (leading) {
        await this.settleCalls(game, now, messages);
        if (this.kind === "rotation") await this.openRotationCalls(game, now, messages);
        else await this.openNextCall(game, now, messages);
        await this.maybeTrivia(game, now, messages);
        await this.announceGoals(game, messages);
      }
      this.setSpeed(this.calls.some((c) => c.status === "open" && !isTrivia(c)) ? 1 : this.baseSpeed, now);
      await this.countAnswers(now, leading, messages);

      if (changed || !this.rendered) {
        const scoreChanged = !prev || prev.goals.length !== game.goals.length || prev.status !== game.status;
        this.rendered = await renderer.render(this.matchId, game, this.names);
        if (scoreChanged || force) messages.push({ event: "stakes", payload: { ...this.rendered.stakes, serverNow: now } });
      }
      const fresh = this.rendered.events.filter((e) => !this.seenEvents.has(e.id));
      for (const e of fresh) this.seenEvents.add(e.id);
      await this.refreshBoard(now, leading, changed, messages);

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
      // only the leader speaks on the channel; a follower's view is for its own http answers
      if (leading) await publish(this.matchId, messages);
      if (this.kind === "live" && game.status === "final" && leading) {
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

  /** the party board: re-read every second on the leader while the match is on (joins on any server, timeouts), broadcast when it changed */
  private async refreshBoard(now: number, leading: boolean, changed: boolean, messages: Message[]) {
    const idle = this.rotation?.phase === "idle";
    const every = leading ? BOARD_LEADER_MS : BOARD_MIRROR_MS;
    if (!changed && this.board.rows.length && (idle || now - this.boardAt < every)) return;
    this.boardAt = now;
    this.board = await renderer!.leaderboard(this.matchId);
    // a slow read is stamped with when it started: a newer one from another server wins
    const key = JSON.stringify(this.board);
    if (key !== this.boardKey && this.boardKey !== "") messages.push({ event: "room", payload: { leaderboard: this.board.rows, watching: this.board.watching, members: this.board.members, at: now } });
    this.boardKey = key;
  }

  /** "8 of 12 have answered" for the open your call! question (counts only: no split before the lock) */
  private async countAnswers(now: number, leading: boolean, messages: Message[]) {
    const open = this.calls.find((c) => c.status === "open" && !isTrivia(c));
    if (!open) {
      this.answered = null;
      return;
    }
    if (this.answered?.callId === open.id && now - this.answeredAt < 1000) return;
    this.answeredAt = now;
    const count = (await getDb().answers.listForCall(open.id)).length;
    const before = this.answered?.callId === open.id ? this.answered.count : 0;
    this.answered = { callId: open.id, count };
    if (leading && count !== before) messages.push({ event: "call_count", payload: { callId: open.id, answered: count, serverNow: now } });
  }

  /** a goal that just happened gets a line in the party feed ("GOAL! Kärpät 2–1 · 11:40"), once */
  private async announceGoals(game: LiigaGame, messages: Message[]) {
    for (const g of game.goals) {
      if (this.announced.has(g.id)) continue;
      this.announced.add(g.id);
      const comment = await renderer!.post(this.matchId, this.partyCycle(), { text: renderer!.goalLine(game, g), key: `goal:${this.matchId}:${this.partyCycle()}:${g.id}` });
      if (comment) messages.push({ event: "comment", payload: { comment } });
    }
  }

  /** lock calls whose time is up, cancel the ones decided while answers were open, resolve the rest */
  private async settleCalls(game: LiigaGame, now: number, messages: Message[]) {
    const db = getDb();
    for (const c of this.calls) {
      if (isTrivia(c)) {
        await this.settleTrivia(c, now, messages);
        continue;
      }
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
      // the party hears how it went: "64% called it right"
      const label = c.options.find((o) => o.id === correct)?.label ?? "";
      const right = answers.length ? Math.round((100 * answers.filter((a) => a.optionId === correct).length) / answers.length) : 0;
      const text = answers.length ? `${right}% called it right · ${c.question} ${label}` : `${c.question} ${label}`;
      const comment = await renderer!.post(this.matchId, this.partyCycle(), { text, key: `result:${c.id}` });
      if (comment) messages.push({ event: "comment", payload: { comment } });
      this.board = await renderer!.leaderboard(this.matchId);
      this.boardKey = JSON.stringify(this.board);
      messages.push({ event: "leaderboard", payload: { leaderboard: this.board.rows, watching: this.board.watching, members: this.board.members, at: now } });
    }
  }

  /** trivia's answer is known when it opens: at the lock it resolves at once, +10 for each right answer */
  private async settleTrivia(c: DbCall, now: number, messages: Message[]) {
    if (c.status !== "open" || now < Date.parse(c.locksAt)) return;
    const db = getDb();
    const correct = String((c.resolvesRule as { answer?: string }).answer ?? "");
    Object.assign(c, await db.calls.update(c.id, { status: "resolved", correctOptionId: correct, lockGameTime: this.visible?.gameTime ?? 0, resolvedAt: new Date(now).toISOString() }));
    await db.answers.setCorrect(c.id, correct);
    const answers = await db.answers.listForCall(c.id);
    const createdAt = new Date(now).toISOString();
    const right = answers.filter((a) => a.optionId === correct);
    await Promise.all(right.map((a) => db.points.award({ userId: a.userId, matchId: this.matchId, callId: c.id, points: TRIVIA_POINTS, reason: `trivia: ${c.question}`, createdAt })));
    this.splits.set(c.id, splitOf(c.options, answers));
    messages.push({ event: "trivia", payload: { trivia: this.toLive(c), serverNow: now } });
    const label = c.options.find((o) => o.id === correct)?.label ?? "";
    const comment = await renderer!.post(this.matchId, this.partyCycle(), {
      text: `Trivia: ${right.length} of ${answers.length} got it · ${label} (+${TRIVIA_POINTS} pts)`,
      key: `trivia-result:${c.id}`,
    });
    if (comment) messages.push({ event: "comment", payload: { comment } });
    if (right.length) {
      this.board = await renderer!.leaderboard(this.matchId);
      this.boardKey = JSON.stringify(this.board);
      messages.push({ event: "leaderboard", payload: { leaderboard: this.board.rows, watching: this.board.watching, members: this.board.members, at: now } });
    }
  }

  /**
   * party trivia in a play gap: the match is live, no your call! question is open, 90 s since the
   * last question or trivia, and at most one every 2 minutes. built from player and team data
   */
  private async maybeTrivia(game: LiigaGame, now: number, messages: Message[]) {
    // the rotation and real live games (a speed replay is a dev tool: its gaps are seconds long)
    const live = this.kind === "rotation" ? this.rotation?.phase === "live" && !this.rotation.paused : this.kind === "live" && game.status === "live";
    if (!live || this.calls.some((c) => c.status === "open")) return;
    if (now - this.lastQuestionAt < TRIVIA_GAP_MS || now - this.lastTriviaAt < TRIVIA_EVERY_MS) return;
    // a highlight about to end has no room for a 15 s question
    const r = this.rotation;
    if (r && r.videoSec !== null && r.durationSec - r.videoSec < TRIVIA_MS / 1000 + 5) return;
    const n = this.calls.filter(isTrivia).length;
    this.lastTriviaAt = now;
    const draft = await renderer!.trivia(this.matchId, game, n).catch(() => null);
    if (!draft) return;
    const call = await getDb().calls.create({
      matchId: this.matchId,
      type: "trivia",
      trigger: `${this.cycle === null ? "" : `${this.cycle}:`}trivia:${n}`,
      question: draft.question,
      options: draft.options,
      stakesLine: null,
      openedGameTime: game.gameTime,
      openedAt: new Date(now).toISOString(),
      locksAt: new Date(now + TRIVIA_MS).toISOString(),
      lockGameTime: null,
      // the answer stays on the server until the lock
      resolvesRule: { kind: "trivia", answer: draft.answer },
      status: "open",
      correctOptionId: null,
      resolvedAt: null,
      i18n: draft.fi ? { fi: draft.fi } : null,
    });
    this.calls.push(call);
    this.lastQuestionAt = now;
    messages.push({ event: "trivia", payload: { trivia: this.toLive(call), serverNow: now } });
    const comment = await renderer!.post(this.matchId, this.partyCycle(), {
      text: draft.question,
      key: `trivia:${call.id}`,
      kind: "trivia",
      data: { callId: call.id, points: TRIVIA_POINTS },
    });
    if (comment) messages.push({ event: "comment", payload: { comment } });
  }

  /** a live game or a speed replay: the trigger rules decide the next call on the spot */
  private async openNextCall(game: LiigaGame, now: number, messages: Message[]) {
    const draft = nextCall(game, {
      lastOpenedAt: this.lastOpenedAt,
      hasOpenCall: this.calls.some((c) => c.status === "open" && !isTrivia(c)),
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
      const late = videoMs - p.videoSec * 1000 > PLAN_LATE_MS;
      // a call the last leader opened already (a takeover) is adopted, not opened again
      const made = this.calls.some((c) => c.trigger === `${this.cycle}:${p.draft.trigger}`);
      if (late || made || this.calls.some((c) => c.status === "open" && !isTrivia(c))) continue;
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
    this.lastQuestionAt = now;
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
      points: isTrivia(c) ? TRIVIA_POINTS : CALL_POINTS,
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
    const asked = newestFirst.filter((c) => !isTrivia(c));
    const current = asked.find((c) => c.status === "open" || c.status === "locked") ?? null;
    const last = asked.find((c) => c.status === "resolved" || c.status === "cancelled") ?? null;
    const trivia = newestFirst.find(isTrivia) ?? null;
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
      answered: current && this.answered?.callId === current.id ? this.answered : null,
      trivia: trivia ? this.toLive(trivia) : null,
      leaderboard: this.board.rows,
      watching: this.board.watching,
      members: this.board.members,
      party: { key: this.matchId, cycle: this.partyCycle() },
      rotation: this.rotation,
      me: null,
    };
  }

  /** the party changed (a fan joined, left or timed out): re-read it, tell everyone */
  async refreshRoom() {
    if (!renderer) return;
    this.board = await renderer.leaderboard(this.matchId);
    this.boardKey = JSON.stringify(this.board);
    this.boardAt = Date.now();
    if (this.state) this.state = { ...this.state, leaderboard: this.board.rows, watching: this.board.watching, members: this.board.members };
    if (isLeader()) await publish(this.matchId, [{ event: "room", payload: { leaderboard: this.board.rows, watching: this.board.watching, members: this.board.members, at: this.boardAt } }]);
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
        this.announced.clear();
        this.lastOpenedAt = null;
        this.visible = null;
        this.board = { rows: [], watching: 0, members: [] };
        this.boardKey = "";
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
let replayWanted: { matchId: string; speed: number; autostart: boolean } | null = null;

async function startReplay(matchId: string, speed: number, autostart: boolean) {
  if (loops.has(matchId)) return;
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

/**
 * the rotation and live games run on every server (mirrors on followers); the demo replay's
 * clock lives in its leader's memory, so it runs on the leader only and starts on promotion
 */
export async function startEngine(r: MatchRenderer) {
  renderer = r;
  onLeadership((leading) => {
    if (leading && replayWanted) void startReplay(replayWanted.matchId, replayWanted.speed, replayWanted.autostart);
    if (!leading) {
      for (const [id, loop] of loops) {
        if (loop.kind !== "replay") continue;
        loop.stop();
        loops.delete(id);
      }
    }
  });
  // demo mode is the rotation; the league clock is frozen, so there are no real live games
  if (demoMode()) return startRotation();
  const demo = process.env.DEMO_REPLAY_MATCH_ID;
  if (demo) replayWanted = { matchId: demo, speed: Number(process.env.DEMO_REPLAY_SPEED ?? 15), autostart: process.env.DEMO_REPLAY_AUTOSTART === "true" };
  if (replayWanted && isLeader()) await startReplay(replayWanted.matchId, replayWanted.speed, replayWanted.autostart);
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

/** a fan joined, left or timed out of a match's party: the new count and board, to everyone */
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

/** a match's watch party: its key, the run it belongs to (cycle), since when its points count */
export interface RoomScope {
  key: string;
  /** a rotation match: the cycle ("<run>:<n>"); a replay: its run; any other match: "" */
  cycle: string;
  since: string;
  matchIds: string[];
}

/**
 * each match and rotation cycle has one party: a rotation match's starts over every cycle (its
 * points count from the cycle's start), a replay's with every run, any other match has one
 */
export function roomScope(matchId: string): RoomScope {
  const r = isRotationMatch(matchId) ? rotationNow() : null;
  if (r) return { key: matchId, cycle: r.cycleKey, since: new Date(r.cycleStartedAt).toISOString(), matchIds: [matchId] };
  const loop = loops.get(matchId);
  if (loop?.kind === "replay") return { key: matchId, cycle: loop.partyCycle(), since: loop.runSince, matchIds: [matchId] };
  return { key: matchId, cycle: "", since: new Date(0).toISOString(), matchIds: [matchId] };
}

/** the match whose watch party is on now: the rotation's, else the demo replay */
export function roomMatchNow(): string | null {
  return rotationNow()?.current.matchId ?? [...loops.values()].find((l) => l.kind === "replay")?.matchId ?? null;
}

/** every call or trivia question taking or waiting on answers right now, across matches */
export function openCalls(): { id: string; matchId: string }[] {
  return [...loops.values()].flatMap((l) => {
    const open = [l.state?.call, l.state?.trivia].filter((c): c is LiveCall => !!c && (c.status === "open" || c.status === "locked"));
    return open.map((c) => ({ id: c.id, matchId: l.matchId }));
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
