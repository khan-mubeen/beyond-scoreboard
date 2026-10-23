import type { Zone } from "@/shared/types";

// todo(gate 0): verify zones, relegation format, team count and tiebreakers
// against the official 2026-27 liiga rules before trusting any number

export const RULES = {
  teams: 17,
  points: {
    regulationWin: 3,
    overtimeWin: 2, // also shootout win
    overtimeLoss: 1, // also shootout loss
    regulationLoss: 0,
  },
  /** inclusive position ranges, in table order */
  zones: [
    { zone: "top4", from: 1, to: 4, label: "Top 4" },
    { zone: "playoffs", from: 5, to: 12, label: "Playoffs" },
    { zone: "safe", from: 13, to: 14, label: "Safe" },
    { zone: "relegated", from: 15, to: 17, label: "Relegation" },
  ] satisfies { zone: Zone; from: number; to: number; label: string }[],
  /** applied in order when points are level. placeholder until verified */
  tiebreakers: ["points", "regulationWins", "goalDifference", "goalsFor", "headToHead"],
} as const;
