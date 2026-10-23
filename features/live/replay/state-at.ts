import type { GameTeams, GoalEvent, ReplaySnapshot } from "@/shared/types";

export const PERIOD_SECONDS = 1200;
export const REGULATION_SECONDS = 3 * PERIOD_SECONDS;

/**
 * the game as it looked at game time t. only reads events at or before t,
 * so nothing from the future can leak to phones (see tests/no-leak.test.ts)
 */
export function stateAt(events: GoalEvent[], t: number, game: GameTeams): ReplaySnapshot {
  const past = events.filter((e) => e.gameTimeSeconds <= t).sort((a, b) => a.gameTimeSeconds - b.gameTimeSeconds);
  const score = {
    home: past.filter((e) => e.teamId === game.homeTeamId).length,
    away: past.filter((e) => e.teamId === game.awayTeamId).length,
  };
  // todo: overtime and shootout phases
  const phase = t <= 0 ? "pregame" : t >= REGULATION_SECONDS && score.home !== score.away ? "final" : "live";
  return { gameTimeSeconds: t, phase, score, events: past };
}
