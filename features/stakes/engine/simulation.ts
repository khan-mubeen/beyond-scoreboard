import type { Game } from "@/shared/types";
import { RULES } from "./rules.config";
import type { StandingsRow } from "./standings";

export interface SimulationInput {
  standings: StandingsRow[];
  remaining: Game[];
  runs: number;
}

/** chance of each final position per team; index 0 is 1st place */
export type PositionOddsByTeam = Record<string, number[]>;

/** stub: every position equally likely. todo: monte carlo over remaining games */
export function simulateSeason(input: SimulationInput): PositionOddsByTeam {
  const uniform = Array.from({ length: RULES.teams }, () => 1 / RULES.teams);
  return Object.fromEntries(input.standings.map((r) => [r.teamId, [...uniform]]));
}
