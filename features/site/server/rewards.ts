// GET /api/site/rewards: points and level from the ledger, the rest from rewards.config.json
import type { ApiMeta, RewardsPage } from "@/shared/types";
import { rewardsConfig } from "./config";
import type { Viewer } from "./identity";
import { viewerSummary } from "./points";

export async function rewardsPage(viewer: Viewer): Promise<RewardsPage & ApiMeta> {
  return { ...rewardsConfig, user: await viewerSummary(viewer.user), asOf: new Date().toISOString(), source: "config" };
}
