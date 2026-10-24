import type { Result } from "./standings";

export interface TeamStrength {
  /** goals scored vs the league average, 1 = average */
  attack: number;
  /** goals allowed vs the league average, 1 = average (lower is better) */
  defence: number;
}

export interface StrengthModel {
  /** regulation goals per team per game, league-wide */
  avgGoals: number;
  /** home goals / away goals, shrunk toward a typical 1.08 */
  homeAdvantage: number;
  /** share of overtime/shootout games won by the home team, shrunk toward 0.5 */
  otHomeWinRate: number;
  teams: Map<string, TeamStrength>;
}

export interface StrengthResult extends Result {
  /** post-game expected goals, when the schedule has them */
  xg?: [number, number] | null;
}

export interface StrengthOptions {
  /** games of "average" a team is shrunk toward */
  k?: number;
  /** weight of expected goals vs real goals when xg is present */
  xgWeight?: number;
}

/** regulation goals: an overtime or shootout game was level after 60 minutes */
const regulationGoals = (r: Result): [number, number] =>
  r.decidedIn === "regulation" ? [r.homeGoals, r.awayGoals] : [Math.min(r.homeGoals, r.awayGoals), Math.min(r.homeGoals, r.awayGoals)];

/** goals for/against per game, shrunk toward the league average with k games of prior */
export function fitStrength(teamIds: string[], results: StrengthResult[], opts: StrengthOptions = {}): StrengthModel {
  const k = opts.k ?? 10;
  const w = opts.xgWeight ?? 0.5;
  const gf = new Map(teamIds.map((id) => [id, 0]));
  const ga = new Map(teamIds.map((id) => [id, 0]));
  const gp = new Map(teamIds.map((id) => [id, 0]));
  let homeGoals = 0;
  let awayGoals = 0;
  let ot = 0;
  let otHome = 0;

  for (const r of results) {
    const [h, a] = regulationGoals(r);
    const [xh, xa] = r.xg ? [w * r.xg[0] + (1 - w) * h, w * r.xg[1] + (1 - w) * a] : [h, a];
    gf.set(r.homeTeamId, (gf.get(r.homeTeamId) ?? 0) + xh);
    ga.set(r.homeTeamId, (ga.get(r.homeTeamId) ?? 0) + xa);
    gf.set(r.awayTeamId, (gf.get(r.awayTeamId) ?? 0) + xa);
    ga.set(r.awayTeamId, (ga.get(r.awayTeamId) ?? 0) + xh);
    gp.set(r.homeTeamId, (gp.get(r.homeTeamId) ?? 0) + 1);
    gp.set(r.awayTeamId, (gp.get(r.awayTeamId) ?? 0) + 1);
    homeGoals += h;
    awayGoals += a;
    if (r.decidedIn !== "regulation") {
      ot++;
      if (r.homeGoals > r.awayGoals) otHome++;
    }
  }

  const n = results.length;
  const avgGoals = n ? (homeGoals + awayGoals) / (2 * n) : 2.8;
  const rawHa = awayGoals > 0 ? homeGoals / awayGoals : 1.08;
  const homeAdvantage = (rawHa * n + 1.08 * 50) / (n + 50);
  const otHomeWinRate = (otHome + 0.5 * 20) / (ot + 20);

  const teams = new Map<string, TeamStrength>();
  for (const id of new Set([...teamIds, ...gp.keys()])) {
    const g = gp.get(id) ?? 0;
    teams.set(id, {
      attack: ((gf.get(id) ?? 0) + k * avgGoals) / ((g + k) * avgGoals),
      defence: ((ga.get(id) ?? 0) + k * avgGoals) / ((g + k) * avgGoals),
    });
  }
  return { avgGoals, homeAdvantage, otHomeWinRate, teams };
}

/** expected regulation goals for one game: poisson means for home and away */
export function expectedGoals(model: StrengthModel, homeTeamId: string, awayTeamId: string): [number, number] {
  const h = model.teams.get(homeTeamId) ?? { attack: 1, defence: 1 };
  const a = model.teams.get(awayTeamId) ?? { attack: 1, defence: 1 };
  const ha = Math.sqrt(model.homeAdvantage);
  return [model.avgGoals * h.attack * a.defence * ha, (model.avgGoals * a.attack * h.defence) / ha];
}
