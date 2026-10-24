// in-memory db behind the same interface: tests and DB_MODE=memory. lost on restart
import { randomUUID } from "node:crypto";
import type { Db, DbAnswer, DbCall, DbComment, DbPoints, DbRoom, DbUser } from "./types";

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

  return {
    mode: "memory",
    users: {
      async getByAnonId(anonId) {
        return [...users.values()].find((u) => u.anonId === anonId) ?? null;
      },
      async create(anonId, nickname) {
        const u: DbUser = { id: randomUUID(), anonId, nickname, createdAt: now() };
        users.set(u.id, u);
        return u;
      },
      async setNickname(id, nickname) {
        const u = users.get(id);
        if (u) u.nickname = nickname;
      },
      async getMany(ids) {
        return ids.map((id) => users.get(id)).filter((u): u is DbUser => !!u);
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
  };
}
