import type { Zone } from "@/shared/types";

// checked against the liiga api (season 2026-27): 17 teams, points = 3*wins + 2*overtimeWins +
// overtimeLosses for every team, playoffsLines [4, 12, 14], and the tiebreak order below
// reproduces every tied pair in the official standings. startup logs any mismatch with playoffsLines

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
  /** applied in order when points are level */
  tiebreakers: ["points", "regulationWins", "goalDifference", "goalsFor"],
} as const;

/** the last position above each line, as the api's playoffsLines: [4, 12, 14] */
export const RULE_LINES: number[] = RULES.zones.slice(0, -1).map((z) => z.to);

/** a message per difference between our zones and the api's playoffsLines, empty when they agree */
export function checkPlayoffLines(apiLines: number[]): string[] {
  const ours = RULE_LINES.join(",");
  const theirs = [...apiLines].sort((a, b) => a - b).join(",");
  return ours === theirs ? [] : [`zone lines differ: rules.config has [${ours}], the api says [${theirs}]`];
}
