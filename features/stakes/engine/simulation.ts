import type { GameOutcome } from "@/shared/types";
import { RULES } from "./rules.config";
import type { TableRow } from "./standings";
import { expectedGoals, type StrengthModel } from "./strength";
import { zoneForRank } from "./zones";

export interface Fixture {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
}

export interface SimulationInput {
  /** the table now, from finished results only */
  table: TableRow[];
  /** every game still to play (a live game counts as unplayed) */
  remaining: Fixture[];
  model: StrengthModel;
  /** simulated seasons */
  n?: number;
  seed?: number;
  /** games to also play out under each forced result ("what this game is worth") */
  targets?: string[];
}

/** chances 0-1 and the full position distribution (index 0 = 1st place) */
export interface TeamChances {
  playoffs: number;
  top4: number;
  relegation: number;
  positions: number[];
}

export interface TeamForecast extends TeamChances {
  expectedPoints: number;
}

/** chances for both teams of a target game, under each result from the home team's view */
export interface ForcedForecast {
  homeTeamId: string;
  awayTeamId: string;
  outcomes: Record<GameOutcome, { home: TeamChances; away: TeamChances }>;
}

export interface Forecast {
  n: number;
  teams: Record<string, TeamForecast>;
  forced: Record<string, ForcedForecast>;
}

export const OUTCOMES: GameOutcome[] = ["regulationWin", "overtimeWin", "overtimeLoss", "regulationLoss"];

/** small seeded generator so a forecast is repeatable */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MAX_GOALS = 15;
function poissonCdf(lambda: number): Float64Array {
  const cdf = new Float64Array(MAX_GOALS + 1);
  let p = Math.exp(-lambda);
  let acc = 0;
  for (let k = 0; k <= MAX_GOALS; k++) {
    acc += p;
    cdf[k] = acc;
    p *= lambda / (k + 1);
  }
  cdf[MAX_GOALS] = 1;
  return cdf;
}
function sample(cdf: Float64Array, u: number): number {
  let k = 0;
  while (u > cdf[k]) k++;
  return k;
}

// table order as one number: points, regulation wins, goal difference, goals for (see compareRows)
const key = (pts: number, rw: number, gd: number, gf: number) => ((pts * 100 + rw) * 1000 + gd + 500) * 1000 + gf;

const zoneCounts = () => ({ playoffs: 0, top4: 0, relegation: 0, positions: new Array<number>(RULES.teams).fill(0) });
type Counts = ReturnType<typeof zoneCounts>;
function count(c: Counts, rank: number) {
  c.positions[rank - 1]++;
  const z = zoneForRank(rank);
  if (z === "top4") c.top4++;
  if (z === "top4" || z === "playoffs") c.playoffs++;
  if (z === "relegated") c.relegation++;
}
const toChances = (c: Counts, n: number): TeamChances => ({
  playoffs: c.playoffs / n,
  top4: c.top4 / n,
  relegation: c.relegation / n,
  positions: c.positions.map((x) => x / n),
});

// what a forced result adds: [home pts, away pts, home rw, away rw, home gd, home gf, away gf]
const FORCED: Record<GameOutcome, [number, number, number, number, number, number, number]> = {
  regulationWin: [3, 0, 1, 0, 1, 3, 2],
  overtimeWin: [2, 1, 0, 0, 1, 3, 2],
  overtimeLoss: [1, 2, 0, 0, -1, 2, 3],
  regulationLoss: [0, 3, 0, 1, -1, 2, 3],
};

/**
 * monte carlo over the remaining fixtures: poisson regulation goals with home advantage,
 * a regulation tie goes to overtime/shootout at the observed home win rate.
 * each target game is replayed under all four results inside the same simulated seasons,
 * so the differences between results come from the game, not from random noise
 */
export function simulateSeason(input: SimulationInput): Forecast {
  const n = input.n ?? 10_000;
  const rand = mulberry32(input.seed ?? 20260424);
  const ids = input.table.map((r) => r.teamId);
  const idx = new Map(ids.map((id, i) => [id, i]));
  const T = ids.length;

  const basePts = Int32Array.from(input.table.map((r) => r.points));
  const baseRw = Int32Array.from(input.table.map((r) => r.wins));
  const baseGd = Int32Array.from(input.table.map((r) => r.goalsFor - r.goalsAgainst));
  const baseGf = Int32Array.from(input.table.map((r) => r.goalsFor));

  const games = input.remaining
    .filter((f) => idx.has(f.homeTeamId) && idx.has(f.awayTeamId))
    .map((f) => {
      const [lh, la] = expectedGoals(input.model, f.homeTeamId, f.awayTeamId);
      return { id: f.id, h: idx.get(f.homeTeamId)!, a: idx.get(f.awayTeamId)!, ch: poissonCdf(lh), ca: poissonCdf(la) };
    });
  const targetSet = new Set(input.targets ?? []);
  const targets = games.map((g, gi) => ({ g, gi })).filter(({ g }) => targetSet.has(g.id));

  const pts = new Int32Array(T);
  const rw = new Int32Array(T);
  const gd = new Int32Array(T);
  const gf = new Int32Array(T);
  const keys = new Float64Array(T);
  const order = Array.from({ length: T }, (_, i) => i);
  // per game in this season: [home pts, away pts, home rw, away rw, home gd, home gf, away gf]
  const played = games.map(() => new Int32Array(7));

  const teamCounts = ids.map(zoneCounts);
  const points = new Float64Array(T);
  const forcedCounts = targets.map(() =>
    Object.fromEntries(OUTCOMES.map((o) => [o, { home: zoneCounts(), away: zoneCounts() }])) as Record<GameOutcome, { home: Counts; away: Counts }>,
  );

  for (let s = 0; s < n; s++) {
    pts.set(basePts);
    rw.set(baseRw);
    gd.set(baseGd);
    gf.set(baseGf);
    for (let gi = 0; gi < games.length; gi++) {
      const g = games[gi];
      let hg = sample(g.ch, rand());
      let ag = sample(g.ca, rand());
      const rec = played[gi];
      if (hg === ag) {
        // overtime or shootout: the winner gets the extra goal
        if (rand() < input.model.otHomeWinRate) {
          hg++;
          rec[0] = 2;
          rec[1] = 1;
        } else {
          ag++;
          rec[0] = 1;
          rec[1] = 2;
        }
        rec[2] = 0;
        rec[3] = 0;
      } else if (hg > ag) {
        rec[0] = 3;
        rec[1] = 0;
        rec[2] = 1;
        rec[3] = 0;
      } else {
        rec[0] = 0;
        rec[1] = 3;
        rec[2] = 0;
        rec[3] = 1;
      }
      rec[4] = hg - ag;
      rec[5] = hg;
      rec[6] = ag;
      pts[g.h] += rec[0];
      pts[g.a] += rec[1];
      rw[g.h] += rec[2];
      rw[g.a] += rec[3];
      gd[g.h] += rec[4];
      gd[g.a] -= rec[4];
      gf[g.h] += rec[5];
      gf[g.a] += rec[6];
    }

    // a random fraction breaks remaining ties (head-to-head etc. we don't model)
    for (let t = 0; t < T; t++) keys[t] = key(pts[t], rw[t], gd[t], gf[t]) + rand();
    order.sort((x, y) => keys[y] - keys[x]);
    for (let r = 0; r < T; r++) {
      count(teamCounts[order[r]], r + 1);
      points[order[r]] += pts[order[r]];
    }

    // replay each target game under every result in this same season
    for (let ti = 0; ti < targets.length; ti++) {
      const { g, gi } = targets[ti];
      const rec = played[gi];
      const tie = keys[g.h] - Math.floor(keys[g.h]);
      const tieA = keys[g.a] - Math.floor(keys[g.a]);
      for (const o of OUTCOMES) {
        const f = FORCED[o];
        const kh = key(pts[g.h] - rec[0] + f[0], rw[g.h] - rec[2] + f[2], gd[g.h] - rec[4] + f[4], gf[g.h] - rec[5] + f[5]) + tie;
        const ka = key(pts[g.a] - rec[1] + f[1], rw[g.a] - rec[3] + f[3], gd[g.a] + rec[4] - f[4], gf[g.a] - rec[6] + f[6]) + tieA;
        let rh = 1;
        let ra = 1;
        for (let t = 0; t < T; t++) {
          if (t === g.h || t === g.a) continue;
          if (keys[t] > kh) rh++;
          if (keys[t] > ka) ra++;
        }
        if (ka > kh) rh++;
        else ra++;
        count(forcedCounts[ti][o].home, rh);
        count(forcedCounts[ti][o].away, ra);
      }
    }
  }

  const teams: Record<string, TeamForecast> = {};
  ids.forEach((id, i) => {
    teams[id] = { ...toChances(teamCounts[i], n), expectedPoints: points[i] / n };
  });
  const forced: Record<string, ForcedForecast> = {};
  targets.forEach(({ g }, ti) => {
    forced[g.id] = {
      homeTeamId: ids[g.h],
      awayTeamId: ids[g.a],
      outcomes: Object.fromEntries(
        OUTCOMES.map((o) => [o, { home: toChances(forcedCounts[ti][o].home, n), away: toChances(forcedCounts[ti][o].away, n) }]),
      ) as ForcedForecast["outcomes"],
    };
  });
  return { n, teams, forced };
}
