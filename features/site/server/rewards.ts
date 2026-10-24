// GET /api/site/rewards: the plans (shared/config/plans.ts) with the fan's running ones, the
// offers with the fan's codes, the achievements, and the purchase history. the balance comes
// from /api/site/me, like every other page. feature names come from NAMES
import { NAMES } from "@/shared/copy/names";
import type { ApiMeta, RewardsPage } from "@/shared/types";
import { rewardsConfig } from "./config";
import type { Viewer } from "./identity";
import { rewardsState } from "./wallet";

const CHIP_NAMES: Partial<Record<RewardsPage["earnChips"][number]["icon"], string>> = { call: NAMES.call, watch: NAMES.watchTogether };

export async function rewardsPage(viewer: Viewer): Promise<RewardsPage & ApiMeta> {
  const earnChips = rewardsConfig.earnChips.map((c) => ({ ...c, label: CHIP_NAMES[c.icon] ?? c.label }));
  return { ...rewardsConfig, ...(await rewardsState(viewer.user)), earnChips, asOf: new Date().toISOString(), source: "db" };
}
