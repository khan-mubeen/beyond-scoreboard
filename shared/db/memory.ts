// in-memory db behind the same interface: tests and DB_MODE=memory. lost on restart
import { randomUUID } from "node:crypto";
import {
  DEFAULT_PREFS,
  type Db,
  type DbAnswer,
  type DbCall,
  type DbComment,
  type DbNotification,
  type DbPoints,
  type DbRedemption,
  type DbRoom,
  type DbSubscription,
  type DbUser,
} from "./types";

const now = () => new Date().toISOString();

export function createMemoryDb(): Db {
  const users = new Map<string, DbUser>();
  const rooms = new Map<string, DbRoom>();
  const members = new Map<string, Set<string>>();
  const calls = new Map<string, DbCall>();
  const answers: DbAnswer[] = [];
  const points: DbPoints[] = [];
  const comments: DbComment[] = [];
  const likes = new Set<string>();
  const reminders = new Set<string>();
  const content = new Map<string, { content: unknown; source: "template" | "llm" }>();
  const phrases: { callType: string; lang: string; template: string; approved: boolean }[] = [];
  const notifications: DbNotification[] = [];
  const settings = new Map<string, unknown>();
  const favorites = new Map<string, Set<string>>();
  const subscriptions: DbSubscription[] = [];
  const redemptions: DbRedemption[] = [];

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
        favorites.delete(id);
        for (const list of [answers, points, comments, notifications, subscriptions, redemptions] as { userId: string }[][]) {
          const kept = list.filter((x) => x.userId !== id);
          list.splice(0, list.length, ...kept);
        }
        for (const set of members.values()) set.delete(id);
      },
      async getMany(ids) {
        return ids.map((id) => users.get(id)).filter((u): u is DbUser => !!u);
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
        return [...calls.values()].filter((c) => c.matchId === matchId).sort((a, b) => a.openedAt.localeCompare(b.openedAt));
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
        const row: DbComment = { ...c, id: randomUUID(), createdAt: now(), hidden: false, likes: 0 };
        comments.push(row);
        return { ...row };
      },
      async get(id) {
        return comments.find((c) => c.id === id) ?? null;
      },
      async list(matchId, limit) {
        return comments
          .filter((c) => c.matchId === matchId && !c.hidden)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, limit)
          .map((c) => ({ ...c }));
      },
      async like(commentId, userId) {
        const k = `${commentId}:${userId}`;
        if (likes.has(k)) return "duplicate";
        likes.add(k);
        const c = comments.find((x) => x.id === commentId);
        if (c) c.likes++;
        return "ok";
      },
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
        content.set(key, { content: value, source });
      },
    },
    phrases: {
      async listApproved(callType, lang) {
        return phrases.filter((p) => p.approved && p.callType === callType && p.lang === lang).map((p) => p.template);
      },
      async insert(rows) {
        phrases.push(...rows);
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
        for (const b of bots) {
          users.delete(b.id);
          favorites.delete(b.id);
        }
        const gone = new Set(bots.map((b) => b.id));
        const out = {
          users: bots.length,
          subscriptions: drop(subscriptions, (x) => gone.has(x.userId) || !keep(x.userId, x.createdAt)),
          redemptions: drop(redemptions, (x) => gone.has(x.userId) || !keep(x.userId, x.createdAt)),
          answers: drop(answers, (a) => gone.has(a.userId) || !keep(a.userId, a.answeredAt)),
          points: drop(points, (p) => gone.has(p.userId) || !keep(p.userId, p.createdAt)),
          notifications: drop(notifications, (n) => gone.has(n.userId) || n.createdAt >= since),
          comments: drop(comments, (c) => gone.has(c.userId) || !keep(c.userId, c.createdAt)),
          calls: 0,
          roomMembers: 0,
        };
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
