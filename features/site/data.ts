// the only place site screens get data from: /api/site/*, with the mock data as a fallback
// when VITE_USE_MOCKS=true or a request fails. the mock files load only when needed
import { useEffect, useState } from "react";
import chromeJson from "@/shared/mock/site/chrome.json";
import type { DataSource, HomePage, MatchDetail, RewardsPage, SiteChrome, UserSummary, FavoriteTeam } from "@/shared/types";

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === "true";
/** the two demo pages from the design, kept working without any backend */
export const MOCK_MATCH_IDS = ["karpat-assat-live", "karpat-assat-final"];

export interface Resource<T> {
  data: T | null;
  status: "loading" | "ready" | "notfound";
  source: DataSource | null;
  asOf: string | null;
}

const mocks = () => import("@/shared/mock/site");

/** fetches once per url; falls back to the mock when the api fails */
function useApi<T extends object>(url: string | null, mock: () => Promise<T | null>): Resource<T> {
  const [res, setRes] = useState<Resource<T>>({ data: null, status: "loading", source: null, asOf: null });
  useEffect(() => {
    let cancelled = false;
    const done = (r: Resource<T>) => !cancelled && setRes(r);
    const fallback = async () => {
      const data = await mock();
      done({ data, status: data ? "ready" : "notfound", source: data ? "mock" : null, asOf: null });
    };
    if (USE_MOCKS || !url) {
      void fallback();
    } else {
      fetch(url, { credentials: "same-origin" })
        .then(async (r) => {
          if (r.status === 404) return done({ data: null, status: "notfound", source: null, asOf: null });
          if (!r.ok) throw new Error(`http ${r.status}`);
          const body = (await r.json()) as T & { source?: DataSource; asOf?: string };
          done({ data: body, status: "ready", source: body.source ?? "live", asOf: body.asOf ?? null });
        })
        .catch(() => void fallback());
    }
    return () => {
      cancelled = true;
    };
  }, [url, mock]);
  return res;
}

const homeMock = async () => (await mocks()).mockHome;
const rewardsMock = async () => (await mocks()).mockRewards;

/** nav, sidebar links and favourites; the user and logos come from the page's api response */
export function useSiteChrome(user?: UserSummary | null, favorites?: FavoriteTeam[] | null): SiteChrome {
  const base = chromeJson as SiteChrome;
  return { ...base, ...(user && { user }), ...(favorites?.length && { favorites }) };
}

export function useHomePage(): Resource<HomePage> {
  return useApi("/api/site/home", homeMock);
}

const matchMocks = new Map<string, () => Promise<MatchDetail | null>>();
const matchMock = (id: string) => {
  if (!matchMocks.has(id)) {
    matchMocks.set(id, async () => {
      if (!MOCK_MATCH_IDS.includes(id)) return null;
      const m = await mocks();
      return id === "karpat-assat-live" ? m.mockMatchLive : m.mockMatchFinal;
    });
  }
  return matchMocks.get(id)!;
};

/** a real match from the api ("2027-2701404"), or one of the two demo mocks */
export function useMatchDetail(id: string): Resource<MatchDetail> {
  return useApi(MOCK_MATCH_IDS.includes(id) ? null : `/api/site/matches/${encodeURIComponent(id)}`, matchMock(id));
}

export function useRewardsPage(): Resource<RewardsPage> {
  return useApi("/api/site/rewards", rewardsMock);
}

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

// ---------- actions (real matches only) ----------

export interface Me {
  joined: boolean;
  nickname: string | null;
}

/** who the cookie says we are; null while loading or on mock pages */
export function useMe(enabled: boolean): [Me | null, (me: Me) => void] {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    if (!enabled || USE_MOCKS) return;
    let cancelled = false;
    fetch("/api/site/me", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => !cancelled && b && setMe({ joined: !!b.joined, nickname: b.nickname ?? null }))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return [me, setMe];
}

export const joinMatchApi = (matchId: string, nickname: string, roomCode?: string | null) =>
  postJson<{ nickname: string; room: { code: string } }>(`/api/site/matches/${matchId}/join`, { nickname, ...(roomCode && { roomCode }) });

export const postCommentApi = (matchId: string, text: string) =>
  postJson<{ comment: import("@/shared/types").Comment }>(`/api/site/matches/${matchId}/comments`, { text });

export const setReminderApi = (matchId: string, on: boolean) => postJson(`/api/site/reminders`, { matchId, on });

export const answerCallApi = (callId: string, optionId: string) => postJson(`/api/site/calls/${callId}/answer`, { optionId });

/** ?room=ABCD from the qr code */
export const roomFromUrl = () => (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("room")?.toUpperCase() ?? null);

export async function findMatch(id: string): Promise<MatchDetail | null> {
  return matchMock(id)();
}
