import type { Game, GameOutcome, ProjectedRow, Score } from "@/shared/types";
import { RULES } from "./rules.config";
import { zoneForRank } from "./zones";

export type DecidedIn = "regulation" | "overtime" | "shootout";

/** a finished game, all the engine needs */
export interface Result {
  homeTeamId: string;
  awayTeamId: string;
  homeGoals: number;
  awayGoals: number;
  decidedIn: DecidedIn;
}

export interface TableRow {
  teamId: string;
  gamesPlayed: number;
  /** regulation wins */
  wins: number;
  overtimeWins: number;
  overtimeLosses: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface GamePoints {
  home: number;
  away: number;
}

export function pointsOf(r: Pick<Result, "homeGoals" | "awayGoals" | "decidedIn">): GamePoints {
  const homeWon = r.homeGoals > r.awayGoals;
  const p = RULES.points;
  const [win, loss] = r.decidedIn === "regulation" ? [p.regulationWin, p.regulationLoss] : [p.overtimeWin, p.overtimeLoss];
  return homeWon ? { home: win, away: loss } : { home: loss, away: win };
}

/** points each side gets from a final game */
export function pointsForGame(game: Pick<Game, "score" | "decidedIn">): GamePoints {
  if (!game.decidedIn) throw new Error("game is not decided");
  return pointsOf({ homeGoals: game.score.home, awayGoals: game.score.away, decidedIn: game.decidedIn });
}

/** a game result from the home team's point of view */
export function outcomeOf(r: Pick<Result, "homeGoals" | "awayGoals" | "decidedIn">): GameOutcome {
  const homeWon = r.homeGoals > r.awayGoals;
  if (r.decidedIn === "regulation") return homeWon ? "regulationWin" : "regulationLoss";
  return homeWon ? "overtimeWin" : "overtimeLoss";
}

const emptyRow = (teamId: string): TableRow => ({
  teamId,
  gamesPlayed: 0,
  wins: 0,
  overtimeWins: 0,
  overtimeLosses: 0,
  losses: 0,
  goalsFor: 0,
  goalsAgainst: 0,
  points: 0,
});

export function addResult(rows: Map<string, TableRow>, r: Result) {
  const home = rows.get(r.homeTeamId) ?? rows.set(r.homeTeamId, emptyRow(r.homeTeamId)).get(r.homeTeamId)!;
  const away = rows.get(r.awayTeamId) ?? rows.set(r.awayTeamId, emptyRow(r.awayTeamId)).get(r.awayTeamId)!;
  const pts = pointsOf(r);
  const homeWon = r.homeGoals > r.awayGoals;
  for (const [row, gf, ga, won, p] of [
    [home, r.homeGoals, r.awayGoals, homeWon, pts.home],
    [away, r.awayGoals, r.homeGoals, !homeWon, pts.away],
  ] as const) {
    row.gamesPlayed++;
    row.goalsFor += gf;
    row.goalsAgainst += ga;
    row.points += p;
    if (r.decidedIn === "regulation") {
      if (won) row.wins++;
      else row.losses++;
    } else if (won) row.overtimeWins++;
    else row.overtimeLosses++;
  }
}

/** tiebreak order from RULES: points, regulation wins, goal difference, goals for */
export function compareRows(a: TableRow, b: TableRow): number {
  return (
    b.points - a.points ||
    b.wins - a.wins ||
    b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst) ||
    b.goalsFor - a.goalsFor ||
    a.teamId.localeCompare(b.teamId)
  );
}

/** the table at any moment: every team, from the finished results given, in table order */
export function buildTable(teamIds: string[], results: Result[]): TableRow[] {
  const rows = new Map(teamIds.map((id) => [id, emptyRow(id)]));
  for (const r of results) addResult(rows, r);
  return [...rows.values()].sort(compareRows);
}

export interface StandingsRow {
  teamId: string;
  points: number;
  gamesPlayed: number;
}

/** sums points from final games (shared Game shape, used by the mock room flow) */
export function computeStandings(teamIds: string[], games: Game[]): StandingsRow[] {
  const results: Result[] = games
    .filter((g) => g.status === "final" && g.decidedIn)
    .map((g) => ({
      homeTeamId: g.homeTeamId,
      awayTeamId: g.awayTeamId,
      homeGoals: g.score.home,
      awayGoals: g.score.away,
      decidedIn: g.decidedIn!,
    }));
  return buildTable(teamIds, results).map((r) => ({ teamId: r.teamId, points: r.points, gamesPlayed: r.gamesPlayed }));
}

/**
 * the table if the game ended at this score: a lead is a regulation win,
 * a tie gives both teams the overtime point they are guaranteed.
 * rows must be in table order; that order breaks ties.
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

/**
 * the full table with one game forced to an outcome (home team's point of view), e.g. "if it
 * ends now". goals: the current score; a forced result adds the deciding goal when needed
 */
export function tableWithOutcome(
  table: TableRow[],
  game: { homeTeamId: string; awayTeamId: string },
  outcome: GameOutcome,
  score: Score = { home: 0, away: 0 },
): (TableRow & { rank: number })[] {
  const rows = new Map(table.map((r) => [r.teamId, { ...r }]));
  const homeWins = outcome === "regulationWin" || outcome === "overtimeWin";
  const decidedIn: DecidedIn = outcome === "regulationWin" || outcome === "regulationLoss" ? "regulation" : "overtime";
  let { home, away } = score;
  if (homeWins && home <= away) home = away + 1;
  if (!homeWins && away <= home) away = home + 1;
  addResult(rows, { homeTeamId: game.homeTeamId, awayTeamId: game.awayTeamId, homeGoals: home, awayGoals: away, decidedIn });
  return [...rows.values()].sort(compareRows).map((r, i) => ({ ...r, rank: i + 1 }));
}
