// GET /api/site/rewards: the offers, subscriptions and achievements from rewards.config.json.
// the points balance comes from /api/site/me, like every other page. feature names come from NAMES
import { NAMES } from "@/shared/copy/names";
import type { ApiMeta, RewardsPage } from "@/shared/types";
import { rewardsConfig } from "./config";

const CHIP_NAMES: Partial<Record<RewardsPage["earnChips"][number]["icon"], string>> = { call: NAMES.call, watch: NAMES.watchTogether };

export async function rewardsPage(): Promise<RewardsPage & ApiMeta> {
  const earnChips = rewardsConfig.earnChips.map((c) => ({ ...c, label: CHIP_NAMES[c.icon] ?? c.label }));
  return { ...rewardsConfig, earnChips, asOf: new Date().toISOString(), source: "config" };
}
