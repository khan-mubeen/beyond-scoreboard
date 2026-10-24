// what the server checks when it starts: the liiga ping, the database, our zone lines vs the api.
// then who runs the live engine: one server holds the leader lease (the others are followers that
// serve http), and the engine: the demo rotation or replay and any real game live now
import { initLiiga } from "@/features/liiga/server";
import { startEngine, startLeadership, stopLeadership } from "@/features/live/server";
import { checkRulesAgainstApi } from "@/features/stakes/server";
import { checkDb } from "@/shared/db";
import { siteRenderer } from "../live-render";
import { assertPlans } from "../wallet";

export async function startup() {
  // money is always required: a plan whose points cap is over half its price stops the server
  assertPlans();
  await Promise.all([initLiiga(), checkDb()]);
  await checkRulesAgainstApi();
  await startLeadership();
  await startEngine(siteRenderer).catch((err) => console.error(`live: engine did not start: ${(err as Error).message}`));
}

/** a clean stop (ctrl-c, a deploy): the lease goes at once, so another server takes over on its next try */
export function stopOnSignals() {
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      void stopLeadership().finally(() => process.exit(0));
      // never hang on a slow database
      setTimeout(() => process.exit(0), 1500).unref();
    });
  }
}
