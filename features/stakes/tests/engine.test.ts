import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeFixture, normalizeStandings, type ScheduleItemDTO, type StandingsResponseDTO } from "@/features/liiga";
import { checkPlayoffLines } from "../engine/rules.config";
import { OUTCOMES, simulateSeason } from "../engine/simulation";
import { chanceTimeline, goalOfTheGame, ifEndsNow, leverage, tableIfEndsNow, worthFor } from "../engine/stakes";
import { buildTable, pointsOf, type Result } from "../engine/standings";
import { fitStrength } from "../engine/strength";
import { worldAt } from "../engine/world";

const snap = <T>(name: string): T =>
  JSON.parse(readFileSync(new URL(`../../liiga/snapshots/${name}.json`, import.meta.url), "utf8")) as T;
const schedule = snap<ScheduleItemDTO[]>("games_schedule__season-2027__serie-RUNKOSARJA").map(normalizeFixture);
const official = normalizeStandings(snap<StandingsResponseDTO>("standings_RUNKOSARJA__isLive-false__season-2027"));

describe("standings from finished results (real 2026-27 snapshot)", () => {
  const world = worldAt(schedule);

  it("every game gives 2 or 3 points", () => {
    for (const r of world.results) {
      const p = pointsOf(r);
      expect([2, 3]).toContain(p.home + p.away);
    }
  });

  it("the computed table equals the official standings, team by team", () => {
    expect(world.table.map((r) => r.teamId)).toEqual(official.rows.map((r) => r.teamId));
    for (const [i, row] of world.table.entries()) {
      const o = official.rows[i];
      expect({ team: row.teamId, gp: row.gamesPlayed, w: row.wins, otw: row.overtimeWins, otl: row.overtimeLosses, l: row.losses, gf: row.goalsFor, ga: row.goalsAgainst, pts: row.points }).toEqual({
        team: o.teamId,
        gp: o.games,
        w: o.wins,
        otw: o.overtimeWins,
        otl: o.overtimeLosses,
        l: o.losses,
        gf: o.goals,
        ga: o.goalsAgainst,
        pts: o.points,
      });
    }
  });

  it("our zone lines match the api's playoffsLines", () => {
    expect(checkPlayoffLines(official.playoffsLines)).toEqual([]);
    expect(checkPlayoffLines([4, 10, 14])).toHaveLength(1);
  });
});

describe("monte carlo", () => {
  const world = worldAt(schedule);
  const model = fitStrength(world.teamIds, world.results);
  const target = world.remaining[0].id;
  const t0 = performance.now();
  const forecast = simulateSeason({ table: world.table, remaining: world.remaining, model, n: 10_000, targets: [target] });
  const ms = performance.now() - t0;

  it("runs 10,000 seasons fast", () => {
    expect(ms).toBeLessThan(2000);
  });

  it("each position distribution sums to 1, and each position is filled once", () => {
    for (const t of Object.values(forecast.teams)) expect(t.positions.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    for (let pos = 0; pos < 17; pos++) {
      expect(Object.values(forecast.teams).reduce((a, t) => a + t.positions[pos], 0)).toBeCloseTo(1, 9);
    }
  });

  it("playoff, top-4 and relegation chances agree with the positions", () => {
    for (const t of Object.values(forecast.teams)) {
      expect(t.playoffs).toBeCloseTo(t.positions.slice(0, 12).reduce((a, b) => a + b, 0), 9);
      expect(t.top4).toBeCloseTo(t.positions.slice(0, 4).reduce((a, b) => a + b, 0), 9);
      expect(t.relegation).toBeCloseTo(t.positions.slice(14).reduce((a, b) => a + b, 0), 9);
    }
  });

  it("a forced win is worth at least as much as a forced loss", () => {
    const f = forecast.forced[target];
    for (const side of ["home", "away"] as const) {
      const w = worthFor(f, side);
      expect(w.regulationWin.playoffs).toBeGreaterThanOrEqual(w.overtimeWin.playoffs);
      expect(w.overtimeWin.playoffs).toBeGreaterThanOrEqual(w.overtimeLoss.playoffs);
      expect(w.overtimeLoss.playoffs).toBeGreaterThanOrEqual(w.regulationLoss.playoffs);
      expect(w.regulationLoss.relegation).toBeGreaterThanOrEqual(w.regulationWin.relegation);
    }
    expect(leverage(f)).toBeGreaterThan(0);
  });

  it("is repeatable with the same seed", () => {
    const again = simulateSeason({ table: world.table, remaining: world.remaining, model, n: 2000 });
    const again2 = simulateSeason({ table: world.table, remaining: world.remaining, model, n: 2000 });
    expect(again).toEqual(again2);
  });
});

describe("a team that cannot reach 12th", () => {
  it("has a playoff chance of 0 and a team that can't drop below 12th has 1", () => {
    const teams = Array.from({ length: 17 }, (_, i) => `t${i}`);
    // 16 teams far ahead on 100 points; t16 has 0 points and 2 games left (max 6 points)
    const results: Result[] = [];
    const table = buildTable(teams, results).map((r) => ({ ...r, points: r.teamId === "t16" ? 0 : 100 - Number(r.teamId.slice(1)) }));
    const remaining = [
      { id: "a", homeTeamId: "t16", awayTeamId: "t0" },
      { id: "b", homeTeamId: "t1", awayTeamId: "t16" },
    ];
    const model = fitStrength(teams, []);
    const f = simulateSeason({ table, remaining, model, n: 2000 });
    expect(f.teams.t16.playoffs).toBe(0);
    expect(f.teams.t16.relegation).toBe(1);
    expect(f.teams.t0.top4).toBe(1);
  });
});

describe("game stakes", () => {
  const worth = {
    regulationWin: { playoffs: 0.66, top4: 0, relegation: 0.03, positions: [] },
    overtimeWin: { playoffs: 0.62, top4: 0, relegation: 0.05, positions: [] },
    overtimeLoss: { playoffs: 0.57, top4: 0, relegation: 0.08, positions: [] },
    regulationLoss: { playoffs: 0.45, top4: 0, relegation: 0.12, positions: [] },
  };

  it("if it ends now: a lead is a regulation result, a tie is the overtime mix", () => {
    expect(ifEndsNow(worth, 2, 1).playoffs).toBe(0.66);
    expect(ifEndsNow(worth, 1, 2).playoffs).toBe(0.45);
    expect(ifEndsNow(worth, 1, 1, 0.5).playoffs).toBeCloseTo(0.595, 9);
  });

  it("the timeline and goal of the game come from the goal sequence", () => {
    const goals = [
      { id: "g1", homeScore: 1, awayScore: 0 },
      { id: "g2", homeScore: 1, awayScore: 1 },
      { id: "g3", homeScore: 2, awayScore: 1 },
    ];
    const tl = chanceTimeline(goals, "home", 0.54, worth);
    expect(tl.map((p) => Math.round(p.chance * 100))).toEqual([54, 66, 60, 66]);
    expect(goalOfTheGame(tl)?.goalId).toBe("g1");
    expect(OUTCOMES).toHaveLength(4);
  });

  it("the table if it ends now moves a leading team up", () => {
    const teams = ["a", "b", "c"];
    const table = buildTable(teams, [
      { homeTeamId: "a", awayTeamId: "b", homeGoals: 2, awayGoals: 1, decidedIn: "regulation" },
      { homeTeamId: "b", awayTeamId: "c", homeGoals: 2, awayGoals: 1, decidedIn: "regulation" },
    ]);
    const now = tableIfEndsNow(table, { homeTeamId: "c", awayTeamId: "a" }, { home: 3, away: 0 });
    expect(now[0].teamId).toBe("c");
  });
});
