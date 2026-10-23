import type { Game, ProjectedRow, Score } from "@/shared/types";
import { RULES } from "./rules.config";
import { zoneForRank } from "./zones";

export interface GamePoints {
  home: number;
  away: number;
}

/** points each side gets from a final game */
export function pointsForGame(game: Pick<Game, "score" | "decidedIn">): GamePoints {
  if (!game.decidedIn) throw new Error("game is not decided");
  const homeWon = game.score.home > game.score.away;
  const p = RULES.points;
  const [win, loss] =
    game.decidedIn === "regulation" ? [p.regulationWin, p.regulationLoss] : [p.overtimeWin, p.overtimeLoss];
  return homeWon ? { home: win, away: loss } : { home: loss, away: win };
}

export interface StandingsRow {
  teamId: string;
  points: number;
  gamesPlayed: number;
}

/** sums points from final games. todo: tiebreakers from RULES.tiebreakers */
export function computeStandings(teamIds: string[], games: Game[]): StandingsRow[] {
  const rows = new Map(teamIds.map((id) => [id, { teamId: id, points: 0, gamesPlayed: 0 }]));
  for (const g of games) {
    if (g.status !== "final") continue;
    const pts = pointsForGame(g);
    const home = rows.get(g.homeTeamId);
    const away = rows.get(g.awayTeamId);
    if (home) Object.assign(home, { points: home.points + pts.home, gamesPlayed: home.gamesPlayed + 1 });
    if (away) Object.assign(away, { points: away.points + pts.away, gamesPlayed: away.gamesPlayed + 1 });
  }
  return [...rows.values()].sort((a, b) => b.points - a.points);
}

/**
 * the table if the game ended at this score: a lead is a regulation win,
 * a tie gives both teams the overtime point they are guaranteed.
 * rows must be in table order; that order breaks ties for now.
 */
export function projectTable(
  rows: StandingsRow[],
  game: Pick<Game, "homeTeamId" | "awayTeamId">,
  score: Score,
): ProjectedRow[] {
  const p = RULES.points;
  const extra = (teamId: string): number => {
    const side = teamId === game.homeTeamId ? "home" : teamId === game.awayTeamId ? "away" : null;
    if (!side) return 0;
    if (score.home === score.away) return p.overtimeLoss;
    const leading = score.home > score.away ? "home" : "away";
    return side === leading ? p.regulationWin : p.regulationLoss;
  };
  return rows
    .map((r, order) => ({ teamId: r.teamId, points: r.points + extra(r.teamId), order }))
    .sort((a, b) => b.points - a.points || a.order - b.order)
    .map((r, i) => ({ teamId: r.teamId, points: r.points, rank: i + 1, zone: zoneForRank(i + 1) }));
}
