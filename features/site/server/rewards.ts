// GET /api/site/rewards: the offers, subscriptions and achievements from rewards.config.json.
// the points balance comes from /api/site/me, like every other page
import type { ApiMeta, RewardsPage } from "@/shared/types";
import { rewardsConfig } from "./config";

export async function rewardsPage(): Promise<RewardsPage & ApiMeta> {
  return { ...rewardsConfig, asOf: new Date().toISOString(), source: "config" };
}
