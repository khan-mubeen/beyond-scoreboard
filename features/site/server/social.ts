// rooms, comments, likes and reminders, over shared/db
import { roomScope } from "@/features/live/server";
import { checkText } from "@/shared/guardrails";
import { getDb, type DbComment } from "@/shared/db";
import type { Comment, RoomLeaderboardRow, RoomSummary } from "@/shared/types";
import { displayName } from "./identity";
import { avatarFor, botIds, rankPoints } from "./points";

const CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const randomCode = () => Array.from({ length: 4 }, () => CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)]).join("");

/** the watch together room of a match (rotation matches share one, see roomScope) */
export const roomFor = (matchId: string) => getDb().rooms.getOrCreateForMatch(roomScope(matchId).key, randomCode());

/** joins the match's room (or the room behind a shared code); null when the code is unknown */
export async function joinMatch(matchId: string, userId: string, roomCode?: string) {
  const db = getDb();
  const room = roomCode ? await db.rooms.getByCode(roomCode) : await roomFor(matchId);
  if (!room) return null;
  await db.rooms.join(room.id, userId);
  return room;
}

/** who is in the room (bots left out) and every fan's points in it, ranked */
export async function roomStandings(matchId: string, youId: string | null) {
  const db = getDb();
  const scope = roomScope(matchId);
  const [room, bots] = await Promise.all([roomFor(matchId), botIds()]);
  const one = scope.matchIds.length === 1 ? scope.matchIds[0] : undefined;
  const [members, rows] = await Promise.all([db.rooms.members(room.id), db.points.listSince(scope.since, one)]);
  const fans = members.filter((id) => !bots.has(id));
  const inScope = new Set(scope.matchIds);
  const ranked = await rankPoints(
    rows.filter((r) => r.matchId && inScope.has(r.matchId)),
    Number.MAX_SAFE_INTEGER,
    youId,
  );
  return { room, fans, ranked };
}

/** the room card: who's in, and the room leaderboard from the points ledger */
export async function roomSummary(matchId: string, youId: string | null, final: boolean, extraWatching = 0, top = 5): Promise<RoomSummary> {
  const { room, fans, ranked } = await roomStandings(matchId, youId);
  const users = await getDb().users.getMany(fans.slice(0, 4));
  const shown = ranked.filter((e, i) => i < top || e.isYou);
  const rows: RoomLeaderboardRow[] = shown.map((e) => ({ rank: e.rank, name: e.isYou ? "You" : e.nickname, score: e.score, ...(e.isYou && { isYou: true }) }));
  if (youId && !rows.some((r) => r.isYou)) rows.push({ rank: null, name: "You", score: null, isYou: true });
  const watching = Math.max(fans.length, extraWatching);
  return {
    code: room.code,
    watching,
    subtitle: "Compete with friends",
    avatars: users.map((u) => avatarFor(displayName(u))),
    extraCount: Math.max(0, watching - users.length),
    leaderboardTitle: final ? "Final room leaderboard" : "Room leaderboard",
    leaderboardNote: final ? "Top 5" : "Top participants",
    leaderboard: rows,
    ...(rows.length === 0 && { footnote: "No calls answered in this room yet." }),
  };
}

async function toComments(rows: DbComment[]): Promise<Comment[]> {
  const users = new Map((await getDb().users.getMany([...new Set(rows.map((r) => r.userId))])).map((u) => [u.id, u]));
  return rows.map((r) => ({ id: r.id, author: displayName(users.get(r.userId)), text: r.text, likes: r.likes, createdAt: r.createdAt }));
}

/** latest comments, oldest first, for the live discussion */
export async function recentComments(matchId: string, limit = 30): Promise<Comment[]> {
  return (await toComments(await getDb().comments.list(matchId, limit))).reverse();
}

// a small list on top of the shared guardrails; extend as moderation needs grow
const PROFANITY = [/\bfuck\w*/i, /\bshit\w*/i, /\bcunt\w*/i, /\bvittu\w*/i, /\bperkele\b/i, /\bsaatana\w*/i, /\bhuora\w*/i, /\bnigg\w*/i];
const COOLDOWN_MS = 5000;
// last accepted post per user, on this server's clock (the db clock can differ by seconds).
// one long-running process, so memory is enough; a restart only resets the 5 s window
const lastPost = new Map<string, number>();

export type CommentRejection = { status: 422 | 429; error: string };

/** posts a comment, or says why not: too long, too fast, betting words, profanity */
export async function postComment(matchId: string, userId: string, raw: string): Promise<Comment | CommentRejection> {
  const text = raw.trim();
  if (!text) return { status: 422, error: "comment is empty" };
  if (text.length > 280) return { status: 422, error: "comments are 280 characters at most" };
  if (Date.now() - (lastPost.get(userId) ?? 0) < COOLDOWN_MS) return { status: 429, error: "one comment every 5 seconds" };
  const betting = checkText(text)[0];
  if (betting) return { status: 422, error: `"${betting.match}" is not allowed here (no betting talk)` };
  if (PROFANITY.some((re) => re.test(text))) return { status: 422, error: "please keep it friendly" };
  lastPost.set(userId, Date.now());
  const row = await getDb().comments.create({ matchId, userId, text });
  return (await toComments([row]))[0];
}
