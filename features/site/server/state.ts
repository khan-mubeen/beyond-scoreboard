// GET /api/site/matches/:id/state: the full live snapshot. used on page load, after a realtime
// reconnect and as the polling fallback, so it carries everything the channel does: the game,
// the call and its answer count, trivia, the party (board, who's here, watching) and its feed
// (chat, system lines, fact cards, recent reaction bursts). the live engine owns active matches
// (a follower's engine mirrors the leader); otherwise the state is derived from the match detail
import { engineMatch, leaderInfo, roomScope } from "@/features/live/server";
import { getDb, type DbUser } from "@/shared/db";
import type { LiveState, MatchDetail, PreviewMatchDetail } from "@/shared/types";
import { periodName } from "./labels";
import { matchDetail } from "./match";
import { boardRows, partyStandings } from "./presence";
import { cachedFeed } from "./social";

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
  // one round of queries: the party, the feed, the open question's count and the viewer's own
  // answers and points together
  const open = base.call?.status === "open" ? base.call.id : null;
  const [party, feed, mine, count] = await Promise.all([partyStandings(matchId), cachedFeed(matchId), user ? mineOf(base, user) : null, open ? answerCount(open) : null]);
  const { role, instance } = leaderInfo();
  return {
    ...base,
    serverNow: now,
    rotation,
    // the party as of now (a follower's engine reads it less often than the leader broadcasts it)
    leaderboard: boardRows(party),
    watching: party.watching,
    members: party.members,
    party: { key: party.key, cycle: party.cycle },
    feed: feed.feed,
    bursts: feed.bursts,
    answered: open && count !== null ? { callId: open, count: Math.max(count, base.answered?.callId === open ? base.answered.count : 0) } : base.answered,
    server: { role, instance },
    me: user && mine ? meFor(base, user, party, mine) : null,
  };
}

function cachedFromDetail(matchId: string): Promise<LiveState | null> {
  const hit = fromDetail.get(matchId);
  if (hit && Date.now() - hit.at < DETAIL_TTL_MS) return hit.state;
  const state = matchDetail(matchId, { anonId: "", user: null }).then((d) => (d && d.status !== "preview" ? stateFromDetail(d) : null));
  fromDetail.set(matchId, { at: Date.now(), state });
  state.catch(() => fromDetail.delete(matchId));
  return state;
}

/** the viewer's answers to the current call, trivia and last call, and their points */
async function mineOf(s: LiveState, user: DbUser) {
  const db = getDb();
  const callIds = [s.call?.id, s.lastCall?.id, s.trivia?.id].filter((x): x is string => !!x);
  const [answers, points] = await Promise.all([callIds.length ? db.answers.listForUser(user.id, callIds) : [], db.points.listForUser(user.id)]);
  return { answers, points };
}

/** the viewer as the page shows them: answers, points this match, and their party rank */
function meFor(s: LiveState, user: DbUser, party: Awaited<ReturnType<typeof partyStandings>>, { answers, points }: Awaited<ReturnType<typeof mineOf>>): NonNullable<LiveState["me"]> {
  const since = roomScope(s.matchId).since;
  const mine = party.ranked.find((e) => e.userId === user.id);
  return {
    userId: user.id,
    nickname: user.nickname,
    matchPoints: points.filter((p) => p.matchId === s.matchId && p.createdAt >= since && p.points > 0 && p.reason !== "welcome").reduce((sum, p) => sum + p.points, 0),
    answers: Object.fromEntries(answers.map((a) => [a.callId, a.optionId])),
    rank: mine?.rank ?? null,
    of: party.ranked.length,
  };
}

// "8 of 12 have answered" for polling viewers: counted at most every half second per question
const counts = new Map<string, { at: number; value: Promise<number> }>();
export function answerCount(callId: string): Promise<number> {
  const hit = counts.get(callId);
  if (hit && Date.now() - hit.at < 500) return hit.value;
  const value = getDb()
    .answers.listForCall(callId)
    .then((a) => a.length);
  value.catch(() => counts.delete(callId));
  counts.set(callId, { at: Date.now(), value });
  if (counts.size > 50) counts.delete(counts.keys().next().value!);
  return value;
}
/** an answer just came in: the next count reads it */
export const answerCountChanged = (callId: string) => counts.delete(callId);

export function stateFromDetail(d: Exclude<MatchDetail, PreviewMatchDetail>): LiveState {
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
