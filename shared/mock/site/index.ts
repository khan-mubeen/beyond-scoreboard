// typed loaders for the kaleva sports pages. browser-safe, no fs.
// fictional people, real liiga team names, numbers from the design images
import type { FinishedMatchDetail, HomePage, LiveMatchDetail, RewardsPage, SiteChrome } from "@/shared/types";
import chromeJson from "./chrome.json";
import homeJson from "./home.json";
import matchFinalJson from "./match-final.json";
import matchLiveJson from "./match-live.json";
import rewardsJson from "./rewards.json";

export const mockChrome = chromeJson as SiteChrome;
export const mockHome = homeJson as unknown as HomePage;
export const mockMatchLive = matchLiveJson as unknown as LiveMatchDetail;
export const mockMatchFinal = matchFinalJson as unknown as FinishedMatchDetail;
export const mockRewards = rewardsJson as unknown as RewardsPage;

/** every site mock, for tests that sweep all ui copy */
export const allSiteMocks = {
  chrome: mockChrome,
  home: mockHome,
  live: mockMatchLive,
  final: mockMatchFinal,
  rewards: mockRewards,
};
