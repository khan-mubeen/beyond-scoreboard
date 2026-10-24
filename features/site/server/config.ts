// site settings that aren't liiga data: the favourite team, hero copy, sponsor, levels.
// rewards (subscriptions, offers, achievements) live in rewards.config.json
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { ComingSoonCard, HeroData, RewardsPage } from "@/shared/types";

export const SITE = {
  /** the team slug the demo profile follows ("kärpät" in "495643563:kärpät") */
  favoriteSlug: process.env.FAVORITE_TEAM ?? "kärpät",
  hero: {
    kicker: "KALEVA",
    titleLead: "Sports",
    titleAccent: "Experience",
    subtitle: "Follow the games. Understand what they mean.",
    body: "Live scores, expert analysis and season context — all in one place, only at Kaleva.",
    tagline: "Sports lives here in the North.",
    image: "/placeholders/hero.svg",
  } satisfies HeroData,
  comingSoon: [{ id: "korisliiga", title: "Korisliiga", league: "Korisliiga" }] satisfies ComingSoonCard[],
  leaderboard: { title: "Weekly Leaderboard", sponsor: "Oulun Energia", href: "/calls/history" },
  /** points needed for each level, level 1 starts at 0 */
  levels: [0, 50, 150, 300, 500, 750, 1000, 1500, 2000, 2750, 3500, 4500],
  callPoints: 20,
  /** guests see this seeded profile in the sidebar until they join (DEMO_PROFILE=false turns it off) */
  demoAnonId: "seed:mikko-korhonen",
} as const;

type RewardsConfig = Omit<RewardsPage, "user">;
const file = fileURLToPath(new URL("./rewards.config.json", import.meta.url));
export const rewardsConfig = JSON.parse(readFileSync(file, "utf8")) as RewardsConfig;

/** level, points to the next level and progress (0-1) for a season total */
export function levelFor(points: number) {
  const L = SITE.levels;
  let level = 1;
  while (level < L.length && points >= L[level]) level++;
  const floor = L[level - 1];
  const next = L[level] ?? floor + 1000;
  return { level, pointsToNextLevel: next - points, levelProgress: Math.min(1, (points - floor) / (next - floor)) };
}
