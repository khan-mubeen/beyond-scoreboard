// supabase repositories. server only: uses the service-role (secret) key, which bypasses rls
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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
  type DbPoints,
  type DbPresence,
  type DbRedemption,
  type DbReport,
  type DbRoom,
  type DbSubscription,
  type DbUser,
  type FeedKind,
  type NewComment,
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
const report = (r: Row): DbReport => ({
  id: r.id as string,
  refKind: r.ref_kind as DbReport["refKind"],
  refKey: r.ref_key as string,
  matchId: (r.match_id as string) ?? null,
  message: r.message as string,
  userId: (r.user_id as string) ?? null,
  createdAt: r.created_at as string,
});
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
  userId: (r.user_id as string) ?? null,
  text: r.text as string,
  createdAt: new Date(r.created_at as string).toISOString(),
  hidden: r.hidden as boolean,
  likes: ((r.comment_likes as { count: number }[] | undefined)?.[0]?.count as number) ?? 0,
  kind: ((r.kind as FeedKind) ?? "chat") as FeedKind,
  cycle: (r.cycle as string) ?? "",
  data: (r.data as Record<string, unknown> | null) ?? null,
});
const commentRow = (c: NewComment) => ({ match_id: c.matchId, user_id: c.userId, text: c.text, kind: c.kind ?? "chat", cycle: c.cycle ?? "", data: c.data ?? null });
const presenceOf = (r: Row): DbPresence => ({
  matchId: r.match_id as string,
  cycle: r.cycle as string,
  userId: r.user_id as string,
  joinedAt: new Date(r.joined_at as string).toISOString(),
  lastSeen: new Date(r.last_seen as string).toISOString(),
});
const friendship = (r: Row): DbFriendship => ({
  userA: r.user_a as string,
  userB: r.user_b as string,
  status: r.status as DbFriendship["status"],
  requestedBy: r.requested_by as string,
  createdAt: r.created_at as string,
});
const invite = (r: Row): DbInvite => ({
  code: r.code as string,
  inviterId: r.inviter_id as string,
  matchId: (r.match_id as string) ?? null,
  createdAt: r.created_at as string,
  usedBy: (r.used_by as string) ?? null,
  usedAt: (r.used_at as string) ?? null,
});
const pass = (r: Row): DbGuestPass => ({
  userId: r.user_id as string,
  grantedBy: (r.granted_by as string) ?? null,
  grantedAt: r.granted_at as string,
  usedAt: (r.used_at as string) ?? null,
  consumedMatchId: (r.consumed_match_id as string) ?? null,
  consumedCycle: (r.consumed_cycle as string) ?? null,
});
const pairOf = (a: string, b: string): [string, string] => (a < b ? [a, b] : [b, a]);
/** a presence row this new was made by this heartbeat (the database clock runs a little apart from ours) */
const JUST_JOINED_MS = 5000;

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
      async getByFriendCode(code) {
        const r = must(await sb.from("users").select("*").eq("friend_code", code).maybeSingle());
        return r ? user(r) : null;
      },
      async setFriendCode(id, code) {
        const res = await sb.from("users").update({ friend_code: code }).eq("id", id);
        if (res.error?.code === UNIQUE_VIOLATION) return false;
        must(res);
        return true;
      },
      async friendCode(id) {
        const r = must(await sb.from("users").select("friend_code").eq("id", id).maybeSingle()) as Row | null;
        return (r?.friend_code as string) ?? null;
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
      async createOnce(c) {
        // one transaction behind a lock on (match, trigger): create_call_once
        const r = must(await sb.rpc("create_call_once", { p_call: callRow(c) })) as Row;
        return { call: call(r), created: r.created === true };
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
        return comment(must(await sb.from("comments").insert(commentRow(c)).select().single()));
      },
      async createOnce(c, dedupeKey) {
        const res = await sb.from("comments").insert({ ...commentRow(c), dedupe_key: dedupeKey }).select().single();
        if (res.error?.code === UNIQUE_VIOLATION) return null;
        return comment(must(res));
      },
      async get(id) {
        const r = must(await sb.from("comments").select("*, comment_likes(count)").eq("id", id).maybeSingle());
        return r ? comment(r) : null;
      },
      async list(matchId, limit, opts = {}) {
        let q = sb
          .from("comments")
          .select("*, comment_likes(count)")
          .eq("match_id", matchId)
          .eq("hidden", false)
          .in("kind", opts.kinds ?? ["chat", "system", "fact", "trivia"]);
        if (opts.cycle !== undefined) q = q.eq("cycle", opts.cycle);
        return must(await q.order("created_at", { ascending: false }).limit(limit)).map(comment);
      },
      async since(matchId, cycle, iso, kinds) {
        return must(
          await sb.from("comments").select("*").eq("match_id", matchId).eq("cycle", cycle).in("kind", kinds).gte("created_at", iso).order("created_at").limit(100),
        ).map(comment);
      },
      async like(commentId, userId) {
        const res = await sb.from("comment_likes").insert({ comment_id: commentId, user_id: userId });
        if (res.error?.code === UNIQUE_VIOLATION) return "duplicate";
        must(res);
        return "ok";
      },
      async react(commentId, userId, emoji) {
        const res = await sb.from("comment_reactions").insert({ comment_id: commentId, user_id: userId, emoji });
        if (res.error?.code === UNIQUE_VIOLATION) return "duplicate";
        must(res);
        return "ok";
      },
      async reactions(commentIds) {
        if (!commentIds.length) return [];
        return must(await sb.from("comment_reactions").select("comment_id, user_id, emoji").in("comment_id", commentIds)).map((r) => ({
          commentId: r.comment_id as string,
          userId: r.user_id as string,
          emoji: r.emoji as string,
        }));
      },
    },
    presence: {
      // one round trip: the upsert says when the fan joined. a row made just now is a new fan in
      // the party (fresh); one back after a timeout reaches the board on the leader's next read
      async beat(matchId, cycle, userId, at = new Date().toISOString()) {
        const r = must(
          await sb.from("party_presence").upsert({ match_id: matchId, cycle, user_id: userId, last_seen: at }, { onConflict: "match_id,cycle,user_id" }).select("joined_at").single(),
        ) as Row;
        return { fresh: Math.abs(Date.parse(at) - Date.parse(r.joined_at as string)) < JUST_JOINED_MS };
      },
      async leave(matchId, cycle, userId) {
        must(await sb.from("party_presence").update({ last_seen: new Date(0).toISOString() }).eq("match_id", matchId).eq("cycle", cycle).eq("user_id", userId));
      },
      async list(matchId, cycle) {
        return must(await sb.from("party_presence").select("*").eq("match_id", matchId).eq("cycle", cycle).limit(2000)).map(presenceOf);
      },
      async seenSince(userIds, iso) {
        if (!userIds.length) return [];
        return must(await sb.from("party_presence").select("*").in("user_id", userIds).gte("last_seen", iso).order("last_seen", { ascending: false })).map(presenceOf);
      },
    },
    friends: {
      async list(userId) {
        return must(await sb.from("friendships").select("*").or(`user_a.eq.${userId},user_b.eq.${userId}`)).map(friendship);
      },
      async request(from, to) {
        const [a, b] = pairOf(from, to);
        const res = await sb.from("friendships").insert({ user_a: a, user_b: b, status: "pending", requested_by: from });
        if (res.error?.code === UNIQUE_VIOLATION) return "exists";
        must(res);
        return "requested";
      },
      async accept(userId, otherId) {
        const [a, b] = pairOf(userId, otherId);
        const rows = must(
          await sb.from("friendships").update({ status: "accepted" }).eq("user_a", a).eq("user_b", b).eq("status", "pending").eq("requested_by", otherId).select(),
        );
        return rows.length > 0;
      },
      async connect(x, y, requestedBy) {
        const [a, b] = pairOf(x, y);
        must(await sb.from("friendships").upsert({ user_a: a, user_b: b, status: "accepted", requested_by: requestedBy }, { onConflict: "user_a,user_b" }));
      },
      async remove(userId, otherId) {
        const [a, b] = pairOf(userId, otherId);
        must(await sb.from("friendships").delete().eq("user_a", a).eq("user_b", b));
      },
    },
    invites: {
      async create(i) {
        return invite(must(await sb.from("invites").insert({ code: i.code, inviter_id: i.inviterId, match_id: i.matchId }).select().single()));
      },
      async get(code) {
        const r = must(await sb.from("invites").select("*").eq("code", code).maybeSingle());
        return r ? invite(r) : null;
      },
      async openCount(inviterId) {
        const res = await sb.from("invites").select("code", { count: "exact", head: true }).eq("inviter_id", inviterId).is("used_by", null);
        if (res.error) throw new Error(`supabase: ${res.error.message}`);
        return res.count ?? 0;
      },
      async use(code, userId) {
        // one statement: only an unused invite is marked, so two visitors can't both use it
        const rows = must(await sb.from("invites").update({ used_by: userId, used_at: new Date().toISOString() }).eq("code", code).is("used_by", null).select());
        return rows.length ? invite(rows[0]) : null;
      },
    },
    passes: {
      async get(userId) {
        const r = must(await sb.from("guest_passes").select("*").eq("user_id", userId).maybeSingle());
        return r ? pass(r) : null;
      },
      async grant(userId, grantedBy) {
        const res = await sb.from("guest_passes").insert({ user_id: userId, granted_by: grantedBy });
        if (res.error?.code === UNIQUE_VIOLATION) return false;
        must(res);
        return true;
      },
      async consume(userId, matchId, cycle) {
        const rows = must(
          await sb
            .from("guest_passes")
            .update({ used_at: new Date().toISOString(), consumed_match_id: matchId, consumed_cycle: cycle })
            .eq("user_id", userId)
            .is("used_at", null)
            .select(),
        );
        return rows.length ? pass(rows[0]) : null;
      },
    },
    leader: {
      // claim_engine_leader: one atomic compare-and-set on the settings row (see the migration)
      async claim(instance, ttlSeconds) {
        const r = must(await sb.rpc("claim_engine_leader", { p_instance: instance, p_ttl_seconds: ttlSeconds })) as Row;
        return { leader: !!r.leader, holder: (r.instance as string) ?? null, expiresAt: (r.expiresAt as string) ?? null };
      },
      async release(instance) {
        must(await sb.rpc("release_engine_leader", { p_instance: instance }));
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
      async list() {
        return (must(await sb.from("content_cache").select("*").order("created_at", { ascending: false }).limit(500)) as Row[]).map((r) => ({
          key: r.key as string,
          content: r.content,
          source: r.source as "template" | "llm",
          createdAt: r.created_at as string,
        }));
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
      async list() {
        return (must(await sb.from("phrase_bank").select("*").order("created_at")) as Row[]).map((r) => ({
          id: r.id as string,
          callType: r.call_type as string,
          lang: r.lang as string,
          template: r.template as string,
          approved: r.approved as boolean,
          reviewedBy: (r.reviewed_by as string) ?? null,
          reviewedAt: (r.reviewed_at as string) ?? null,
          createdAt: r.created_at as string,
        }));
      },
      async review(ids, approved, reviewer) {
        if (!ids.length) return 0;
        const rows = must(await sb.from("phrase_bank").update({ approved, reviewed_by: reviewer, reviewed_at: new Date().toISOString() }).in("id", ids).select("id")) as Row[];
        return rows.length;
      },
    },
    reports: {
      async create(r) {
        const row = must(
          await sb.from("content_reports").insert({ ref_kind: r.refKind, ref_key: r.refKey, match_id: r.matchId, message: r.message, user_id: r.userId }).select().single(),
        ) as Row;
        return report(row);
      },
      async list(limit) {
        return (must(await sb.from("content_reports").select("*").order("created_at", { ascending: false }).limit(limit)) as Row[]).map(report);
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
        // system lines (goals, results) have no author: they go with the rest of the feed
        out.comments += await count(sb.from("comments").delete({ count: "exact" }).is("user_id", null).gte("created_at", since));
        // a fresh party: nobody is in one. friendships, invites and passes of the fans above went
        // with them (on delete cascade)
        out.presence = await count(sb.from("party_presence").delete({ count: "exact" }).gte("joined_at", "1970-01-01T00:00:00Z"));
        return out;
      },
    },
  };
}
