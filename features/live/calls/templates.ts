import { teamById } from "@/shared/mock";
import type { Call, CallOption, CallType, GameTeams } from "@/shared/types";
import { PERIOD_SECONDS, REGULATION_SECONDS } from "../replay/state-at";

export interface CallSlot {
  type: CallType;
  opensAt: number;
  /** seconds the call stays open */
  openFor: number;
}

/** builds the user-facing call for one slot. labels say points and chances only */
export function makeCall(slot: CallSlot, game: GameTeams): Call {
  const home = teamById(game.homeTeamId).name;
  const away = teamById(game.awayTeamId).name;
  const locksAt = slot.opensAt + slot.openFor;
  const yesNo: CallOption[] = [
    { id: "yes", label: "Yes" },
    { id: "no", label: "No" },
  ];
  const base = {
    id: `${slot.type}@${slot.opensAt}`,
    type: slot.type,
    opensAt: slot.opensAt,
    locksAt,
    correctOptionId: null,
  };

  switch (slot.type) {
    case "next_goal":
      return {
        ...base,
        question: "Who scores next this period?",
        options: [
          { id: game.homeTeamId, label: home },
          { id: game.awayTeamId, label: away },
          { id: "none", label: "No goal this period" },
        ],
        resolvesAt: (Math.floor(slot.opensAt / PERIOD_SECONDS) + 1) * PERIOD_SECONDS,
      };
    case "goal_in_5":
      return { ...base, question: "Goal in the next 5 minutes?", options: yesNo, resolvesAt: locksAt + 300 };
    case "regulation_result":
      return {
        ...base,
        question: "How does regulation end?",
        options: [
          { id: "home_win", label: `${home} win` },
          { id: "tie", label: "Tied, to overtime" },
          { id: "away_win", label: `${away} win` },
        ],
        resolvesAt: REGULATION_SECONDS,
      };
    case "overtime":
      return { ...base, question: "Will this game go to overtime?", options: yesNo, resolvesAt: REGULATION_SECONDS };
  }
}
