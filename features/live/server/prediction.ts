// the match prediction: one per fan, match and rotation cycle. it is the "who wins?" call of that
// match and cycle (trigger "<cycle>:who_wins"), so the call rules hold: one answer per fan, no
// answer after the lock, points once per fan and call. what if? (the preview page, the lobby) and
// the lobby's your call! card answer the same call, so both show the same locked choice.
// it opens before the game: a rotation match for its next lobby (this cycle or the next one), any
// other game until its start. it locks when the game starts and the engine settles it from the
// final result (+30)
import type { LiigaGame } from "@/features/liiga";
import { demoMode } from "@/shared/clock";
import { getDb, type DbCall } from "@/shared/db";
import { optionsFi, wordCall } from "../engine/phrases";
import { PREDICTION_TYPE } from "../engine/points";
import { whoWinsDraft } from "../engine/rules";
import { isRotationMatch, phaseOf } from "./rotation";

/** when this match's next prediction locks, and the cycle it belongs to; null when none can be made now */
export function predictionWindow(matchId: string, game: Pick<LiigaGame, "start" | "status">, now = Date.now()): { cycle: string; locksAt: number } | null {
  if (isRotationMatch(matchId)) {
    const p = phaseOf(matchId, now);
    if (!p) return null;
    const { slot, r } = p;
    // the time left to the game's start, from the rotation's own clock (it stands still while
    // paused), so a pause in the lobby never runs a prediction out
    const toLive = slot.liveAt - r.at;
    // its slot this cycle is still to come (or its lobby is on): this cycle; else the next one
    if (toLive > 0) return { cycle: r.cycleKey, locksAt: now + toLive };
    const [run, n] = splitCycle(r.cycleKey);
    return { cycle: `${run}:${n + 1}`, locksAt: now + toLive + r.cycleLength };
  }
  // demo mode: the league clock stands still, only the rotation plays
  if (demoMode() || game.status !== "scheduled") return null;
  const start = Date.parse(game.start);
  return start > now ? { cycle: "", locksAt: start } : null;
}

const splitCycle = (key: string): [string, number] => {
  const i = key.lastIndexOf(":");
  return [key.slice(0, i), Number(key.slice(i + 1))];
};

/** the cycle number of a rotation call's trigger ("<run>:<n>:who_wins"); null for other calls */
export function cycleOfTrigger(trigger: string): { run: string; n: number } | null {
  const m = /^(.+):(\d+):[a-z_]+(?::.*)?$/.exec(trigger);
  return m ? { run: m[1], n: Number(m[2]) } : null;
}

export const predictionTrigger = (cycle: string) => (cycle ? `${cycle}:${PREDICTION_TYPE}` : PREDICTION_TYPE);

/** this match's prediction call for a cycle, if one was made */
export async function findPrediction(matchId: string, cycle: string): Promise<DbCall | null> {
  const trigger = predictionTrigger(cycle);
  return (await getDb().calls.listForMatch(matchId)).find((c) => c.trigger === trigger) ?? null;
}

/**
 * the prediction call that is open now (made on first use, by whichever server asks first), or
 * null when the match takes no prediction at the moment
 */
export async function openPrediction(matchId: string, game: Pick<LiigaGame, "start" | "status" | "home" | "away">, now = Date.now(), stakesLine: string | null = null): Promise<DbCall | null> {
  const w = predictionWindow(matchId, game, now);
  if (!w || w.locksAt <= now) return null;
  const { call, created } = await createPrediction(matchId, game, w.cycle, w.locksAt, now, stakesLine);
  // a call made earlier carries an older guess of the start (pauses and skips move it): refresh it
  if (!created && call.status === "open" && Math.abs(Date.parse(call.locksAt) - w.locksAt) > 1000) {
    return (await getDb().calls.update(call.id, { locksAt: new Date(w.locksAt).toISOString() })) ?? call;
  }
  return call;
}

/** the who wins call of a match and cycle: the one already there, else a new open one */
export async function createPrediction(matchId: string, game: Pick<LiigaGame, "home" | "away">, cycle: string, locksAt: number, now: number, stakesLine: string | null) {
  const db = getDb();
  const draft = whoWinsDraft(game);
  const [approved, approvedFi] = await Promise.all([db.phrases.listApproved(draft.kind, "en").catch(() => []), db.phrases.listApproved(draft.kind, "fi").catch(() => [])]);
  return db.calls.createOnce({
    i18n: { fi: { question: wordCall(draft.kind, draft.vars, approvedFi, "fi"), options: optionsFi(draft.options, draft.vars) } },
    matchId,
    type: draft.kind,
    trigger: predictionTrigger(cycle),
    question: wordCall(draft.kind, draft.vars, approved),
    options: draft.options,
    stakesLine,
    openedGameTime: 0,
    openedAt: new Date(now).toISOString(),
    locksAt: new Date(locksAt).toISOString(),
    lockGameTime: null,
    resolvesRule: draft.rule as unknown as Record<string, unknown>,
    status: "open",
    correctOptionId: null,
    resolvedAt: null,
  });
}

/**
 * true when a prediction can no longer take answers although its row may still say open: its
 * match is on (a host skip can start the game before the stored lock time)
 */
export function predictionClosed(call: DbCall, now = Date.now()): boolean {
  if (call.type !== PREDICTION_TYPE) return false;
  if (!isRotationMatch(call.matchId)) return now >= Date.parse(call.locksAt);
  // a rotation match: closed once its game is on in this cycle, or when the cycle is over
  const p = phaseOf(call.matchId, now);
  if (!p) return true;
  const mine = cycleOfTrigger(call.trigger);
  const current = cycleOfTrigger(`${p.r.cycleKey}:${PREDICTION_TYPE}`);
  if (!mine || !current || mine.run !== current.run || mine.n < current.n) return true;
  return mine.n === current.n && (p.phase === "live" || p.phase === "summary" || (p.phase === "idle" && p.r.at >= p.slot.liveAt));
}
