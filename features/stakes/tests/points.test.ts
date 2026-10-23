import { describe, expect, it } from "vitest";
import { mockGames } from "@/shared/mock";
import type { DecidedIn, Game } from "@/shared/types";
import { computeStandings, pointsForGame, projectTable } from "../engine/standings";

const decided: DecidedIn[] = ["regulation", "overtime", "shootout"];
const scores = [
  { home: 3, away: 1 },
  { home: 1, away: 3 },
  { home: 2, away: 1 },
  { home: 4, away: 5 },
];

describe("points", () => {
  it("every game awards 2 or 3 points in total", () => {
    for (const decidedIn of decided) {
      for (const score of scores) {
        const p = pointsForGame({ decidedIn, score });
        expect([2, 3]).toContain(p.home + p.away);
      }
    }
  });

  it("follows the liiga point split", () => {
    expect(pointsForGame({ decidedIn: "regulation", score: { home: 3, away: 1 } })).toEqual({ home: 3, away: 0 });
    expect(pointsForGame({ decidedIn: "overtime", score: { home: 2, away: 3 } })).toEqual({ home: 1, away: 2 });
    expect(pointsForGame({ decidedIn: "shootout", score: { home: 3, away: 2 } })).toEqual({ home: 2, away: 1 });
  });

  it("standings hand out exactly the points the games did", () => {
    const finals = mockGames.filter((g): g is Game => g.status === "final");
    const teamIds = [...new Set(finals.flatMap((g) => [g.homeTeamId, g.awayTeamId]))];
    const table = computeStandings(teamIds, finals);
    const fromGames = finals.reduce((sum, g) => sum + pointsForGame(g).home + pointsForGame(g).away, 0);
    expect(table.reduce((sum, r) => sum + r.points, 0)).toBe(fromGames);
  });

  it("a goal can move a team across a zone line in the projected table", () => {
    // 11 teams clear at the top, "a" holds 12th, "b" sits 13th, 4 teams far below
    const points = [40, 39, 38, 37, 36, 35, 34, 33, 32, 31, 30, 19, 17, 10, 9, 8, 7];
    const ids = [...Array.from({ length: 11 }, (_, i) => `top${i}`), "a", "b", "low0", "low1", "low2", "low3"];
    const rows = ids.map((teamId, i) => ({ teamId, points: points[i], gamesPlayed: 14 }));
    const game = { homeTeamId: "b", awayTeamId: "low0" };
    const tied = projectTable(rows, game, { home: 0, away: 0 });
    const lead = projectTable(rows, game, { home: 1, away: 0 });
    expect(tied.find((r) => r.teamId === "b")?.zone).toBe("safe");
    expect(lead.find((r) => r.teamId === "b")?.zone).toBe("playoffs");
  });
});
