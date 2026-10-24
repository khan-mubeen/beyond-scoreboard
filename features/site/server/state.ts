// GET /api/site/matches/:id/state: the full live snapshot. used on page load, after a realtime
// reconnect and as the polling fallback. the live engine owns active matches; otherwise the
// state is derived from the match detail (cached a few seconds, polling clients share it)
import { engineMatch, roomScope } from "@/features/live/server";
import { getDb, type DbUser } from "@/shared/db";
import type { LiveState, MatchDetail } from "@/shared/types";
import { periodName } from "./labels";
import { matchDetail } from "./match";
import { roomStandings } from "./social";

const DETAIL_TTL_MS = 5000;
const fromDetail = new Map<string, { at: number; state: Promise<LiveState | null> }>();

/** the snapshot for a match, as the viewer sees it */
export async function liveStateFor(matchId: string, user: DbUser | null): Promise<LiveState | null> {
  const base = engineMatch(matchId)?.state ?? (await cachedFromDetail(matchId));
  if (!base) return null;
  // serverNow is the response time (the clients sync their countdowns to it), not the tick's;
  // a running highlight's second moves on with it
  const now = Date.now();
  const r = base.rotation;
  const rotation = r && r.videoSec !== null && !r.paused ? { ...r, videoSec: r.videoSec + (now - base.serverNow) / 1000 } : r;
  return { ...base, serverNow: now, rotation, me: user ? await meFor(base, user) : null };
}

function cachedFromDetail(matchId: string): Promise<LiveState | null> {
  const hit = fromDetail.get(matchId);
  if (hit && Date.now() - hit.at < DETAIL_TTL_MS) return hit.state;
  const state = matchDetail(matchId, { anonId: "", user: null }).then((d) => (d ? stateFromDetail(d) : null));
  fromDetail.set(matchId, { at: Date.now(), state });
  state.catch(() => fromDetail.delete(matchId));
  return state;
}

// the room ranking, shared by every viewer polling the same match for a couple of seconds
const standings = new Map<string, { at: number; value: ReturnType<typeof roomStandings> }>();
function cachedStandings(matchId: string) {
  const hit = standings.get(matchId);
  if (hit && Date.now() - hit.at < 2000) return hit.value;
  const value = roomStandings(matchId, null);
  value.catch(() => standings.delete(matchId));
  standings.set(matchId, { at: Date.now(), value });
  return value;
}

/** the viewer's answers to the current and last call, their points this match, and their room rank */
async function meFor(s: LiveState, user: DbUser): Promise<NonNullable<LiveState["me"]>> {
  const db = getDb();
  const callIds = [s.call?.id, s.lastCall?.id].filter((x): x is string => !!x);
  const since = roomScope(s.matchId).since;
  const [answers, points, room] = await Promise.all([
    callIds.length ? db.answers.listForUser(user.id, callIds) : [],
    db.points.listForUser(user.id),
    cachedStandings(s.matchId),
  ]);
  return {
    userId: user.id,
    nickname: user.nickname,
    matchPoints: points.filter((p) => p.matchId === s.matchId && p.createdAt >= since).reduce((sum, p) => sum + p.points, 0),
    answers: Object.fromEntries(answers.map((a) => [a.callId, a.optionId])),
    rank: room.ranked.find((e) => e.playerId === user.id)?.rank ?? null,
    of: Math.max(room.fans.length, room.ranked.length),
  };
}

export function stateFromDetail(d: MatchDetail): LiveState {
  const m = d.match;
  return {
    matchId: d.id,
    serverNow: Date.now(),
    isReplay: !!d.isReplay,
    status: d.status,
    clock: { period: 0, gameTime: 0, label: m.periodLabel ?? (d.status === "final" ? "Final" : m.whenLabel), clock: m.clock ?? "" },
    score: m.score ?? { home: 0, away: 0 },
    periodScores: m.periodScores,
    events: d.events,
    stakes: { chips: d.stakesSummary, seasonStakes: d.seasonStakes, whatItMeans: d.status === "final" ? "" : d.whatItMeans },
    call: null,
    lastCall: null,
    leaderboard: d.room.leaderboard,
    watching: d.room.watching,
    me: null,
  };
}

export { periodName };
