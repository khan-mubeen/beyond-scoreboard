import type { Call, GoalEvent } from "@/shared/types";

/**
 * the correct option id, or null while it can't be told from events alone.
 * todo: resolve "none" / "no" / regulation_result once resolvesAt has passed
 */
export function resolveCall(call: Call, events: GoalEvent[]): string | null {
  const inWindow = events
    .filter((e) => e.gameTimeSeconds > call.locksAt && e.gameTimeSeconds <= call.resolvesAt)
    .sort((a, b) => a.gameTimeSeconds - b.gameTimeSeconds);

  switch (call.type) {
    case "next_goal":
      return inWindow[0]?.teamId ?? null;
    case "goal_in_5":
      return inWindow.length > 0 ? "yes" : null;
    default:
      return null;
  }
}
