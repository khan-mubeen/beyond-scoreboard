// who is in a match's watch party. every match page sends a heartbeat every 30 s while it is
// visible (and a leave when it is hidden or closed); each one upserts the fan's party_presence
// row, so every server agrees on who is here. a fan is active (watching) while seen in the last
// 90 s; bots never count. the party is the match plus its rotation cycle (roomScope): everyone
// who opens the match joins it, and its board lists every participant, 0 points included.
// the leader's engine re-reads the party every second and broadcasts "room" when it changes
import { publish, roomScope } from "@/features/live/server";
import { getDb, type DbUser } from "@/shared/db";
import { isEarned } from "@/shared/points";
import type { PartyMember, RoomLeaderboardRow } from "@/shared/types";
import { displayName } from "./identity";
import { botIds } from "./points";

export const ACTIVE_MS = 90_000;

/**
 * a join or a leave changed the party: the server that took the request tells everyone at once,
 * from the database (the one source of truth), stamped with when it was read. pages keep the
 * newest stamp, so two servers never make the count flap. the leader's engine also re-reads the
 * party every second (timeouts) and stamps its own broadcasts the same way
 */
export async function roomChanged(matchId: string) {
  try {
    standings.delete(matchId);
    const at = Date.now();
    const p = await partyStandings(matchId);
    await publish(matchId, [{ event: "room", payload: { leaderboard: boardRows(p), watching: p.watching, members: p.members, at } }]);
  } catch (err) {
    console.warn(`presence: ${(err as Error).message}`);
  }
}

/** a heartbeat: the fan is in the party and active. true when they weren't active before */
export async function heartbeat(matchId: string, user: DbUser): Promise<boolean> {
  if (user.isBot) return false;
  const { fresh } = await getDb().presence.beat(matchId, roomScope(matchId).cycle, user.id);
  standings.delete(matchId);
  if (fresh) void roomChanged(matchId);
  return fresh;
}

/** the page closed: no longer watching, still on the party's board */
export async function leave(matchId: string, user: DbUser) {
  await getDb().presence.leave(matchId, roomScope(matchId).cycle, user.id);
  standings.delete(matchId);
  void roomChanged(matchId);
}

export interface PartyEntry {
  userId: string;
  name: string;
  score: number;
  rank: number;
  active: boolean;
  joinedAt: string;
}

export interface PartyStandings {
  key: string;
  cycle: string;
  /** everyone who joined this party (and anyone who scored in it), best first; equal points share a rank */
  ranked: PartyEntry[];
  watching: number;
  /** active now, the latest first */
  members: PartyMember[];
}

async function computeStandings(matchId: string, now = Date.now()): Promise<PartyStandings> {
  const db = getDb();
  const scope = roomScope(matchId);
  const [rows, bots, points] = await Promise.all([db.presence.list(matchId, scope.cycle), botIds(), db.points.listSince(scope.since, matchId)]);
  const joined = new Map(rows.filter((r) => !bots.has(r.userId)).map((r) => [r.userId, r]));
  // earned points in this party: this match since the cycle (or run) began
  const score = new Map<string, number>();
  for (const p of points) if (!bots.has(p.userId) && isEarned(p)) score.set(p.userId, (score.get(p.userId) ?? 0) + p.points);
  const ids = [...new Set([...joined.keys(), ...score.keys()])];
  const users = new Map((await db.users.getMany(ids)).map((u) => [u.id, u]));
  const active = (id: string) => {
    const r = joined.get(id);
    return !!r && now - Date.parse(r.lastSeen) < ACTIVE_MS;
  };
  const sorted = ids
    .map((id) => ({ id, score: score.get(id) ?? 0, joinedAt: joined.get(id)?.joinedAt ?? new Date(now).toISOString() }))
    .sort((a, b) => b.score - a.score || a.joinedAt.localeCompare(b.joinedAt));
  const ranked = sorted.map((e) => ({
    userId: e.id,
    name: displayName(users.get(e.id)),
    score: e.score,
    rank: 1 + sorted.filter((x) => x.score > e.score).length,
    active: active(e.id),
    joinedAt: e.joinedAt,
  }));
  const members = [...joined.values()]
    .filter((r) => active(r.userId))
    .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen))
    .map((r) => ({ userId: r.userId, name: displayName(users.get(r.userId)), active: true }));
  return { key: scope.key, cycle: scope.cycle, ranked, watching: members.length, members };
}

// shared by every poll and the engine's board for a moment: many viewers, one set of queries.
// per party (match and cycle): a new cycle never sees the last one's board
const standings = new Map<string, { at: number; key: string; value: Promise<PartyStandings> }>();
export function partyStandings(matchId: string): Promise<PartyStandings> {
  const scope = roomScope(matchId);
  const key = `${scope.cycle}|${scope.since}`;
  const hit = standings.get(matchId);
  if (hit && hit.key === key && Date.now() - hit.at < 500) return hit.value;
  const value = computeStandings(matchId);
  value.catch(() => standings.delete(matchId));
  standings.set(matchId, { at: Date.now(), key, value });
  return value;
}

/** the board rows everyone sees (broadcast: "you" is marked by each page) */
export const boardRows = (p: PartyStandings, top = 50): RoomLeaderboardRow[] =>
  p.ranked.slice(0, top).map((e) => ({ userId: e.userId, rank: e.rank, name: e.name, score: e.score }));

/** tests */
export function resetPresence() {
  standings.clear();
}
