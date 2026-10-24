// supabase repositories. server only: uses the service-role (secret) key, which bypasses rls
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Db, DbAnswer, DbCall, DbComment, DbPoints, DbRoom, DbUser } from "./types";

type Row = Record<string, unknown>;

const user = (r: Row): DbUser => ({ id: r.id as string, anonId: r.anon_id as string, nickname: (r.nickname as string) ?? null, createdAt: r.created_at as string });
const room = (r: Row): DbRoom => ({ id: r.id as string, matchId: r.match_id as string, code: r.code as string, createdAt: r.created_at as string });
const call = (r: Row): DbCall => ({
  id: r.id as string,
  matchId: r.match_id as string,
  type: r.type as string,
  trigger: r.trigger as string,
  question: r.question as string,
  options: r.options as DbCall["options"],
  stakesLine: (r.stakes_line as string) ?? null,
  openedGameTime: r.opened_game_time as number,
  openedAt: r.opened_at as string,
  locksAt: r.locks_at as string,
  lockGameTime: (r.lock_game_time as number) ?? null,
  resolvesRule: r.resolves_rule as DbCall["resolvesRule"],
  status: r.status as DbCall["status"],
  correctOptionId: (r.correct_option_id as string) ?? null,
  resolvedAt: (r.resolved_at as string) ?? null,
});
const callRow = (c: Partial<Omit<DbCall, "id">>): Row => {
  const map: Record<string, string> = {
    matchId: "match_id",
    type: "type",
    trigger: "trigger",
    question: "question",
    options: "options",
    stakesLine: "stakes_line",
    openedGameTime: "opened_game_time",
    openedAt: "opened_at",
    locksAt: "locks_at",
    lockGameTime: "lock_game_time",
    resolvesRule: "resolves_rule",
    status: "status",
    correctOptionId: "correct_option_id",
    resolvedAt: "resolved_at",
  };
  return Object.fromEntries(Object.entries(c).map(([k, v]) => [map[k] ?? k, v]));
};
const answer = (r: Row): DbAnswer => ({
  id: r.id as string,
  callId: r.call_id as string,
  userId: r.user_id as string,
  optionId: r.option_id as string,
  answeredAt: r.answered_at as string,
  correct: (r.correct as boolean) ?? null,
});
const pts = (r: Row): DbPoints => ({
  id: r.id as string,
  userId: r.user_id as string,
  matchId: (r.match_id as string) ?? null,
  callId: (r.call_id as string) ?? null,
  points: r.points as number,
  reason: r.reason as string,
  createdAt: r.created_at as string,
});
const comment = (r: Row): DbComment => ({
  id: r.id as string,
  matchId: r.match_id as string,
  userId: r.user_id as string,
  text: r.text as string,
  createdAt: r.created_at as string,
  hidden: r.hidden as boolean,
  likes: ((r.comment_likes as { count: number }[] | undefined)?.[0]?.count as number) ?? 0,
});

const UNIQUE_VIOLATION = "23505";

function must<T>(res: { data: T | null; error: { message: string; code?: string } | null }): T {
  if (res.error) throw new Error(`supabase: ${res.error.message}`);
  return res.data as T;
}

export function supabaseAdmin(url: string, secretKey: string): SupabaseClient {
  return createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function createSupabaseDb(sb: SupabaseClient): Db {
  return {
    mode: "supabase",
    users: {
      async getByAnonId(anonId) {
        const r = must(await sb.from("users").select("*").eq("anon_id", anonId).maybeSingle());
        return r ? user(r) : null;
      },
      async create(anonId, nickname) {
        return user(must(await sb.from("users").insert({ anon_id: anonId, nickname }).select().single()));
      },
      async setNickname(id, nickname) {
        must(await sb.from("users").update({ nickname }).eq("id", id));
      },
      async getMany(ids) {
        if (!ids.length) return [];
        return must(await sb.from("users").select("*").in("id", ids)).map(user);
      },
    },
    rooms: {
      async getByCode(code) {
        const r = must(await sb.from("match_rooms").select("*").eq("code", code).maybeSingle());
        return r ? room(r) : null;
      },
      async getOrCreateForMatch(matchId, code) {
        const found = must(await sb.from("match_rooms").select("*").eq("match_id", matchId).order("created_at").limit(1));
        if (found.length) return room(found[0]);
        const res = await sb.from("match_rooms").insert({ match_id: matchId, code }).select().single();
        if (res.error?.code === UNIQUE_VIOLATION) return room(must(await sb.from("match_rooms").select("*").eq("code", code).single()));
        return room(must(res));
      },
      async join(roomId, userId) {
        must(await sb.from("room_members").upsert({ room_id: roomId, user_id: userId }, { onConflict: "room_id,user_id", ignoreDuplicates: true }));
      },
      async members(roomId) {
        return must(await sb.from("room_members").select("user_id").eq("room_id", roomId)).map((r) => r.user_id as string);
      },
    },
    calls: {
      async create(c) {
        return call(must(await sb.from("calls").insert(callRow(c)).select().single()));
      },
      async update(id, patch) {
        const r = must(await sb.from("calls").update(callRow(patch)).eq("id", id).select().maybeSingle());
        return r ? call(r) : null;
      },
      async get(id) {
        const r = must(await sb.from("calls").select("*").eq("id", id).maybeSingle());
        return r ? call(r) : null;
      },
      async listForMatch(matchId) {
        return must(await sb.from("calls").select("*").eq("match_id", matchId).order("opened_at")).map(call);
      },
    },
    answers: {
      async create(a) {
        const res = await sb.from("answers").insert({ call_id: a.callId, user_id: a.userId, option_id: a.optionId, answered_at: a.answeredAt });
        if (res.error?.code === UNIQUE_VIOLATION) return "duplicate";
        must(res);
        return "ok";
      },
      async listForCall(callId) {
        return must(await sb.from("answers").select("*").eq("call_id", callId)).map(answer);
      },
      async listForUser(userId, callIds) {
        if (!callIds.length) return [];
        return must(await sb.from("answers").select("*").eq("user_id", userId).in("call_id", callIds)).map(answer);
      },
      async setCorrect(callId, correctOptionId) {
        must(await sb.from("answers").update({ correct: true }).eq("call_id", callId).eq("option_id", correctOptionId));
        must(await sb.from("answers").update({ correct: false }).eq("call_id", callId).neq("option_id", correctOptionId));
      },
    },
    points: {
      async award(e) {
        const res = await sb.from("points_ledger").insert({
          user_id: e.userId,
          match_id: e.matchId,
          call_id: e.callId,
          points: e.points,
          reason: e.reason,
          ...(e.createdAt && { created_at: e.createdAt }),
        });
        if (res.error?.code === UNIQUE_VIOLATION) return false;
        must(res);
        return true;
      },
      async listForUser(userId) {
        return must(await sb.from("points_ledger").select("*").eq("user_id", userId)).map(pts);
      },
      async listSince(iso, matchId) {
        let q = sb.from("points_ledger").select("*").gte("created_at", iso);
        if (matchId) q = q.eq("match_id", matchId);
        return must(await q.limit(10_000)).map(pts);
      },
    },
    comments: {
      async create(c) {
        return comment(must(await sb.from("comments").insert({ match_id: c.matchId, user_id: c.userId, text: c.text }).select().single()));
      },
      async get(id) {
        const r = must(await sb.from("comments").select("*, comment_likes(count)").eq("id", id).maybeSingle());
        return r ? comment(r) : null;
      },
      async list(matchId, limit) {
        return must(
          await sb
            .from("comments")
            .select("*, comment_likes(count)")
            .eq("match_id", matchId)
            .eq("hidden", false)
            .order("created_at", { ascending: false })
            .limit(limit),
        ).map(comment);
      },
      async like(commentId, userId) {
        const res = await sb.from("comment_likes").insert({ comment_id: commentId, user_id: userId });
        if (res.error?.code === UNIQUE_VIOLATION) return "duplicate";
        must(res);
        return "ok";
      },
    },
    reminders: {
      async set(userId, matchId) {
        must(await sb.from("reminders").upsert({ user_id: userId, match_id: matchId }, { onConflict: "user_id,match_id", ignoreDuplicates: true }));
      },
      async remove(userId, matchId) {
        must(await sb.from("reminders").delete().eq("user_id", userId).eq("match_id", matchId));
      },
      async listForUser(userId) {
        return must(await sb.from("reminders").select("match_id").eq("user_id", userId)).map((r) => r.match_id as string);
      },
    },
    content: {
      async get(key) {
        const r = must(await sb.from("content_cache").select("*").eq("key", key).maybeSingle()) as Row | null;
        return r ? { content: r.content, source: r.source as "template" | "llm" } : null;
      },
      async put(key, value, source) {
        must(await sb.from("content_cache").upsert({ key, content: value, source, created_at: new Date().toISOString() }, { onConflict: "key" }));
      },
    },
    phrases: {
      async listApproved(callType, lang) {
        return must(await sb.from("phrase_bank").select("template").eq("call_type", callType).eq("lang", lang).eq("approved", true)).map(
          (r) => r.template as string,
        );
      },
      async insert(rows) {
        if (!rows.length) return;
        must(await sb.from("phrase_bank").insert(rows.map((r) => ({ call_type: r.callType, lang: r.lang, template: r.template, approved: r.approved }))));
      },
    },
  };
}
