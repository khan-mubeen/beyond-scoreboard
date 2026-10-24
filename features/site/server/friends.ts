// friends, invites and guest passes (minimal). every fan has a short friend code: "add friend"
// by code sends a request the other accepts or declines (a notification, or /friends). an invite
// link (/i/<code>, used once) makes the visitor the inviter's friend at once and brings them into
// the inviter's party. when the inviter has a plan with the live stream, the new fan also gets
// one guest pass: the live stream of one match, free, bound to that match and rotation cycle when
// they first play it. one pass per fan, ever; the server enforces it with the live lock
import { randomInt } from "node:crypto";
import type { Request } from "express";
import { parseMatchId } from "@/features/liiga";
import { getGame } from "@/features/liiga/server";
import { phaseOf, roomScope, rotationMatch } from "@/features/live/server";
import { getDb, type DbUser } from "@/shared/db";
import type { FriendItem, FriendsPageData, GuestPassInfo, InviteCreated, InviteInfo } from "@/shared/types";
import { displayName, ensureUser, type Viewer } from "./identity";
import { ACTIVE_MS, heartbeat } from "./presence";
import { publicBaseUrl } from "./public-url";
import { matchStarted } from "./started";
import { hasLiveStream } from "./wallet";

export class FriendError extends Error {
  constructor(
    readonly status: 400 | 401 | 404 | 409 | 429,
    message: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

// no 0/O, 1/I/L: a code read out loud or typed from a screen
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const code = (n: number) => Array.from({ length: n }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

const MAX_OPEN_INVITES = 10;
const INVITE_EVERY_MS = 3000;
const lastInvite = new Map<string, number>();

/** a fan who acts in the party has a name: guests pick one first (the nickname sheet) */
function named(v: Viewer): DbUser {
  if (!v.user?.nickname) throw new FriendError(401, "pick a nickname first");
  return v.user;
}

/** the fan's friend code, made on first use */
export async function friendCodeOf(user: DbUser): Promise<string> {
  const db = getDb();
  const have = await db.users.friendCode(user.id);
  if (have) return have;
  for (let i = 0; i < 6; i++) {
    const c = code(6);
    if (await db.users.setFriendCode(user.id, c)) return c;
  }
  throw new Error("could not make a friend code");
}

/** accepted friends' user ids */
export async function friendIds(userId: string): Promise<string[]> {
  return (await getDb().friends.list(userId))
    .filter((f) => f.status === "accepted")
    .map((f) => (f.userA === userId ? f.userB : f.userA));
}

export async function pendingFor(userId: string): Promise<number> {
  return (await getDb().friends.list(userId)).filter((f) => f.status === "pending" && f.requestedBy !== userId).length;
}

/** "TPS – Ilves" for a match id */
async function titleOf(matchId: string): Promise<string> {
  const rot = rotationMatch(matchId);
  if (rot) return rot.title;
  const ids = parseMatchId(matchId);
  const g = ids ? await getGame(ids.season, ids.gameId).catch(() => null) : null;
  return g ? `${g.data.game.home.name} – ${g.data.game.away.name}` : matchId;
}

/** where each of these fans is watching right now (their party, while it is on) */
export async function watchingNow(userIds: string[]): Promise<Map<string, { matchId: string; title: string }>> {
  const out = new Map<string, { matchId: string; title: string }>();
  if (!userIds.length) return out;
  const rows = await getDb().presence.seenSince(userIds, new Date(Date.now() - ACTIVE_MS).toISOString());
  for (const r of rows) {
    // a row of the match's current party only (an old cycle's row is history)
    if (out.has(r.userId) || roomScope(r.matchId).cycle !== r.cycle) continue;
    out.set(r.userId, { matchId: r.matchId, title: await titleOf(r.matchId) });
  }
  return out;
}

/** friends in a party now (all matches, or one) */
export async function friendsWatching(
  user: DbUser | null,
  matchId?: string,
): Promise<{ userId: string; name: string; matchId: string; title: string }[]> {
  if (!user) return [];
  const ids = await friendIds(user.id);
  const where = await watchingNow(ids);
  const users = new Map((await getDb().users.getMany([...where.keys()])).map((u) => [u.id, u]));
  return [...where.entries()]
    .filter(([, w]) => !matchId || w.matchId === matchId)
    .map(([id, w]) => ({ userId: id, name: displayName(users.get(id)), ...w }));
}

export async function friendsPage(v: Viewer): Promise<FriendsPageData> {
  const asOf = { asOf: new Date().toISOString(), source: "db" as const };
  if (!v.user) return { friendCode: null, friends: [], incoming: [], outgoing: [], ...asOf };
  const me = v.user.id;
  const rows = await getDb().friends.list(me);
  const other = (r: (typeof rows)[number]) => (r.userA === me ? r.userB : r.userA);
  const ids = rows.map(other);
  const [users, where, friendCode] = await Promise.all([
    getDb().users.getMany(ids),
    watchingNow(rows.filter((r) => r.status === "accepted").map(other)),
    friendCodeOf(v.user),
  ]);
  const byId = new Map(users.map((u) => [u.id, u]));
  const item = (id: string): FriendItem => ({
    userId: id,
    name: displayName(byId.get(id)),
    watching: where.get(id) ?? null,
  });
  return {
    friendCode,
    friends: rows.filter((r) => r.status === "accepted").map((r) => item(other(r))),
    incoming: rows.filter((r) => r.status === "pending" && r.requestedBy !== me).map((r) => item(other(r))),
    outgoing: rows.filter((r) => r.status === "pending" && r.requestedBy === me).map((r) => item(other(r))),
    ...asOf,
  };
}

/** "add friend" by code: a request the other accepts (theirs, if they asked first, is accepted now) */
export async function addFriend(v: Viewer, friendCode: string): Promise<{ status: "requested" | "friends" }> {
  const me = named(v);
  const db = getDb();
  const them = await db.users.getByFriendCode(friendCode.trim().toUpperCase());
  if (!them) throw new FriendError(404, "no fan has that code");
  if (them.id === me.id) throw new FriendError(400, "that's your own code");
  if ((await db.friends.request(me.id, them.id)) === "exists") {
    if (await db.friends.accept(me.id, them.id)) return { status: "friends" };
    const row = (await db.friends.list(me.id)).find((f) => f.userA === them.id || f.userB === them.id);
    return { status: row?.status === "accepted" ? "friends" : "requested" };
  }
  await db.notifications.create([
    {
      userId: them.id,
      type: "friend_request",
      title: `${displayName(me)} wants to be friends`,
      body: "Accept or decline on your friends page.",
      link: "/friends",
      dedupeKey: `friend:${me.id}:${them.id}`,
    },
  ]);
  return { status: "requested" };
}

export async function acceptFriend(v: Viewer, otherId: string) {
  const me = named(v);
  if (!(await getDb().friends.accept(me.id, otherId))) throw new FriendError(404, "no request from that fan");
  await getDb().notifications.create([
    {
      userId: otherId,
      type: "friend_accepted",
      title: `${displayName(me)} accepted your friend request`,
      body: "You'll see when they're watching.",
      link: "/friends",
      dedupeKey: `friend-ok:${me.id}:${otherId}`,
    },
  ]);
}

/** declines a request, cancels one, or unfriends */
export async function removeFriend(v: Viewer, otherId: string) {
  if (!v.user) throw new FriendError(404, "no such friend");
  await getDb().friends.remove(v.user.id, otherId);
}

/** POST /api/site/invites: a link for one friend, with the match the inviter is watching */
export async function createInvite(v: Viewer, matchId: string | null, req: Request): Promise<InviteCreated> {
  const me = named(v);
  const db = getDb();
  if (Date.now() - (lastInvite.get(me.id) ?? 0) < INVITE_EVERY_MS)
    throw new FriendError(429, "one invite every 3 seconds");
  if ((await db.invites.openCount(me.id)) >= MAX_OPEN_INVITES)
    throw new FriendError(409, `you have ${MAX_OPEN_INVITES} open invites; wait until a friend uses one`);
  lastInvite.set(me.id, Date.now());
  let made = null;
  for (let i = 0; i < 5 && !made; i++)
    made = await db.invites.create({ code: code(8), inviterId: me.id, matchId }).catch(() => null);
  if (!made) throw new Error("could not make an invite");
  return {
    code: made.code,
    url: `${publicBaseUrl(req)}/i/${made.code}`,
    freeMatch: await hasLiveStream(me),
    asOf: new Date().toISOString(),
    source: "db",
  };
}

export async function inviteInfo(v: Viewer, inviteCode: string): Promise<InviteInfo> {
  const db = getDb();
  const inv = await db.invites.get(inviteCode);
  if (!inv) throw new FriendError(404, "this invite doesn't exist");
  const inviter = (await db.users.getMany([inv.inviterId]))[0] ?? null;
  return {
    code: inv.code,
    inviter: displayName(inviter),
    match: inv.matchId ? { id: inv.matchId, title: await titleOf(inv.matchId) } : null,
    freeMatch: !!inviter && (await hasLiveStream(inviter)),
    used: !!inv.usedBy && inv.usedBy !== v.user?.id,
    yours: inv.inviterId === v.user?.id,
    asOf: new Date().toISOString(),
    source: "db",
  };
}

/**
 * opening an invite: the visitor gets a nickname, becomes the inviter's friend, gets a guest pass
 * when the inviter has a live-stream plan (one per fan, ever), and joins the inviter's party
 */
export async function acceptInvite(
  v: Viewer,
  inviteCode: string,
  nickname?: string,
): Promise<{ matchId: string | null; friend: string; pass: boolean }> {
  const db = getDb();
  const inv = await db.invites.get(inviteCode);
  if (!inv) throw new FriendError(404, "this invite doesn't exist");
  if (!v.user?.nickname && !nickname) throw new FriendError(401, "pick a nickname first");
  const me = await ensureUser(v, v.user?.nickname ? undefined : nickname);
  const inviter = (await db.users.getMany([inv.inviterId]))[0];
  if (!inviter) throw new FriendError(404, "this invite doesn't exist");
  if (inviter.id === me.id) return { matchId: inv.matchId, friend: displayName(inviter), pass: false };
  if (inv.usedBy !== me.id && !(await db.invites.use(inv.code, me.id)))
    throw new FriendError(409, "this invite was used already", { matchId: inv.matchId });
  await db.friends.connect(inviter.id, me.id, inviter.id);
  // a member's invite only, and only for a fan who can't watch already
  const pass =
    (await hasLiveStream(inviter)) && !(await hasLiveStream(me)) && (await db.passes.grant(me.id, inviter.id));
  await db.notifications.create([
    {
      userId: inviter.id,
      type: "invite_used",
      title: `${displayName(me)} joined with your invite`,
      body: pass ? "You're friends now, and their first live match is free." : "You're friends now.",
      link: "/friends",
      dedupeKey: `invite:${inv.code}`,
    },
  ]);
  if (inv.matchId && (await matchStarted(inv.matchId))) await heartbeat(inv.matchId, me);
  return { matchId: inv.matchId, friend: displayName(inviter), pass };
}

// ---------- the guest pass ----------

/** what the live lock says about a fan's guest pass on this match */
export async function passFor(
  user: DbUser | null,
  matchId: string,
): Promise<{ watch: boolean; offer: { from: string } | null; used: boolean }> {
  const none = { watch: false, offer: null, used: false };
  if (!user) return none;
  const db = getDb();
  const p = await db.passes.get(user.id);
  if (!p) return none;
  if (!p.usedAt) {
    const from = p.grantedBy ? (await db.users.getMany([p.grantedBy]))[0] : null;
    return { watch: false, offer: { from: displayName(from) }, used: false };
  }
  // bound to the match and cycle where it was first played: valid until that match's summary ends
  const here = p.consumedMatchId === matchId && p.consumedCycle === roomScope(matchId).cycle;
  return { watch: here, offer: null, used: !here };
}

/** /me: the fan's pass, if they have one */
export async function passInfo(user: DbUser | null): Promise<GuestPassInfo | null> {
  if (!user) return null;
  const db = getDb();
  const p = await db.passes.get(user.id);
  if (!p) return null;
  const from = displayName(p.grantedBy ? (await db.users.getMany([p.grantedBy]))[0] : null);
  if (!p.usedAt) return { from, status: "unused", matchId: null };
  const m = p.consumedMatchId!;
  const on = roomScope(m).cycle === p.consumedCycle && (phaseOf(m)?.phase ?? "live") !== "idle";
  return { from, status: on ? "active" : "used", matchId: m };
}

/** "Watch free": binds the pass to this match and cycle (the first live stream played) */
export async function usePass(v: Viewer, matchId: string): Promise<{ ok: true }> {
  if (!v.user) throw new FriendError(404, "no free match to use");
  const phase = phaseOf(matchId)?.phase;
  if (phase !== "lobby" && phase !== "live") throw new FriendError(409, "the free match is for a live stream");
  const db = getDb();
  if (await db.passes.consume(v.user.id, matchId, roomScope(matchId).cycle)) return { ok: true };
  const p = await db.passes.get(v.user.id);
  if (!p) throw new FriendError(404, "no free match to use");
  if (p.consumedMatchId === matchId && p.consumedCycle === roomScope(matchId).cycle) return { ok: true };
  throw new FriendError(409, "Your free match is used — get Kaleva Sports Pass");
}
