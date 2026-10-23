import type { Game } from "@/shared/types";

/** stub: every team is equal. todo: rating from results (elo or goal-based) */
export function teamStrength(_teamId: string, _games: Game[]): number {
  return 1500;
}

/** stub: chance the home team wins a game in regulation. todo: use strengths */
export function regulationWinChance(_homeStrength: number, _awayStrength: number): number {
  return 0.45;
}
