// the only place site screens get data from. today it reads shared/mock/site.
// when the api lands, these hooks fetch instead and the screens stay the same
import { mockChrome, mockHome, mockMatchFinal, mockMatchLive, mockRewards } from "@/shared/mock/site";
import type { HomePage, MatchDetail, RewardsPage, SiteChrome } from "@/shared/types";

const MATCHES: MatchDetail[] = [mockMatchLive, mockMatchFinal];

export function useSiteChrome(): SiteChrome {
  return mockChrome;
}

export function useHomePage(): HomePage {
  return mockHome;
}

/** null when we have no page for this match yet */
export function useMatchDetail(id: string): MatchDetail | null {
  return findMatch(id);
}

export function useRewardsPage(): RewardsPage {
  return mockRewards;
}

export function findMatch(id: string): MatchDetail | null {
  return MATCHES.find((m) => m.id === id) ?? null;
}
