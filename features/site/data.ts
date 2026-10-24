// the only place site screens get data from: /api/site/*, through a tiny shared cache
// (stale-while-revalidate, in memory, keyed by url). a page you visited shows its last good data
// at once and refreshes in the background. mock data only with VITE_USE_MOCKS=true: never as a
// first paint, never as a silent fallback. a failed request is an "error" state
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type {
  Comment,
  DataSource,
  HomePage,
  LeaderboardPageData,
  LeaderboardScope,
  MatchDetail,
  MeResponse,
  MyCallsData,
  NotificationsResponse,
  ProfileData,
  RewardsPage,
  RotationInfo,
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
    const r = await fetch(url, { credentials: "same-origin", cache: "no-store" });
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
export const useMatchDetail = (id: string) => useQuery<MatchDetail>(`/api/site/matches/${encodeURIComponent(id)}`, { mock: mockMatch(id) });
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

/** nickname, language, notification choices */
export async function saveSettings(patch: Partial<Pick<MeResponse, "nickname" | "language" | "notificationPrefs">>) {
  const res = await postJson<MeResponse>("/api/site/settings", patch);
  if (res.ok) setData<MeResponse>(ME_URL, () => res.data);
  return res;
}

/** "reset my demo profile": the next page load is a new guest */
export async function resetProfile() {
  const res = await postJson("/api/site/me/reset", {});
  if (res.ok) window.location.assign("/");
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
  if (res.ok) invalidate(ME_URL);
  return res;
}

export const postCommentApi = (matchId: string, text: string) => postJson<{ comment: Comment }>(`/api/site/matches/${matchId}/comments`, { text });

export const setReminderApi = (matchId: string, on: boolean) => postJson(`/api/site/reminders`, { matchId, on });

export const answerCallApi = (callId: string, optionId: string) => postJson(`/api/site/calls/${callId}/answer`, { optionId });

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

/** ?room=ABCD from the qr code */
export const roomFromUrl = () => (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("room")?.toUpperCase() ?? null);
