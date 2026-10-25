// in-memory db behind the same interface: tests and DB_MODE=memory. lost on restart
import { randomUUID } from "node:crypto";
import {
  DEFAULT_PREFS,
  type Db,
  type DbAnswer,
  type DbCall,
  type DbComment,
  type DbFriendship,
  type DbGuestPass,
  type DbInvite,
  type DbNotification,
  type DbPhrase,
  type DbPoints,
  type DbPresence,
  type DbRedemption,
  type DbReport,
  type DbRoom,
  type DbSubscription,
  type DbUser,
  type NewComment,
} from "./types";

const now = () => new Date().toISOString();
/** active presence: seen in the last 90 s (features/site/server/presence.ts) */
const ACTIVE_MS = 90_000;
const pairOf = (a: string, b: string): [string, string] => (a < b ? [a, b] : [b, a]);

export function createMemoryDb(): Db {
  const users = new Map<string, DbUser>();
  const friendCodes = new Map<string, string>();
  const rooms = new Map<string, DbRoom>();
  const members = new Map<string, Set<string>>();
  const calls = new Map<string, DbCall>();
  const answers: DbAnswer[] = [];
  const points: DbPoints[] = [];
  const comments: (DbComment & { dedupeKey?: string })[] = [];
  const likes = new Set<string>();
  const reactions: { commentId: string; userId: string; emoji: string }[] = [];
  const reminders = new Set<string>();
  const content = new Map<string, { content: unknown; source: "template" | "llm"; createdAt: string }>();
  const phrases: DbPhrase[] = [];
  const reports: DbReport[] = [];
  const notifications: DbNotification[] = [];
  const settings = new Map<string, unknown>();
  const favorites = new Map<string, Set<string>>();
  const subscriptions: DbSubscription[] = [];
  const redemptions: DbRedemption[] = [];
  const presence: DbPresence[] = [];
  const friendships: DbFriendship[] = [];
  const invites: DbInvite[] = [];
  const passes: DbGuestPass[] = [];

  // the per-fan lock: spends of one fan run one after another (like pg_advisory_xact_lock)
  const queues = new Map<string, Promise<unknown>>();
  function locked<T>(userId: string, fn: () => Promise<T>): Promise<T> {
    const prev = queues.get(userId) ?? Promise.resolve();
    const run = prev.then(fn, fn);
    queues.set(
      userId,
      run.catch(() => {}),
    );
    return run;
  }
  const balance = (userId: string) => points.filter((p) => p.userId === userId).reduce((a, p) => a + p.points, 0);
  // a real database answers later: without the lock, two spends would both pass the check here
  const io = () => new Promise((r) => setTimeout(r, 1));
  const readSub = (sub: DbSubscription): DbSubscription => ({ ...sub, status: sub.status !== "expired" && sub.expiresAt <= now() ? "expired" : sub.status });
  const feedRow = (c: NewComment): DbComment & { dedupeKey?: string } => ({
    id: randomUUID(),
    matchId: c.matchId,
    userId: c.userId,
    text: c.text,
    createdAt: now(),
    hidden: false,
    likes: 0,
    kind: c.kind ?? "chat",
    cycle: c.cycle ?? "",
    data: c.data ?? null,
  });
  const copy = ({ dedupeKey: _k, ...c }: DbComment & { dedupeKey?: string }): DbComment => ({ ...c });
  /** drops every row of the fans in `gone` from the lists that hold user ids */
  function dropFans(gone: Set<string>) {
    const keep = <T>(list: T[], has: (x: T) => boolean) => list.splice(0, list.length, ...list.filter((x) => !has(x)));
    for (const list of [answers, points, notifications, subscriptions, redemptions, presence, reactions] as { userId: string }[][]) keep(list, (x) => gone.has(x.userId));
    keep(comments, (c) => c.userId !== null && gone.has(c.userId));
    keep(friendships, (f) => gone.has(f.userA) || gone.has(f.userB));
    keep(invites, (i) => gone.has(i.inviterId) || (i.usedBy !== null && gone.has(i.usedBy)));
    keep(passes, (p) => gone.has(p.userId));
    for (const p of passes) if (p.grantedBy && gone.has(p.grantedBy)) p.grantedBy = null;
    for (const id of gone) {
      favorites.delete(id);
      friendCodes.delete(id);
    }
    for (const set of members.values()) for (const id of gone) set.delete(id);
  }

  return {
    mode: "memory",
    users: {
      async getByAnonId(anonId) {
        return [...users.values()].find((u) => u.anonId === anonId) ?? null;
      },
      async create(anonId, nickname, isBot = false) {
        const u: DbUser = { id: randomUUID(), anonId, nickname, createdAt: now(), isBot, language: "en", notificationPrefs: { ...DEFAULT_PREFS } };
        users.set(u.id, u);
        return u;
      },
      async botIds() {
        return [...users.values()].filter((u) => u.isBot).map((u) => u.id);
      },
      async setNickname(id, nickname) {
        const u = users.get(id);
        if (u) u.nickname = nickname;
      },
      async update(id, patch) {
        const u = users.get(id);
        if (!u) return null;
        Object.assign(u, patch);
        return { ...u };
      },
      async remove(id) {
        users.delete(id);
        dropFans(new Set([id]));
      },
      async getMany(ids) {
        return ids.map((id) => users.get(id)).filter((u): u is DbUser => !!u);
      },
      async getByFriendCode(code) {
        const id = [...friendCodes.entries()].find(([, c]) => c === code)?.[0];
        return id ? (users.get(id) ?? null) : null;
      },
      async setFriendCode(id, code) {
        if ([...friendCodes.entries()].some(([other, c]) => c === code && other !== id)) return false;
        friendCodes.set(id, code);
        return true;
      },
      async friendCode(id) {
        return friendCodes.get(id) ?? null;
      },
    },
    favorites: {
      async list(userId) {
        return [...(favorites.get(userId) ?? [])];
      },
      async set(userId, teamId, on) {
        const set = favorites.get(userId) ?? new Set<string>();
        favorites.set(userId, set);
        if (on) set.add(teamId);
        else set.delete(teamId);
      },
    },
    rooms: {
      async getByCode(code) {
        return [...rooms.values()].find((r) => r.code === code) ?? null;
      },
      async getOrCreateForMatch(matchId, code) {
        const found = [...rooms.values()].find((r) => r.matchId === matchId);
        if (found) return found;
        const r: DbRoom = { id: randomUUID(), matchId, code, createdAt: now() };
        rooms.set(r.id, r);
        return r;
      },
      async join(roomId, userId) {
        (members.get(roomId) ?? members.set(roomId, new Set()).get(roomId)!).add(userId);
      },
      async members(roomId) {
        return [...(members.get(roomId) ?? [])];
      },
    },
    calls: {
      async create(c) {
        const call: DbCall = { ...c, id: randomUUID() };
        calls.set(call.id, call);
        return { ...call };
      },
      async createOnce(c) {
        // no await between the check and the insert: one call per match and trigger
        const there = [...calls.values()].filter((x) => x.matchId === c.matchId && x.trigger === c.trigger).sort((a, b) => a.openedAt.localeCompare(b.openedAt))[0];
        if (there) return { call: { ...there }, created: false };
        const call: DbCall = { ...c, id: randomUUID() };
        calls.set(call.id, call);
        return { call: { ...call }, created: true };
      },
      async update(id, patch) {
        const c = calls.get(id);
        if (!c) return null;
        Object.assign(c, patch);
        return { ...c };
      },
      async get(id) {
        const c = calls.get(id);
        return c ? { ...c } : null;
      },
      async getMany(ids) {
        return ids.map((id) => calls.get(id)).filter((c): c is DbCall => !!c).map((c) => ({ ...c }));
      },
      async listForMatch(matchId) {
        return [...calls.values()]
          .filter((c) => c.matchId === matchId)
          .sort((a, b) => a.openedAt.localeCompare(b.openedAt))
          .map((c) => ({ ...c }));
      },
    },
    answers: {
      async create(a) {
        if (answers.some((x) => x.callId === a.callId && x.userId === a.userId)) return "duplicate";
        answers.push({ ...a, id: randomUUID(), correct: null });
        return "ok";
      },
      async listForCall(callId) {
        return answers.filter((a) => a.callId === callId);
      },
      async listForUser(userId, callIds) {
        return answers.filter((a) => a.userId === userId && callIds.includes(a.callId));
      },
      async recentForUser(userId, limit) {
        return answers
          .filter((a) => a.userId === userId)
          .sort((a, b) => b.answeredAt.localeCompare(a.answeredAt))
          .slice(0, limit);
      },
      async setCorrect(callId, correctOptionId) {
        for (const a of answers) if (a.callId === callId) a.correct = a.optionId === correctOptionId;
      },
    },
    points: {
      async award(e) {
        if (e.callId && points.some((p) => p.userId === e.userId && p.callId === e.callId)) return false;
        points.push({ ...e, id: randomUUID(), createdAt: e.createdAt ?? now() });
        return true;
      },
      async listForUser(userId) {
        return points.filter((p) => p.userId === userId);
      },
      async listSince(iso, matchId) {
        return points.filter((p) => p.createdAt >= iso && (!matchId || p.matchId === matchId));
      },
    },
    wallet: {
      async balance(userId) {
        return balance(userId);
      },
      purchase(p) {
        return locked(p.userId, async () => {
          if (!(p.points >= 0) || !(p.amountEur > 0) || !(p.days > 0) || !p.idempotencyKey) return { status: "invalid" as const };
          const again = subscriptions.find((x) => x.idempotencyKey === p.idempotencyKey);
          if (again) return again.userId === p.userId ? { status: "ok" as const, replayed: true, balance: balance(p.userId), row: readSub(again) } : { status: "conflict" as const };
          const have = balance(p.userId);
          await io();
          if (have < p.points) return { status: "insufficient" as const, balance: have };
          const at = now();
          const running = subscriptions.filter((x) => x.userId === p.userId && x.planId === p.planId && x.status !== "expired" && x.expiresAt > at).map((x) => x.expiresAt);
          const start = running.length ? running.sort().at(-1)! : at;
          const sub: DbSubscription = {
            id: randomUUID(),
            userId: p.userId,
            planId: p.planId,
            startedAt: start,
            expiresAt: new Date(Date.parse(start) + p.days * 86_400_000).toISOString(),
            pointsUsed: p.points,
            demoAmountEur: p.amountEur,
            status: "active",
            idempotencyKey: p.idempotencyKey,
            createdAt: at,
          };
          subscriptions.push(sub);
          if (p.points > 0) points.push({ id: randomUUID(), userId: p.userId, matchId: null, callId: null, points: -p.points, reason: "subscription", ref: sub.id, createdAt: at });
          return { status: "ok" as const, replayed: false, balance: have - p.points, row: { ...sub } };
        });
      },
      async subscriptions(userId) {
        return subscriptions
          .filter((x) => x.userId === userId)
          .map(readSub)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      },
      async cancel(userId, planId) {
        const at = now();
        let n = 0;
        for (const x of subscriptions) {
          if (x.userId === userId && x.planId === planId && x.status === "active" && x.expiresAt > at) {
            x.status = "cancelled";
            n++;
          }
        }
        return n;
      },
      redeem(p) {
        return locked(p.userId, async () => {
          if (!(p.points >= 0) || !p.code) return { status: "invalid" as const };
          const have = balance(p.userId);
          const again = redemptions.find((x) => x.userId === p.userId && x.offerId === p.offerId);
          if (again) return { status: "ok" as const, replayed: true, balance: have, row: { ...again } };
          await io();
          if (have < p.points) return { status: "insufficient" as const, balance: have };
          const red: DbRedemption = { id: randomUUID(), userId: p.userId, offerId: p.offerId, pointsUsed: p.points, code: p.code, createdAt: now() };
          redemptions.push(red);
          if (p.points > 0) points.push({ id: randomUUID(), userId: p.userId, matchId: null, callId: null, points: -p.points, reason: "offer", ref: red.id, createdAt: red.createdAt });
          return { status: "ok" as const, replayed: false, balance: have - p.points, row: { ...red } };
        });
      },
      async redemptions(userId) {
        return redemptions.filter((x) => x.userId === userId).map((x) => ({ ...x }));
      },
    },
    comments: {
      async create(c) {
        const row = feedRow(c);
        comments.push(row);
        return copy(row);
      },
      async createOnce(c, dedupeKey) {
        if (comments.some((x) => x.dedupeKey === dedupeKey)) return null;
        const row = { ...feedRow(c), dedupeKey };
        comments.push(row);
        return copy(row);
      },
      async get(id) {
        const c = comments.find((x) => x.id === id);
        return c ? copy(c) : null;
      },
      async list(matchId, limit, opts = {}) {
        const kinds = opts.kinds ?? ["chat", "system", "fact", "trivia"];
        return comments
          .filter((c) => c.matchId === matchId && !c.hidden && kinds.includes(c.kind) && (opts.cycle === undefined || c.cycle === opts.cycle))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, limit)
          .map(copy);
      },
      async since(matchId, cycle, iso, kinds) {
        return comments
          .filter((c) => c.matchId === matchId && c.cycle === cycle && c.createdAt >= iso && kinds.includes(c.kind))
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
          .map(copy);
      },
      async like(commentId, userId) {
        const k = `${commentId}:${userId}`;
        if (likes.has(k)) return "duplicate";
        likes.add(k);
        const c = comments.find((x) => x.id === commentId);
        if (c) c.likes++;
        return "ok";
      },
      async react(commentId, userId, emoji) {
        if (reactions.some((r) => r.commentId === commentId && r.userId === userId && r.emoji === emoji)) return "duplicate";
        reactions.push({ commentId, userId, emoji });
        return "ok";
      },
      async reactions(commentIds) {
        return reactions.filter((r) => commentIds.includes(r.commentId)).map((r) => ({ ...r }));
      },
    },
    presence: {
      async beat(matchId, cycle, userId, at = now()) {
        const row = presence.find((p) => p.matchId === matchId && p.cycle === cycle && p.userId === userId);
        const fresh = !row || Date.parse(at) - Date.parse(row.lastSeen) >= ACTIVE_MS;
        if (row) row.lastSeen = at;
        else presence.push({ matchId, cycle, userId, joinedAt: at, lastSeen: at });
        return { fresh };
      },
      async leave(matchId, cycle, userId) {
        const row = presence.find((p) => p.matchId === matchId && p.cycle === cycle && p.userId === userId);
        if (row) row.lastSeen = new Date(0).toISOString();
      },
      async list(matchId, cycle) {
        return presence.filter((p) => p.matchId === matchId && p.cycle === cycle).map((p) => ({ ...p }));
      },
      async seenSince(userIds, iso) {
        return presence
          .filter((p) => userIds.includes(p.userId) && p.lastSeen >= iso)
          .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen))
          .map((p) => ({ ...p }));
      },
    },
    friends: {
      async list(userId) {
        return friendships.filter((f) => f.userA === userId || f.userB === userId).map((f) => ({ ...f }));
      },
      async request(from, to) {
        const [a, b] = pairOf(from, to);
        if (friendships.some((f) => f.userA === a && f.userB === b)) return "exists";
        friendships.push({ userA: a, userB: b, status: "pending", requestedBy: from, createdAt: now() });
        return "requested";
      },
      async accept(userId, otherId) {
        const [a, b] = pairOf(userId, otherId);
        const f = friendships.find((x) => x.userA === a && x.userB === b && x.status === "pending" && x.requestedBy === otherId);
        if (!f) return false;
        f.status = "accepted";
        return true;
      },
      async connect(x, y, requestedBy) {
        const [a, b] = pairOf(x, y);
        const f = friendships.find((r) => r.userA === a && r.userB === b);
        if (f) f.status = "accepted";
        else friendships.push({ userA: a, userB: b, status: "accepted", requestedBy, createdAt: now() });
      },
      async remove(userId, otherId) {
        const [a, b] = pairOf(userId, otherId);
        const i = friendships.findIndex((f) => f.userA === a && f.userB === b);
        if (i >= 0) friendships.splice(i, 1);
      },
    },
    invites: {
      async create(i) {
        const row: DbInvite = { ...i, createdAt: now(), usedBy: null, usedAt: null };
        invites.push(row);
        return { ...row };
      },
      async get(code) {
        const i = invites.find((x) => x.code === code);
        return i ? { ...i } : null;
      },
      async openCount(inviterId) {
        return invites.filter((i) => i.inviterId === inviterId && !i.usedBy).length;
      },
      async use(code, userId) {
        const i = invites.find((x) => x.code === code && !x.usedBy);
        if (!i) return null;
        Object.assign(i, { usedBy: userId, usedAt: now() });
        return { ...i };
      },
    },
    passes: {
      async get(userId) {
        const p = passes.find((x) => x.userId === userId);
        return p ? { ...p } : null;
      },
      async grant(userId, grantedBy) {
        if (passes.some((p) => p.userId === userId)) return false;
        passes.push({ userId, grantedBy, grantedAt: now(), usedAt: null, consumedMatchId: null, consumedCycle: null });
        return true;
      },
      async consume(userId, matchId, cycle) {
        const p = passes.find((x) => x.userId === userId && !x.usedAt);
        if (!p) return null;
        Object.assign(p, { usedAt: now(), consumedMatchId: matchId, consumedCycle: cycle });
        return { ...p };
      },
    },
    leader: {
      // one process holds the memory store: it is always the leader
      async claim(instance, ttlSeconds) {
        return { leader: true, holder: instance, expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString() };
      },
      async release() {},
    },
    reminders: {
      async set(userId, matchId) {
        reminders.add(`${userId}|${matchId}`);
      },
      async remove(userId, matchId) {
        reminders.delete(`${userId}|${matchId}`);
      },
      async listForUser(userId) {
        return [...reminders].filter((k) => k.startsWith(`${userId}|`)).map((k) => k.split("|")[1]);
      },
    },
    content: {
      async get(key) {
        return content.get(key) ?? null;
      },
      async put(key, value, source) {
        content.set(key, { content: value, source, createdAt: now() });
      },
      async list() {
        return [...content.entries()].map(([key, v]) => ({ key, ...v })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      },
    },
    phrases: {
      async listApproved(callType, lang) {
        return phrases.filter((p) => p.approved && p.callType === callType && p.lang === lang).map((p) => p.template);
      },
      async insert(rows) {
        phrases.push(...rows.map((r) => ({ ...r, id: randomUUID(), reviewedBy: null, reviewedAt: null, createdAt: now() })));
      },
      async list() {
        return phrases.map((p) => ({ ...p }));
      },
      async review(ids, approved, reviewer) {
        let n = 0;
        for (const p of phrases) if (ids.includes(p.id)) Object.assign(p, { approved, reviewedBy: reviewer, reviewedAt: now() }, n++);
        return n;
      },
    },
    reports: {
      async create(r) {
        const row: DbReport = { ...r, id: randomUUID(), createdAt: now() };
        reports.push(row);
        return { ...row };
      },
      async list(limit) {
        return [...reports].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
      },
    },
    notifications: {
      async create(rows) {
        for (const r of rows) {
          if (notifications.some((n) => n.dedupeKey === r.dedupeKey)) continue;
          notifications.push({ ...r, id: randomUUID(), createdAt: now(), readAt: null });
        }
      },
      async list(userId, limit) {
        return notifications
          .filter((n) => n.userId === userId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, limit)
          .map((n) => ({ ...n }));
      },
      async unreadCount(userId) {
        return notifications.filter((n) => n.userId === userId && !n.readAt).length;
      },
      async markRead(userId, id) {
        for (const n of notifications) if (n.userId === userId && !n.readAt && (!id || n.id === id)) n.readAt = now();
      },
    },
    settings: {
      async get<T>(key: string) {
        return (settings.has(key) ? structuredClone(settings.get(key)) : null) as T | null;
      },
      async set(key, value) {
        settings.set(key, structuredClone(value));
      },
    },
    admin: {
      async resetDemo(since = "") {
        const seeded = new Set([...users.values()].filter((u) => u.anonId.startsWith("seed:")).map((u) => u.id));
        const keep = (userId: string, at: string) => seeded.has(userId) || at < since;
        const drop = <T>(list: T[], gone: (x: T) => boolean) => {
          const before = list.length;
          const kept = list.filter((x) => !gone(x));
          list.splice(0, list.length, ...kept);
          return before - kept.length;
        };
        // bots, and every fan who isn't seeded (created since `since`): with everything of theirs
        const bots = [...users.values()].filter((u) => u.isBot || (!seeded.has(u.id) && u.createdAt >= since));
        const gone = new Set(bots.map((b) => b.id));
        const before = { friendships: friendships.length, invites: invites.length, passes: passes.length };
        for (const b of bots) users.delete(b.id);
        const out = {
          users: bots.length,
          subscriptions: drop(subscriptions, (x) => gone.has(x.userId) || !keep(x.userId, x.createdAt)),
          redemptions: drop(redemptions, (x) => gone.has(x.userId) || !keep(x.userId, x.createdAt)),
          answers: drop(answers, (a) => gone.has(a.userId) || !keep(a.userId, a.answeredAt)),
          points: drop(points, (p) => gone.has(p.userId) || !keep(p.userId, p.createdAt)),
          notifications: drop(notifications, (n) => gone.has(n.userId) || n.createdAt >= since),
          comments: drop(comments, (c) => (c.userId === null ? c.createdAt >= since : gone.has(c.userId) || !keep(c.userId, c.createdAt))),
          calls: 0,
          roomMembers: 0,
          presence: drop(presence, () => true),
          friendships: 0,
          invites: 0,
          guestPasses: 0,
        };
        dropFans(gone);
        Object.assign(out, { friendships: before.friendships - friendships.length, invites: before.invites - invites.length, guestPasses: before.passes - passes.length });
        for (const [id, c] of calls) {
          if (c.openedAt < since) continue;
          calls.delete(id);
          out.calls++;
        }
        for (const set of members.values()) {
          for (const u of set) {
            if (seeded.has(u)) continue;
            set.delete(u);
            out.roomMembers++;
          }
        }
        return out;
      },
    },
  };
}
