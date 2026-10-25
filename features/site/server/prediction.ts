// the fan's match prediction (GET / POST /api/site/matches/:id/prediction): the "who wins?" call
// of the match and cycle (features/live/server/prediction.ts), read and answered for what if?. the
// lobby's your call! card answers the same call through /calls/:id/answer
import { parseMatchId } from "@/features/liiga";
import { getGame } from "@/features/liiga/server";
import { PREDICTION_OUTCOMES, PREDICTION_POINTS } from "@/features/live";
import { answerCall, findPrediction, openPrediction, phaseOf, predictionClosed, predictionWindow, publish, roomScope } from "@/features/live/server";
import { getDb, type DbCall } from "@/shared/db";
import type { GameOutcome, MatchPrediction } from "@/shared/types";
import { ensureUser, type Viewer } from "./identity";
import { answerCount, answerCountChanged } from "./state";

export class PredictionError extends Error {
  constructor(
    readonly status: 400 | 404 | 409,
    message: string,
  ) {
    super(message);
  }
}

/** the four outcomes, in the home team's view (as the call's options) */
const optionsOf = (names: { home: string; away: string }, fi = false) =>
  (fi
    ? [
        ["home_win", `${names.home} voittaa`],
        ["home_ot", `${names.home} voittaa jatkoajalla tai voittolaukauksilla`],
        ["away_ot", `${names.away} voittaa jatkoajalla tai voittolaukauksilla`],
        ["away_win", `${names.away} voittaa`],
      ]
    : [
        ["home_win", `${names.home} win`],
        ["home_ot", `${names.home} win in OT/SO`],
        ["away_ot", `${names.away} win in OT/SO`],
        ["away_win", `${names.away} win`],
      ]
  ).map(([id, label]) => ({ id, label, outcome: PREDICTION_OUTCOMES[id] as GameOutcome }));

async function gameOf(matchId: string) {
  const ids = parseMatchId(matchId);
  const res = ids ? await getGame(ids.season, ids.gameId).catch(() => null) : null;
  if (!res) throw new PredictionError(404, "match not found");
  return res.data.game;
}

/** the cycle whose prediction the page shows: the match's own while it is on, else the next one */
function shownCycle(matchId: string, w: { cycle: string } | null): string {
  const p = phaseOf(matchId);
  if (p && p.phase !== "idle") return roomScope(matchId).cycle;
  return w?.cycle ?? roomScope(matchId).cycle;
}

function statusOf(call: DbCall | null, choice: string | null, open: boolean): MatchPrediction["status"] {
  if (!call) return open ? "open" : "closed";
  if (call.status === "resolved") return choice ? (choice === call.correctOptionId ? "won" : "lost") : "closed";
  if (call.status === "cancelled") return "cancelled";
  if (call.status === "locked" || predictionClosed(call)) return choice ? "locked" : "closed";
  return "open";
}

async function describe(matchId: string, call: DbCall | null, userId: string | null, open: boolean, lang: "en" | "fi", names: { home: string; away: string }, locksAt: number | null): Promise<MatchPrediction> {
  const mine = call && userId ? (await getDb().answers.listForUser(userId, [call.id]))[0] : undefined;
  const choice = mine?.optionId ?? null;
  const fi = lang === "fi" ? call?.i18n?.fi : null;
  return {
    matchId,
    callId: call?.id ?? null,
    status: statusOf(call, choice, open),
    question: fi?.question ?? call?.question ?? (lang === "fi" ? "Kuka voittaa?" : "Who wins?"),
    options: optionsOf(names, lang === "fi"),
    choice,
    correctOptionId: call?.status === "resolved" ? call.correctOptionId : null,
    locksAt: call ? Date.parse(call.locksAt) : locksAt,
    points: PREDICTION_POINTS,
    asOf: new Date().toISOString(),
    source: "db",
  };
}

/** the fan's prediction for this match (made or not) */
export async function predictionFor(matchId: string, viewer: Viewer, now = Date.now()): Promise<MatchPrediction> {
  const g = await gameOf(matchId);
  const w = predictionWindow(matchId, g, now);
  const open = !!w && w.locksAt > now;
  const call = await findPrediction(matchId, shownCycle(matchId, w));
  return describe(matchId, call, viewer.user?.id ?? null, open, viewer.user?.language ?? "en", { home: g.home.name, away: g.away.name }, w?.locksAt ?? null);
}

/** makes the fan's prediction: once only, before the game starts */
export async function predict(matchId: string, viewer: Viewer, optionId: string, now = Date.now()): Promise<MatchPrediction> {
  if (!PREDICTION_OUTCOMES[optionId]) throw new PredictionError(400, "unknown option");
  const g = await gameOf(matchId);
  // a rotation match on now takes this cycle's prediction only (its window would be the next cycle's)
  const p = phaseOf(matchId, now);
  if (p && (p.phase === "live" || p.phase === "summary")) throw new PredictionError(409, "predictions for this match are closed: the game has started");
  const call = await openPrediction(matchId, g, now);
  if (!call || predictionClosed(call, now)) throw new PredictionError(409, "predictions for this match are closed: the game has started");
  const user = await ensureUser(viewer);
  const result = await answerCall(call.id, user.id, optionId, now);
  if (result.status !== 201) throw new PredictionError(result.status, result.error === "already answered" ? "you already made your prediction for this match" : result.error);
  answerCountChanged(call.id);
  void answerCount(call.id).then((n) => publish(matchId, [{ event: "call_count", payload: { callId: call.id, answered: n, serverNow: Date.now() } }]));
  viewer.user = user;
  return describe(matchId, call, user.id, true, user.language, { home: g.home.name, away: g.away.name }, null);
}
