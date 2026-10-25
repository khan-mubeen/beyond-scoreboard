// pure: the demo rotation. three highlight matches loop forever, each one
//   lobby (QR, "starting soon", the pre-game "who wins?" call) -> live (its highlight video)
//   -> summary (what it meant), then the next match.
// stateless and deterministic: the phase is a function of (now - epoch) mod the cycle length, so
// every client and a restarted server agree. the live game follows the video: game time is a
// piecewise-linear map through the goal cues, so a goal happens exactly when it is on screen
import type { LiigaGame } from "@/features/liiga";
import { gameAt, replayEnd } from "./replay";
import { decidedInWindow, nextCall, type CallDraft } from "./rules";

export type RotationPhase = "lobby" | "live" | "summary";

export interface RotationTiming {
  lobbySeconds: number;
  summarySeconds: number;
  matches: { matchId: string; durationSec: number }[];
}

/** when the cycle began counting, when it was paused (ms epoch), and which run (a restart starts a new one) */
export interface RotationClock {
  epoch: number;
  pausedAt: number | null;
  /** changes only on restart: with the cycle index it names a cycle, whatever skips and pauses shift */
  run?: number;
}

/** one match's place in a cycle, as ms epoch times */
export interface Slot {
  matchId: string;
  index: number;
  lobbyAt: number;
  liveAt: number;
  summaryAt: number;
  endsAt: number;
}

export interface RotationNow {
  /** the effective now (ms): the pause moment while paused */
  at: number;
  cycle: number;
  cycleStart: number;
  /** ms */
  cycleLength: number;
  paused: boolean;
  current: Slot;
  phase: RotationPhase;
  phaseStart: number;
  phaseEnd: number;
  /** the next match's slot (match 1 of the next cycle after the last one) */
  next: Slot;
  slots: Slot[];
}

const S = 1000;
const slotLength = (t: RotationTiming, i: number) => (t.lobbySeconds + t.matches[i].durationSec + t.summarySeconds) * S;
export const cycleLengthOf = (t: RotationTiming) => t.matches.reduce((sum, _m, i) => sum + slotLength(t, i), 0);

function slotsFrom(t: RotationTiming, start: number): Slot[] {
  let at = start;
  return t.matches.map((m, index) => {
    const lobbyAt = at;
    const liveAt = lobbyAt + t.lobbySeconds * S;
    const summaryAt = liveAt + m.durationSec * S;
    const endsAt = summaryAt + t.summarySeconds * S;
    at = endsAt;
    return { matchId: m.matchId, index, lobbyAt, liveAt, summaryAt, endsAt };
  });
}

/** where the rotation is at `now` (ms). paused, it stays where it was paused */
export function rotationAt(t: RotationTiming, clock: RotationClock, now: number): RotationNow {
  const len = cycleLengthOf(t);
  const at = clock.pausedAt ?? now;
  const cycle = Math.floor((at - clock.epoch) / len);
  const cycleStart = clock.epoch + cycle * len;
  const slots = slotsFrom(t, cycleStart);
  const current = slots.find((s) => at < s.endsAt) ?? slots[slots.length - 1];
  const phase: RotationPhase = at < current.liveAt ? "lobby" : at < current.summaryAt ? "live" : "summary";
  const [phaseStart, phaseEnd] =
    phase === "lobby" ? [current.lobbyAt, current.liveAt] : phase === "live" ? [current.liveAt, current.summaryAt] : [current.summaryAt, current.endsAt];
  const next = slots[current.index + 1] ?? slotsFrom(t, cycleStart + len)[0];
  return { at, cycle, cycleStart, cycleLength: len, paused: clock.pausedAt !== null, current, phase, phaseStart, phaseEnd, next, slots };
}

export type RotationAction = "restart" | "skip" | "pause" | "resume";

/** host controls, as a new clock: restart from match 1, skip to the next phase, pause, resume */
export function controlClock(t: RotationTiming, clock: RotationClock, action: RotationAction, now: number): RotationClock {
  switch (action) {
    case "restart":
      return { epoch: now, pausedAt: null, run: now };
    case "pause":
      return clock.pausedAt !== null ? clock : { ...clock, pausedAt: now };
    case "resume":
      // the run stays: it names the cycle, so a pause never starts a new party
      return clock.pausedAt === null ? clock : { ...clock, epoch: clock.epoch + (now - clock.pausedAt), pausedAt: null };
    case "skip": {
      const r = rotationAt(t, clock, now);
      return { ...clock, epoch: clock.epoch - (r.phaseEnd - (clock.pausedAt ?? now)) };
    }
  }
}

/** a goal's place in the highlight: video second -> game second */
export interface Cue {
  goalId: string;
  videoSec: number;
  gameTime: number;
}

/** the anchor points of the map: the start, every cue, and the end of the game at the end of the video */
function anchors(full: LiigaGame, cues: Cue[], durationSec: number): [number, number][] {
  const end = replayEnd(full);
  return [[0, 0], ...cues.map((c): [number, number] => [c.videoSec, c.gameTime]), [durationSec, end]];
}

/** game seconds at video second v. no cues (or low confidence): a straight line from 0 to the end */
export function gameTimeAtVideo(full: LiigaGame, cues: Cue[], durationSec: number, v: number): number {
  const pts = anchors(full, cues, durationSec);
  if (v <= 0) return 0;
  for (let i = 1; i < pts.length; i++) {
    const [v0, g0] = pts[i - 1];
    const [v1, g1] = pts[i];
    // exactly the anchor at a cue (no float drift), so a goal shows on its cue
    if (v === v1 || v1 === v0) return g1;
    if (v < v1) return g0 + ((g1 - g0) * (v - v0)) / (v1 - v0);
  }
  return pts[pts.length - 1][1];
}

/** video second at which a game second is reached (the inverse map) */
export function videoAtGameTime(full: LiigaGame, cues: Cue[], durationSec: number, g: number): number {
  const pts = anchors(full, cues, durationSec);
  for (let i = 1; i < pts.length; i++) {
    const [v0, g0] = pts[i - 1];
    const [v1, g1] = pts[i];
    if (g <= g1) return g1 === g0 ? v0 : v0 + ((v1 - v0) * (g - g0)) / (g1 - g0);
  }
  return durationSec;
}

/** the game as it stands at video second v of the highlight */
export function gameAtVideo(full: LiigaGame, cues: Cue[], durationSec: number, v: number): LiigaGame {
  return gameAt(full, gameTimeAtVideo(full, cues, durationSec, v));
}

/** where each goal appears in the video: its cue, else the map */
export function goalVideoTimes(full: LiigaGame, cues: Cue[], durationSec: number): Map<string, number> {
  const byGoal = new Map(cues.map((c) => [c.goalId, c.videoSec]));
  return new Map(full.goals.map((g) => [g.id, byGoal.get(g.id) ?? videoAtGameTime(full, cues, durationSec, g.gameTime)]));
}

export interface PlannedCall {
  /** video second the call opens */
  videoSec: number;
  draft: CallDraft;
}

/**
 * the calls of a highlight, planned ahead (the server knows the cues): the usual triggers
 * (rules.ts), sampled every quarter second of video so no trigger window is missed, opening only
 * when no goal is on screen within the answer window plus 5 s and the game won't settle the
 * question before answers close, with a breather between calls.
 * "who wins?" is the lobby's call, not planned here
 */
export function planCalls(full: LiigaGame, cues: Cue[], durationSec: number, opts: { answerSeconds: number; breatherSeconds?: number }): PlannedCall[] {
  const goals = [...goalVideoTimes(full, cues, durationSec).values()];
  const clear = opts.answerSeconds + 5;
  const breather = opts.breatherSeconds ?? 8;
  const plan: PlannedCall[] = [];
  const used = new Set(["who_wins"]);
  let free = 0;
  let lastOpenedAt: number | null = null;
  for (let v = 1; v <= durationSec - clear; v += 0.25) {
    if (v < free) continue;
    if (goals.some((gv) => gv > v && gv <= v + clear)) continue;
    const g = gameAtVideo(full, cues, durationSec, v);
    const draft = nextCall(g, { lastOpenedAt, hasOpenCall: false, used });
    if (!draft) continue;
    // the video runs the game fast: a question the game settles before answers close (a power play
    // that ends) would only be cancelled, so it waits for a later moment
    const lock = gameAtVideo(full, cues, durationSec, v + opts.answerSeconds);
    if (decidedInWindow(draft.rule, lock, g.gameTime, lock.gameTime)) continue;
    plan.push({ videoSec: v, draft });
    used.add(draft.trigger);
    lastOpenedAt = g.gameTime;
    free = v + opts.answerSeconds + breather;
  }
  return plan;
}
