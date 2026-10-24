// supabase repositories. server only: uses the service-role (secret) key, which bypasses rls
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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
  type SpendResult,
} from "./types";

type Row = Record<string, unknown>;

const user = (r: Row): DbUser => ({
  id: r.id as string,
  anonId: r.anon_id as string,
  nickname: (r.nickname as string) ?? null,
  createdAt: r.created_at as string,
  isBot: !!r.is_bot,
  language: r.language === "fi" ? "fi" : "en",
  notificationPrefs: { ...DEFAULT_PREFS, ...((r.notification_prefs as object | null) ?? {}) },
});
const notification = (r: Row): DbNotification => ({
  id: r.id as string,
  userId: r.user_id as string,
  type: r.type as string,
  title: r.title as string,
  body: (r.body as string) ?? "",
  link: (r.link as string) ?? null,
  createdAt: r.created_at as string,
  readAt: (r.read_at as string) ?? null,
  dedupeKey: r.dedupe_key as string,
});
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
  i18n: (r.i18n as DbCall["i18n"]) ?? null,
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
    i18n: "i18n",
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
  ref: (r.ref as string) ?? null,
  createdAt: r.created_at as string,
});
const subscription = (r: Row): DbSubscription => {
  const expiresAt = new Date(r.expires_at as string).toISOString();
  const stored = r.status as DbSubscription["status"];
  return {
    id: r.id as string,
    userId: r.user_id as string,
    planId: r.plan_id as string,
    startedAt: new Date(r.started_at as string).toISOString(),
    expiresAt,
    pointsUsed: r.points_used as number,
    demoAmountEur: Number(r.demo_amount_eur),
    // one past its end reads as expired, whatever is stored
    status: stored !== "expired" && Date.parse(expiresAt) <= Date.now() ? "expired" : stored,
    idempotencyKey: r.idempotency_key as string,
    createdAt: new Date(r.created_at as string).toISOString(),
  };
};
const redemption = (r: Row): DbRedemption => ({
  id: r.id as string,
  userId: r.user_id as string,
  offerId: r.offer_id as string,
  pointsUsed: r.points_used as number,
  code: r.code as string,
  createdAt: new Date(r.created_at as string).toISOString(),
});
/** the jsonb a spend function returns, as a SpendResult */
function spendResult<T>(raw: unknown, key: "subscription" | "redemption", map: (r: Row) => T): SpendResult<T> {
  const r = (raw ?? {}) as { status?: string; replayed?: boolean; balance?: number } & Record<string, unknown>;
  if (r.status === "ok") return { status: "ok", replayed: !!r.replayed, balance: Number(r.balance), row: map(r[key] as Row) };
  if (r.status === "insufficient") return { status: "insufficient", balance: Number(r.balance) };
  return { status: r.status === "conflict" ? "conflict" : "invalid" };
}
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
      async create(anonId, nickname, isBot = false) {
        return user(must(await sb.from("users").insert({ anon_id: anonId, nickname, is_bot: isBot }).select().single()));
      },
      async botIds() {
        return must(await sb.from("users").select("id").eq("is_bot", true)).map((r) => r.id as string);
      },
      async setNickname(id, nickname) {
        must(await sb.from("users").update({ nickname }).eq("id", id));
      },
      async update(id, patch) {
        const row = {
          ...(patch.nickname !== undefined && { nickname: patch.nickname }),
          ...(patch.language && { language: patch.language }),
          ...(patch.notificationPrefs && { notification_prefs: patch.notificationPrefs }),
        };
        // an empty patch is no update at all (postgrest returns no row): the user as they are
        if (!Object.keys(row).length) {
          const cur = must(await sb.from("users").select("*").eq("id", id).maybeSingle());
          return cur ? user(cur) : null;
        }
        const r = must(await sb.from("users").update(row).eq("id", id).select().maybeSingle());
        return r ? user(r) : null;
      },
      async remove(id) {
        must(await sb.from("users").delete().eq("id", id));
      },
      async getMany(ids) {
        if (!ids.length) return [];
        return must(await sb.from("users").select("*").in("id", ids)).map(user);
      },
    },
    favorites: {
      async list(userId) {
        return must(await sb.from("user_favorites").select("team_id").eq("user_id", userId).order("created_at")).map((r) => r.team_id as string);
      },
      async set(userId, teamId, on) {
        if (on) must(await sb.from("user_favorites").upsert({ user_id: userId, team_id: teamId }, { onConflict: "user_id,team_id", ignoreDuplicates: true }));
        else must(await sb.from("user_favorites").delete().eq("user_id", userId).eq("team_id", teamId));
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
      async getMany(ids) {
        if (!ids.length) return [];
        return must(await sb.from("calls").select("*").in("id", ids)).map(call);
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
      async recentForUser(userId, limit) {
        return must(await sb.from("answers").select("*").eq("user_id", userId).order("answered_at", { ascending: false }).limit(limit)).map(answer);
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
          ...(e.ref && { ref: e.ref }),
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
    wallet: {
      async balance(userId) {
        return must(await sb.from("points_ledger").select("points").eq("user_id", userId)).reduce((a, r) => a + (r.points as number), 0);
      },
      // both spends are postgres functions: one transaction behind pg_advisory_xact_lock per fan
      async purchase(p) {
        const res = await sb.rpc("purchase_subscription", {
          p_user: p.userId,
          p_plan: p.planId,
          p_points: p.points,
          p_amount_eur: p.amountEur,
          p_days: p.days,
          p_key: p.idempotencyKey,
        });
        return spendResult(must(res), "subscription", subscription);
      },
      async subscriptions(userId) {
        return must(await sb.from("user_subscriptions").select("*").eq("user_id", userId).order("created_at", { ascending: false })).map(subscription);
      },
      async cancel(userId, planId) {
        const res = await sb
          .from("user_subscriptions")
          .update({ status: "cancelled" }, { count: "exact" })
          .eq("user_id", userId)
          .eq("plan_id", planId)
          .eq("status", "active")
          .gt("expires_at", new Date().toISOString());
        if (res.error) throw new Error(`supabase: ${res.error.message}`);
        return res.count ?? 0;
      },
      async redeem(p) {
        const res = await sb.rpc("redeem_offer", { p_user: p.userId, p_offer: p.offerId, p_points: p.points, p_code: p.code });
        return spendResult(must(res), "redemption", redemption);
      },
      async redemptions(userId) {
        return must(await sb.from("offer_redemptions").select("*").eq("user_id", userId)).map(redemption);
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
    notifications: {
      async create(rows) {
        if (!rows.length) return;
        const values = rows.map((r) => ({ user_id: r.userId, type: r.type, title: r.title, body: r.body, link: r.link, dedupe_key: r.dedupeKey }));
        must(await sb.from("notifications").upsert(values, { onConflict: "dedupe_key", ignoreDuplicates: true }));
      },
      async list(userId, limit) {
        return must(await sb.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(limit)).map(
          notification,
        );
      },
      async unreadCount(userId) {
        const res = await sb.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null);
        if (res.error) throw new Error(`supabase: ${res.error.message}`);
        return res.count ?? 0;
      },
      async markRead(userId, id) {
        let q = sb.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", userId).is("read_at", null);
        if (id) q = q.eq("id", id);
        must(await q);
      },
    },
    settings: {
      async get<T>(key: string) {
        const r = must(await sb.from("settings").select("value").eq("key", key).maybeSingle()) as Row | null;
        return (r?.value ?? null) as T | null;
      },
      async set(key, value) {
        must(await sb.from("settings").upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" }));
      },
    },
    admin: {
      async resetDemo(since = "1970-01-01T00:00:00Z") {
        const seeded = must(await sb.from("users").select("id").like("anon_id", "seed:%")).map((r) => r.id as string);
        const notSeeded = `(${seeded.join(",")})`;
        // supabase refuses a delete without a filter, so every one carries a time or id filter
        const count = async (q: PromiseLike<{ error: { message: string } | null; count: number | null }>) => {
          const res = await q;
          if (res.error) throw new Error(`supabase: ${res.error.message}`);
          return res.count ?? 0;
        };
        const unseeded = <Q,>(q: Q): Q => (seeded.length ? (q as unknown as { not(c: string, op: string, v: string): Q }).not("user_id", "in", notSeeded) : q);
        const out: Record<string, number> = {};
        out.users = await count(sb.from("users").delete({ count: "exact" }).eq("is_bot", true));
        // every fan who isn't seeded goes, with everything of theirs (cascade): a returning
        // browser starts as a new fan, welcome balance included
        out.users += await count(sb.from("users").delete({ count: "exact" }).not("anon_id", "like", "seed:%").gte("created_at", since));
        out.answers = await count(unseeded(sb.from("answers").delete({ count: "exact" }).gte("answered_at", since)));
        out.points = await count(unseeded(sb.from("points_ledger").delete({ count: "exact" }).gte("created_at", since)));
        out.notifications = await count(sb.from("notifications").delete({ count: "exact" }).gte("created_at", since));
        out.comments = await count(unseeded(sb.from("comments").delete({ count: "exact" }).gte("created_at", since)));
        out.calls = await count(sb.from("calls").delete({ count: "exact" }).gte("opened_at", since));
        out.roomMembers = await count(unseeded(sb.from("room_members").delete({ count: "exact" }).gte("joined_at", "1970-01-01T00:00:00Z")));
        return out;
      },
    },
  };
}
