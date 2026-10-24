// the watch party's feed and card: chat (the match discussion), system lines (goals, results),
// fact cards ("ask the match"), trivia cards, reaction bursts and emoji on messages. every item
// belongs to a match and its rotation cycle, so each run of a match has its own party. stored in
// the comments table; moderation (length, the guardrails, a profanity list, rate limits) as before
import { roomScope } from "@/features/live/server";
import { checkText } from "@/shared/guardrails";
import { getDb, type DbComment, type DbUser } from "@/shared/db";
import type { Burst, Comment, FactCard, RoomSummary } from "@/shared/types";
import { displayName } from "./identity";
import { avatarFor } from "./points";
import { boardRows, partyStandings } from "./presence";

/** the emoji fans can put on a message, and the bursts that float over everyone's screen */
export const REACTIONS = ["🔥", "👏", "😱", "🏒", "😂", "👍"] as const;
export const BURSTS = ["🔥", "👏", "😱", "🏒"] as const;
const BURST_MS = 2000;
/** how long a burst counts as recent (the polling fallback shows the ones it missed) */
export const BURST_WINDOW_MS = 8000;

/** the party card on the page: who's in, how many watch, and the board (every participant) */
export async function roomSummary(matchId: string, youId: string | null, final: boolean, top = 50): Promise<RoomSummary> {
  const p = await partyStandings(matchId);
  const rows = boardRows(p, top).map((r) => (r.userId === youId ? { ...r, name: "You", isYou: true } : r));
  return {
    code: "PARTY",
    watching: p.watching,
    subtitle: "Everyone on this match is in the party",
    avatars: p.members.slice(0, 4).map((m) => avatarFor(m.name)),
    extraCount: Math.max(0, p.watching - Math.min(4, p.members.length)),
    leaderboardTitle: final ? "Final party board" : "Party board",
    leaderboardNote: final ? "Points this match" : "Everyone here, by points this match",
    leaderboard: rows,
    members: p.members,
    ...(rows.length === 0 && { footnote: "Nobody here yet. Open the match on another phone to fill the party." }),
  };
}

async function toComments(rows: DbComment[]): Promise<Comment[]> {
  const db = getDb();
  const [users, reacts] = await Promise.all([
    db.users.getMany([...new Set(rows.map((r) => r.userId).filter((x): x is string => !!x))]),
    db.comments.reactions(rows.map((r) => r.id)),
  ]);
  const byId = new Map(users.map((u) => [u.id, u]));
  return rows.map((r) => {
    const counts: Record<string, number> = {};
    for (const x of reacts) if (x.commentId === r.id) counts[x.emoji] = (counts[x.emoji] ?? 0) + 1;
    const d = r.data ?? {};
    return {
      id: r.id,
      kind: r.kind === "burst" ? "chat" : r.kind,
      userId: r.userId,
      author: r.userId ? displayName(byId.get(r.userId)) : "",
      text: r.text,
      likes: r.likes,
      createdAt: r.createdAt,
      ...(Object.keys(counts).length && { reactions: counts }),
      ...(r.kind === "fact" && { fact: d as unknown as FactCard }),
      ...(r.kind === "trivia" && { trivia: { callId: String(d.callId ?? ""), points: Number(d.points ?? 10) } }),
    };
  });
}

/** the party feed now: the latest items of this match's current party, oldest first */
export async function recentComments(matchId: string, limit = 40): Promise<Comment[]> {
  const rows = await getDb().comments.list(matchId, limit, { cycle: roomScope(matchId).cycle });
  return (await toComments(rows)).reverse();
}

// the polling fallback asks for the feed every second per viewer: one read per match per half
// second (a write here clears it at once; another server's copy is at most half a second old)
const feeds = new Map<string, { at: number; cycle: string; value: Promise<{ feed: Comment[]; bursts: Burst[] }> }>();
export function cachedFeed(matchId: string): Promise<{ feed: Comment[]; bursts: Burst[] }> {
  const cycle = roomScope(matchId).cycle;
  const hit = feeds.get(matchId);
  if (hit && hit.cycle === cycle && Date.now() - hit.at < 500) return hit.value;
  const value = Promise.all([recentComments(matchId), recentBursts(matchId)]).then(([feed, bursts]) => ({ feed, bursts }));
  value.catch(() => feeds.delete(matchId));
  feeds.set(matchId, { at: Date.now(), cycle, value });
  return value;
}
const fresh = (matchId: string) => feeds.delete(matchId);

/** the reaction bursts of the last few seconds */
export async function recentBursts(matchId: string): Promise<Burst[]> {
  const since = new Date(Date.now() - BURST_WINDOW_MS).toISOString();
  const rows = await getDb().comments.since(matchId, roomScope(matchId).cycle, since, ["burst"]);
  const users = new Map((await getDb().users.getMany([...new Set(rows.map((r) => r.userId).filter((x): x is string => !!x))])).map((u) => [u.id, u]));
  return rows.map((r) => ({ id: r.id, emoji: r.text, name: displayName(r.userId ? users.get(r.userId) : null), at: Date.parse(r.createdAt) }));
}

// a small list on top of the shared guardrails; extend as moderation needs grow
const PROFANITY = [/\bfuck\w*/i, /\bshit\w*/i, /\bcunt\w*/i, /\bvittu\w*/i, /\bperkele\b/i, /\bsaatana\w*/i, /\bhuora\w*/i, /\bnigg\w*/i];
const COOLDOWN_MS = 5000;
// last accepted post (and burst) per user, on this server's clock (the db clock can differ by
// seconds). a fan talks to one server, so memory is enough; a restart only resets the window
const lastPost = new Map<string, number>();
const lastBurst = new Map<string, number>();

export type CommentRejection = { status: 422 | 429; error: string };

/** why a text can't go in the feed, or null: too long, betting words, profanity */
export function moderate(text: string): string | null {
  if (!text) return "comment is empty";
  if (text.length > 280) return "comments are 280 characters at most";
  const betting = checkText(text)[0];
  if (betting) return `"${betting.match}" is not allowed here (no betting talk)`;
  if (PROFANITY.some((re) => re.test(text))) return "please keep it friendly";
  return null;
}

/** posts a chat message, or says why not: too long, too fast, betting words, profanity */
export async function postComment(matchId: string, userId: string, raw: string): Promise<Comment | CommentRejection> {
  const text = raw.trim();
  if (!text || text.length > 280) return { status: 422, error: moderate(text)! };
  if (Date.now() - (lastPost.get(userId) ?? 0) < COOLDOWN_MS) return { status: 429, error: "one comment every 5 seconds" };
  const problem = moderate(text);
  if (problem) return { status: 422, error: problem };
  lastPost.set(userId, Date.now());
  const row = await getDb().comments.create({ matchId, userId, text, cycle: roomScope(matchId).cycle });
  fresh(matchId);
  return (await toComments([row]))[0];
}

/** a line from the engine (a goal, a result, a trivia card), posted once per key */
export async function postLine(matchId: string, cycle: string, line: { text: string; key: string; kind?: "system" | "trivia"; data?: Record<string, unknown> }): Promise<Comment | null> {
  if (checkText(line.text).length) return null;
  const row = await getDb().comments.createOnce({ matchId, userId: null, text: line.text.slice(0, 280), kind: line.kind ?? "system", cycle, data: line.data ?? null }, line.key);
  if (!row) return null;
  fresh(matchId);
  return (await toComments([row]))[0];
}

/** an "ask the match" answer, for the whole party */
export async function postFact(matchId: string, userId: string, card: FactCard): Promise<Comment> {
  const row = await getDb().comments.create({ matchId, userId, text: card.answer.slice(0, 280), kind: "fact", cycle: roomScope(matchId).cycle, data: card as unknown as Record<string, unknown> });
  fresh(matchId);
  return (await toComments([row]))[0];
}

/** a reaction burst over everyone's screen: one every 2 s per fan */
export async function postBurst(matchId: string, user: DbUser, emoji: string): Promise<Burst | CommentRejection> {
  if (!(BURSTS as readonly string[]).includes(emoji)) return { status: 422, error: "unknown reaction" };
  if (Date.now() - (lastBurst.get(user.id) ?? 0) < BURST_MS) return { status: 429, error: "one reaction every 2 seconds" };
  lastBurst.set(user.id, Date.now());
  const row = await getDb().comments.create({ matchId, userId: user.id, text: emoji, kind: "burst", cycle: roomScope(matchId).cycle });
  fresh(matchId);
  return { id: row.id, emoji, name: displayName(user), at: Date.parse(row.createdAt) };
}

/** an emoji on a feed item; the item's counts after it */
export async function react(commentId: string, userId: string, emoji: string): Promise<{ matchId: string; reactions: Record<string, number> } | { status: 404 | 409 | 422; error: string }> {
  if (!(REACTIONS as readonly string[]).includes(emoji)) return { status: 422, error: "unknown reaction" };
  const db = getDb();
  const c = await db.comments.get(commentId);
  if (!c || c.kind === "burst") return { status: 404, error: "message not found" };
  if ((await db.comments.react(commentId, userId, emoji)) === "duplicate") return { status: 409, error: "already reacted" };
  const counts: Record<string, number> = {};
  for (const x of await db.comments.reactions([commentId])) counts[x.emoji] = (counts[x.emoji] ?? 0) + 1;
  fresh(c.matchId);
  return { matchId: c.matchId, reactions: counts };
}
