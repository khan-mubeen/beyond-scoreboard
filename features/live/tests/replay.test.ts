// the demo replay on real recorded games: what a fan sees at game time t depends only on what
// happened up to t. a different future gives the same game, and the same calls
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeGame, type GameDTO, type LiigaGame } from "@/features/liiga";
import { gameAt, REGULATION, replayEnd, replayTime } from "../engine/replay";
import { nextCall } from "../engine/rules";

const DIR = new URL("../../liiga/snapshots/", import.meta.url);
const finished: LiigaGame[] = readdirSync(DIR)
  .filter((f) => /^games_\d+_\d+\.json$/.test(f))
  .map((f) => normalizeGame((JSON.parse(readFileSync(new URL(f, DIR), "utf8")) as { game: GameDTO }).game))
  .filter((g) => g.status === "final");

/** the same past, another future: later goals flipped, later penalties gone, other totals */
function otherFuture(full: LiigaGame, t: number): LiigaGame {
  const goals = full.goals.map((g) => (g.gameTime > t ? { ...g, side: g.side === "home" ? ("away" as const) : ("home" as const), scorer: "Someone Else" } : g));
  return {
    ...full,
    goals,
    penalties: full.penalties.filter((p) => p.gameTime <= t).map((p) => (p.end > t ? { ...p, end: p.end + 17 } : p)),
    home: { ...full.home, goals: full.home.goals + 4 },
    decidedIn: full.decidedIn === "regulation" ? "overtime" : "regulation",
    powerPlay: { home: { instances: 9, goals: 9 }, away: { instances: 0, goals: 0 } },
    video: { url: "https://example.com/future", thumb: null },
  };
}

const times = (g: LiigaGame) => [...new Set([1, 600, 1199, 1200, 2400, REGULATION - 1, ...g.goals.flatMap((x) => [x.gameTime - 1, x.gameTime]), ...g.penalties.map((p) => p.gameTime)])].filter((t) => t > 0 && t < REGULATION);

describe("demo replay on recorded games", () => {
  it("has finished games to replay, including a shootout", () => {
    expect(finished.length).toBeGreaterThanOrEqual(10);
    expect(finished.some((g) => g.decidedIn === "shootout")).toBe(true);
  });

  it.each(finished.map((g) => [g.id, g] as const))("%s: a different future changes nothing before it happens", (_id, full) => {
    for (const t of times(full)) {
      const seen = gameAt(full, t);
      expect(gameAt(otherFuture(full, t), t)).toEqual(seen);
      const ctx = { lastOpenedAt: null, hasOpenCall: false, used: new Set<string>() };
      expect(nextCall(gameAt(otherFuture(full, t), t), ctx)).toEqual(nextCall(seen, ctx));
    }
  });

  it.each(finished.map((g) => [g.id, g] as const))("%s: nothing from the future or the final totals while live", (_id, full) => {
    for (const t of times(full)) {
      const g = gameAt(full, t);
      expect(g.status).toBe("live");
      expect(g.decidedIn).toBeNull();
      expect(g.powerPlay).toBeNull();
      expect(g.video).toBeNull();
      expect(g.goals.every((x) => x.gameTime <= t)).toBe(true);
      expect(g.penalties.every((p) => p.gameTime <= t)).toBe(true);
      expect(g.home.goals + g.away.goals).toBe(g.goals.length);
      // a penalty still running shows its planned end, not the real one (that may be a later goal)
      for (const p of g.penalties.filter((x) => x.end > t)) expect(p.end).toBe(p.begin + p.minutes * 60);
      expect(Number.isInteger(g.gameTime)).toBe(true);
    }
  });

  it.each(finished.map((g) => [g.id, g] as const))("%s: ends as the real game did", (_id, full) => {
    const end = gameAt(full, replayEnd(full));
    expect(end.status).toBe("final");
    expect(end.decidedIn).toBe(full.decidedIn);
    expect(end.goals).toEqual(full.goals);
    // the score counted from the goals is the official one (disallowed goals don't count)
    expect([end.home.goals, end.away.goals]).toEqual([full.home.goals, full.away.goals]);
    expect(gameAt(full, 0).status).toBe("scheduled");
  });

  it("runs the clock at its speed, frozen while paused, whole seconds in the game", () => {
    const clock = { startedAt: 1_000, pausedAt: null, offset: 0, speed: 15 };
    expect(replayTime(clock, 3_000)).toBe(30);
    expect(replayTime({ ...clock, pausedAt: 2_000 }, 9_000)).toBe(15);
    expect(replayTime({ ...clock, startedAt: null, offset: 42 }, 9_000)).toBe(42);
    expect(gameAt(finished[0], 10.7).gameTime).toBe(10);
  });
});
