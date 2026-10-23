import type { Call, GameTeams, GoalEvent } from "@/shared/types";
import { stateAt } from "../replay/state-at";
import { type CallSlot, makeCall } from "./templates";

/** fixed demo schedule. todo: more slots per period, react to goals */
export const CALL_SLOTS: CallSlot[] = [
  { type: "next_goal", opensAt: 120, openFor: 180 },
  { type: "goal_in_5", opensAt: 660, openFor: 60 },
  { type: "regulation_result", opensAt: 2400, openFor: 60 },
  { type: "overtime", opensAt: 3000, openFor: 120 },
];

/** every call opened by game time t. only looks at events up to each call's opensAt */
export function scheduleCalls(events: GoalEvent[], t: number, game: GameTeams): Call[] {
  return CALL_SLOTS.filter((slot) => slot.opensAt <= t)
    .filter((slot) => {
      if (slot.type !== "overtime") return true;
      const { score } = stateAt(events, slot.opensAt, game);
      return Math.abs(score.home - score.away) <= 1;
    })
    .map((slot) => makeCall(slot, game));
}
