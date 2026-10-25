// the only place site screens get data from: /api/site/*, through a tiny shared cache
// (stale-while-revalidate, in memory, keyed by url). a page you visited shows its last good data
// at once and refreshes in the background. mock data only with VITE_USE_MOCKS=true: never as a
// first paint, never as a silent fallback. a failed request is an "error" state
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type {
  Burst,
  Comment,
  DataSource,
  FactCard,
  FriendsPageData,
  InviteCreated,
  InviteInfo,
  HomePage,
  LeaderboardPageData,
  LeaderboardScope,
  MatchDetail,
  MatchPrediction,
  PointsBreakdown,
  MeResponse,
  MyCallsData,
  NotificationsResponse,
  OfferResult,
  ProfileData,
  RewardsPage,
  RotationInfo,
  SubscriptionResult,
  TeamPageData,
  TeamsPageData,
} from "@/shared/types";

export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === "true";
/** the two pages from the design, only with VITE_USE_MOCKS=true */
export const MOCK_MATCH_IDS = ["karpat-assat-live", "karpat-assat-final"];

export type Status = "loading" | "ready" | "notfound" | "error";

export interface Resource<T> {
  data: T | null;
  status: Status;
  source: DataSource | null;
  asOf: string | null;
  /** fetch again; the current data stays on screen meanwhile */
  refresh: () => void;
}

interface Entry {
  data: unknown;
  status: Status;
  source: DataSource | null;
  asOf: string | null;
  inflight: Promise<void> | null;
}

type Mock = () => Promise<unknown>;

// the server's clock: countdowns and the highlight sync run on it, not on the device's
let serverOffset = 0;
/** a server time seen in a response (ms epoch) */
export function noteServerNow(ms: number) {
  serverOffset = ms - Date.now();
}
/** now on the server's clock (ms) */
export const serverNowMs = () => Date.now() + serverOffset;

/** server time, ticking every `ms` (countdowns) */
export function useServerNow(ms = 1000): number {
  const [now, setNow] = useState(serverNowMs);
  useEffect(() => {
    const t = setInterval(() => setNow(serverNowMs()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

const EMPTY: Entry = { data: null, status: "loading", source: null, asOf: null, inflight: null };
const cache = new Map<string, Entry>();
const listeners = new Map<string, Set<() => void>>();
const subscribers = new Map<string, (cb: () => void) => () => void>();
const mocks = new Map<string, Mock>();

function put(url: string, patch: Partial<Entry>) {
  cache.set(url, { ...(cache.get(url) ?? EMPTY), ...patch });
  for (const cb of listeners.get(url) ?? []) cb();
}

/** fetches a url into the cache (one request at a time per url) */
export function load(url: string): Promise<void> {
  const current = cache.get(url);
  if (current?.inflight) return current.inflight;
  const mock = mocks.get(url);
  const request = async () => {
    if (USE_MOCKS) {
      const data = mock ? await mock() : null;
      return put(url, { data, status: data ? "ready" : "notfound", source: data ? "mock" : null, asOf: null });
    }
    // tv mode sends the host's token: the host's screen always shows the live stream
    const host = url.includes("tv=1") ? readHostToken() : "";
    const r = await fetch(url, { credentials: "same-origin", cache: "no-store", ...(host && { headers: { "x-host-token": host } }) });
    if (r.status === 404) return put(url, { data: null, status: "notfound" });
    if (!r.ok) throw new Error(`http ${r.status}`);
    const body = (await r.json()) as { source?: DataSource; asOf?: string; serverNow?: number };
    if (typeof body.serverNow === "number") noteServerNow(body.serverNow);
    put(url, { data: body, status: "ready", source: body.source ?? "live", asOf: body.asOf ?? null });
  };
  const inflight = request()
    // keep the last good data on a failed refresh; only a first load becomes an error
    .catch(() => put(url, cache.get(url)?.data ? {} : { status: "error" }))
    .finally(() => put(url, { inflight: null }));
  put(url, { inflight });
  return inflight;
}

/** what the cache holds for a url (tests) */
export const readCache = (url: string) => {
  const e = cache.get(url);
  return e ? { data: e.data, status: e.status, source: e.source } : null;
};

/** invalidate every cached url that starts with a prefix (all match pages after a purchase) */
export function invalidatePrefix(prefix: string) {
  for (const url of [...cache.keys()]) if (url.startsWith(prefix)) invalidate(url);
}

/** refetch a url if a screen shows it, else forget it so the next visit loads it fresh */
export function invalidate(url: string) {
  if (listeners.get(url)?.size) void load(url);
  else cache.delete(url);
}

/** an optimistic change to cached data, before the server confirms it */
export function setData<T>(url: string, update: (old: T | null) => T) {
  put(url, { data: update((cache.get(url)?.data as T) ?? null), status: "ready" });
}

function subscribe(url: string) {
  let fn = subscribers.get(url);
  if (!fn) {
    fn = (cb) => {
      const set = listeners.get(url) ?? new Set();
      listeners.set(url, set);
      set.add(cb);
      return () => set.delete(cb);
    };
    subscribers.set(url, fn);
  }
  return fn;
}
const noop = () => () => {};

/** a cached GET. refreshMs polls while the screen is open */
export function useQuery<T>(url: string | null, opts: { refreshMs?: number; mock?: Mock } = {}): Resource<T> {
  if (url && opts.mock && !mocks.has(url)) mocks.set(url, opts.mock);
  const entry = useSyncExternalStore(
    url ? subscribe(url) : noop,
    () => (url ? (cache.get(url) ?? EMPTY) : EMPTY),
    () => EMPTY,
  );
  const { refreshMs } = opts;
  useEffect(() => {
    if (!url) return;
    void load(url);
    if (!refreshMs) return;
    const t = setInterval(() => void load(url), refreshMs);
    return () => clearInterval(t);
  }, [url, refreshMs]);
  const refresh = useCallback(() => {
    if (url) void load(url);
  }, [url]);
  return { data: entry.data as T | null, status: entry.status, source: entry.source, asOf: entry.asOf, refresh };
}

// ---------- mocks (VITE_USE_MOCKS=true only) ----------

const mockModule = () => import("@/shared/mock/site");
const mockMatch = (id: string) => async () => {
  if (!MOCK_MATCH_IDS.includes(id)) return null;
  const m = await mockModule();
  return id === "karpat-assat-live" ? m.mockMatchLive : m.mockMatchFinal;
};
const mockMe = async (): Promise<MeResponse> => {
  const chrome = (await import("@/shared/mock/site/chrome.json")).default;
  return {
    user: chrome.user,
    joined: true,
    nickname: chrome.user.name,
    language: "en",
    favorites: chrome.favorites,
    unreadNotifications: 0,
    openCallAnswers: {},
    wallet: { balance: chrome.user.points },
    plans: [],
    follows: [],
    notificationPrefs: { callResults: true, favoriteReminders: true, favoriteResults: true },
    demo: null,
    asOf: "",
    source: "mock",
  };
};

// ---------- pages ----------

export const ME_URL = "/api/site/me";
export const NOTIFICATIONS_URL = "/api/site/notifications";

export const useMe = () => useQuery<MeResponse>(ME_URL, { mock: mockMe });
export const useHomePage = () => useQuery<HomePage>("/api/site/home", { mock: async () => (await mockModule()).mockHome });
export const useRewardsPage = () => useQuery<RewardsPage>("/api/site/rewards", { mock: async () => (await mockModule()).mockRewards });
export const useMatchDetail = (id: string, opts: { tv?: boolean } = {}) =>
  useQuery<MatchDetail>(`/api/site/matches/${encodeURIComponent(id)}${opts.tv ? "?tv=1" : ""}`, { mock: mockMatch(id) });
export const useLeaderboard = (scope: LeaderboardScope) => useQuery<LeaderboardPageData>(`/api/site/leaderboard?scope=${scope}`);
export const useNotifications = () => useQuery<NotificationsResponse>(USE_MOCKS ? null : NOTIFICATIONS_URL, { refreshMs: 30_000 });
export const useTeams = () => useQuery<TeamsPageData>(USE_MOCKS ? null : TEAMS_URL);
export const useTeam = (slug: string) => useQuery<TeamPageData>(USE_MOCKS ? null : `/api/site/teams/${encodeURIComponent(slug)}`);
export const useProfile = () => useQuery<ProfileData>(USE_MOCKS ? null : "/api/site/profile");
export const useMyCalls = (view: "recent" | "history", match?: string) =>
  useQuery<MyCallsData>(USE_MOCKS ? null : `/api/site/calls?view=${view}${match ? `&match=${encodeURIComponent(match)}` : ""}`, { refreshMs: 15_000 });

const TEAMS_URL = "/api/site/teams";

/** follow or unfollow a team: the star, the sidebar and the teams list change at once, then refresh */
export async function followTeam(teamId: string, on: boolean) {
  setData<MeResponse>(ME_URL, (me) => (me ? { ...me, follows: on ? [...new Set([...me.follows, teamId])] : me.follows.filter((x) => x !== teamId) } : me!));
  setData<TeamsPageData>(TEAMS_URL, (p) => (p ? { ...p, teams: p.teams.map((t) => (t.team.id === teamId ? { ...t, followed: on } : t)) } : p!));
  const res = await postJson<{ follows: string[] }>("/api/site/favorites", { teamId, on });
  for (const url of [ME_URL, TEAMS_URL, "/api/site/home", "/api/site/profile"]) invalidate(url);
  return res;
}

/** the change shown at once in every place that reads /me (top nav, sidebar, profile) */
export function withSettings(me: MeResponse, patch: Partial<Pick<MeResponse, "nickname" | "language" | "notificationPrefs">>): MeResponse {
  const nickname = patch.nickname?.trim() || null;
  return {
    ...me,
    ...(patch.language && { language: patch.language }),
    ...(patch.notificationPrefs && { notificationPrefs: patch.notificationPrefs }),
    ...(nickname && { nickname, joined: true, user: { ...me.user, name: nickname } }),
  };
}

/** nickname, language, notification choices: optimistic, then the server's answer, then a refetch */
export async function saveSettings(patch: Partial<Pick<MeResponse, "nickname" | "language" | "notificationPrefs">>) {
  const before = (readCache(ME_URL)?.data as MeResponse | null | undefined) ?? null;
  if (before) setData<MeResponse>(ME_URL, (me) => withSettings(me ?? before, patch));
  const res = await postJson<MeResponse>("/api/site/settings", patch);
  if (res.ok) setData<MeResponse>(ME_URL, () => res.data);
  else if (before) setData<MeResponse>(ME_URL, () => before);
  // anything else that shows the name (profile, boards) reloads; /me confirms
  for (const url of [ME_URL, "/api/site/profile"]) invalidate(url);
  return res;
}

/**
 * a subscription (demo money plus points). the new balance shows everywhere at once, then /me,
 * rewards, the profile and every open match page refetch (a live stream unlocks in place)
 */
export async function buyPlan(planId: string, pointsToUse: number, idempotencyKey: string) {
  const res = await postJson<SubscriptionResult>("/api/site/subscriptions", { planId, pointsToUse, idempotencyKey });
  if (res.ok) {
    setData<MeResponse>(ME_URL, (me) => (me ? { ...me, wallet: { balance: res.data.balance }, user: { ...me.user, points: res.data.balance } } : me!));
    for (const url of [ME_URL, "/api/site/rewards", "/api/site/profile", NOTIFICATIONS_URL]) invalidate(url);
    invalidatePrefix("/api/site/matches/");
  }
  return res;
}

export async function cancelPlan(planId: string) {
  const res = await postJson<{ cancelled: number; until: string | null }>("/api/site/subscriptions/cancel", { planId });
  if (res.ok) for (const url of [ME_URL, "/api/site/rewards", "/api/site/profile"]) invalidate(url);
  return res;
}

/** a partner offer's demo code; points (if any) leave the balance at once */
export async function redeemOfferApi(offerId: string) {
  const res = await postJson<OfferResult>(`/api/site/offers/${encodeURIComponent(offerId)}/redeem`, {});
  if (res.ok) {
    setData<MeResponse>(ME_URL, (me) => (me ? { ...me, wallet: { balance: res.data.balance }, user: { ...me.user, points: res.data.balance } } : me!));
    for (const url of [ME_URL, "/api/site/rewards"]) invalidate(url);
  }
  return res;
}

/** "reset my demo profile": the next page load is a new guest */
export async function resetProfile() {
  const res = await postJson("/api/site/me/reset", {});
  if (res.ok) window.location.assign("/sports");
  return res;
}

/** the demo rotation (404, so "notfound", when DEMO_MODE is off) */
export const useRotation = (enabled = true) => useQuery<RotationInfo>(enabled && !USE_MOCKS ? "/api/site/rotation" : null, { refreshMs: 5000 });

/** "9:12" */
export const fmtCountdown = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

let meTimer: ReturnType<typeof setTimeout> | undefined;
/** the viewer's points changed (a call resolved): refetch /me and the bell, once, shortly */
export function refreshMeSoon(ms = 600) {
  clearTimeout(meTimer);
  meTimer = setTimeout(() => {
    invalidate(ME_URL);
    invalidate(NOTIFICATIONS_URL);
  }, ms);
}

// ---------- actions ----------

/** POST json to the site api; the error text from the server when it refuses */
export async function postJson<T>(url: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  try {
    const r = await fetch(url, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, status: r.status, error: (data as { error?: string }).error ?? `error ${r.status}` };
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, status: 0, error: "can't reach the server" };
  }
}

export const isMockMatch = (id: string) => MOCK_MATCH_IDS.includes(id);

export async function joinMatchApi(matchId: string, nickname: string, roomCode?: string | null) {
  const res = await postJson<{ nickname: string; room: { code: string } }>(`/api/site/matches/${matchId}/join`, { nickname, ...(roomCode && { roomCode }) });
  // the new name shows at once (optimistic), /me confirms
  if (res.ok) {
    setData<MeResponse>(ME_URL, (me) => (me ? withSettings(me, { nickname: res.data.nickname }) : me!));
    invalidate(ME_URL);
  }
  return res;
}

export const postCommentApi = (matchId: string, text: string) => postJson<{ comment: Comment }>(`/api/site/matches/${matchId}/comments`, { text });

export const setReminderApi = (matchId: string, on: boolean) => postJson(`/api/site/reminders`, { matchId, on });

export const answerCallApi = (callId: string, optionId: string) => postJson(`/api/site/calls/${callId}/answer`, { optionId });

// ---------- the match prediction (what if? and the lobby card answer the same record) ----------

export const predictionUrl = (matchId: string) => `/api/site/matches/${encodeURIComponent(matchId)}/prediction`;
export const usePrediction = (matchId: string | null) => useQuery<MatchPrediction>(matchId && !USE_MOCKS && !isMockMatch(matchId) ? predictionUrl(matchId) : null, { refreshMs: 20_000 });
/** the lobby card hears about a prediction made in what if? (and the other way round) */
export const PREDICTION_EVENT = "ks:prediction";

export async function predictApi(matchId: string, optionId: string) {
  const r = await postJson<MatchPrediction>(predictionUrl(matchId), { optionId });
  if (r.ok) {
    setData<MatchPrediction>(predictionUrl(matchId), () => r.data);
    if (typeof window !== "undefined" && r.data.callId) window.dispatchEvent(new CustomEvent(PREDICTION_EVENT, { detail: { callId: r.data.callId, optionId } }));
    refreshMeSoon();
  } else invalidate(predictionUrl(matchId));
  return r;
}

/** one fan's points on a board, by source and match (the leaderboard's expanded row) */
export const useBreakdown = (scope: LeaderboardScope, userId: string | null) =>
  useQuery<PointsBreakdown>(userId && !USE_MOCKS ? `/api/site/leaderboard/breakdown?scope=${scope}&user=${encodeURIComponent(userId)}` : null);

export async function markNotificationsRead(id?: string) {
  setData<NotificationsResponse>(NOTIFICATIONS_URL, (old) =>
    old ? { ...old, unread: id ? Math.max(0, old.unread - 1) : 0, items: old.items.map((n) => (!id || n.id === id ? { ...n, read: true } : n)) } : old!,
  );
  const res = await postJson<NotificationsResponse>(`${NOTIFICATIONS_URL}/read`, id ? { id } : {});
  if (res.ok) setData<NotificationsResponse>(NOTIFICATIONS_URL, () => res.data);
  invalidate(ME_URL);
}

const HOST_KEY = "ks_host_token";
/** the host token, asked once and kept on this device */
export function readHostToken(): string {
  try {
    return localStorage.getItem(HOST_KEY) ?? "";
  } catch {
    return "";
  }
}
export function saveHostToken(token: string) {
  try {
    localStorage.setItem(HOST_KEY, token);
  } catch {
    // private mode: the token lasts for this page
  }
}

/** a GET with the host token (the editor) */
export async function hostGet<T>(url: string, token: string): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  try {
    const r = await fetch(url, { credentials: "same-origin", cache: "no-store", headers: { "x-host-token": token } });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, status: r.status, error: (data as { error?: string }).error ?? `error ${r.status}` };
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, status: 0, error: "can't reach the server" };
  }
}

/** "report a mistake" in a generated text or a call's wording */
export const reportMistakeApi = (r: { refKind: "text" | "call"; refKey: string; matchId?: string | null; message: string }) => postJson<{ ok: true; id: string }>("/api/site/reports", r);

/** POST with the host token; the server checks it */
export async function hostPost<T>(url: string, body: unknown, token: string): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  try {
    const r = await fetch(url, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json", "x-host-token": token }, body: JSON.stringify(body) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, status: r.status, error: (data as { error?: string }).error ?? `error ${r.status}` };
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, status: 0, error: "can't reach the server" };
  }
}

/** go to another site page without a full load (app/routes.tsx listens for popstate) */
export function navigate(href: string) {
  window.history.pushState(null, "", href);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo(0, 0);
}

/** ?room=ABCD from an old qr code (every fan on a match is in its one party now) */
export const roomFromUrl = () => (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("room")?.toUpperCase() ?? null);

// ---------- the watch party ----------

/** a friendly nickname to start from ("Kiekko-fan 482"); the fan can change it */
export const suggestNickname = () => `${["Kiekko", "Lätkä", "Maali", "Kaukalo"][Math.floor(Math.random() * 4)]}-fan ${100 + Math.floor(Math.random() * 900)}`;

export const postBurstApi = (matchId: string, emoji: string) => postJson<{ burst: Burst }>(`/api/site/matches/${matchId}/bursts`, { emoji });

export const reactApi = (commentId: string, emoji: string) => postJson<{ commentId: string; reactions: Record<string, number> }>(`/api/site/comments/${commentId}/react`, { emoji });

/** "ask the match": the fact card (posted to the party when the data has the answer) */
export const askApi = (matchId: string, text: string) => postJson<{ card: FactCard; comment: Comment | null; posted: boolean }>(`/api/site/matches/${matchId}/ask`, { text });

export const FRIENDS_URL = "/api/site/friends";
export const useFriends = () => useQuery<FriendsPageData>(USE_MOCKS ? null : FRIENDS_URL, { refreshMs: 15_000 });

/** friends in a watch party now (one match, or anywhere) */
export const useFriendsWatching = (matchId?: string | null, enabled = true) =>
  useQuery<{ friends: { userId: string; name: string; matchId: string; title: string }[] }>(
    enabled && !USE_MOCKS ? `/api/site/friends/watching${matchId ? `?match=${encodeURIComponent(matchId)}` : ""}` : null,
    { refreshMs: 20_000 },
  );

async function friendAction<T>(url: string, body: unknown) {
  const res = await postJson<T>(url, body);
  for (const u of [FRIENDS_URL, ME_URL, NOTIFICATIONS_URL]) invalidate(u);
  return res;
}
export const addFriendApi = (code: string) => friendAction<{ status: "requested" | "friends" }>("/api/site/friends/add", { code });
export const acceptFriendApi = (userId: string) => friendAction(`/api/site/friends/${userId}/accept`, {});
export const removeFriendApi = (userId: string) => friendAction(`/api/site/friends/${userId}/remove`, {});

export const createInviteApi = (matchId: string | null) => postJson<InviteCreated>("/api/site/invites", { matchId });
export const useInvite = (code: string) => useQuery<InviteInfo>(USE_MOCKS ? null : `/api/site/invites/${encodeURIComponent(code)}`);
export async function acceptInviteApi(code: string, nickname?: string) {
  const res = await postJson<{ matchId: string | null; friend: string; pass: boolean }>(`/api/site/invites/${encodeURIComponent(code)}/accept`, nickname ? { nickname } : {});
  if (res.ok) for (const u of [ME_URL, FRIENDS_URL]) invalidate(u);
  return res;
}

/** "Watch free": the guest pass is bound to this match; the page refetches with the stream */
export async function claimPassApi(matchId: string) {
  const res = await postJson<{ ok: true }>(`/api/site/matches/${matchId}/pass`, {});
  if (res.ok) {
    invalidate(ME_URL);
    invalidatePrefix("/api/site/matches/");
  }
  return res;
}
