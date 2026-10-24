// what the server checks when it starts: the liiga ping, the database, our zone lines vs the api.
// then the live engine: the demo replay (DEMO_REPLAY_MATCH_ID) and any real game live now
import { initLiiga } from "@/features/liiga/server";
import { startEngine } from "@/features/live/server";
import { checkRulesAgainstApi } from "@/features/stakes/server";
import { checkDb } from "@/shared/db";
import { siteRenderer } from "../live-render";
import { startPresenceSweep } from "../presence";
import { assertPlans } from "../wallet";

export async function startup() {
  // money is always required: a plan whose points cap is over half its price stops the server
  assertPlans();
  await Promise.all([initLiiga(), checkDb()]);
  await checkRulesAgainstApi();
  await startEngine(siteRenderer).catch((err) => console.error(`live: engine did not start: ${(err as Error).message}`));
  startPresenceSweep();
}
