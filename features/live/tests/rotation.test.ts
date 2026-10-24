// the demo rotation: phases on time and looping, host controls, the video-driven game clock,
// and planned calls that never have a goal on screen while answers are open
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeGame, type GameDTO, type LiigaGame } from "@/features/liiga";
import { replayEnd } from "../engine/replay";
import {
  controlClock,
  cycleLengthOf,
  gameAtVideo,
  gameTimeAtVideo,
  goalVideoTimes,
  planCalls,
  rotationAt,
  type Cue,
  type RotationTiming,
} from "../engine/rotation";

const T: RotationTiming = {
  lobbySeconds: 60,
  summarySeconds: 600,
  matches: [
    { matchId: "a", durationSec: 200 },
    { matchId: "b", durationSec: 300 },
    { matchId: "c", durationSec: 250 },
  ],
};
const E = 1_000_000_000_000;
const at = (s: number) => E + s * 1000;

describe("rotation schedule", () => {
  it("runs lobby -> live -> summary for each match, then loops", () => {
    expect(cycleLengthOf(T)).toBe((3 * 660 + 750) * 1000);
    const clock = { epoch: E, pausedAt: null };
    expect(rotationAt(T, clock, at(0))).toMatchObject({ cycle: 0, phase: "lobby", current: { matchId: "a" } });
    expect(rotationAt(T, clock, at(60))).toMatchObject({ phase: "live", current: { matchId: "a" } });
    expect(rotationAt(T, clock, at(260))).toMatchObject({ phase: "summary", current: { matchId: "a" }, next: { matchId: "b" } });
    expect(rotationAt(T, clock, at(860))).toMatchObject({ phase: "lobby", current: { matchId: "b" } });
    const last = rotationAt(T, clock, at(2729));
    expect(last).toMatchObject({ phase: "summary", current: { matchId: "c" }, next: { matchId: "a", lobbyAt: at(2730) } });
    expect(rotationAt(T, clock, at(2730))).toMatchObject({ cycle: 1, phase: "lobby", current: { matchId: "a" }, cycleStart: at(2730) });
  });

  it("gives every phase its start and end", () => {
    const r = rotationAt(T, { epoch: E, pausedAt: null }, at(100));
    expect([r.phaseStart, r.phaseEnd]).toEqual([at(60), at(260)]);
  });

  it("host controls: skip to the next phase, pause holds, resume continues, restart begins again", () => {
    let clock = { epoch: E, pausedAt: null as number | null };
    clock = controlClock(T, clock, "skip", at(10));
    expect(rotationAt(T, clock, at(10))).toMatchObject({ phase: "live", phaseStart: at(10) });
    clock = controlClock(T, clock, "pause", at(20));
    expect(rotationAt(T, clock, at(500)).phase).toBe("live");
    clock = controlClock(T, clock, "resume", at(500));
    // 10 s of live had passed when it paused; 190 s of the 200 s highlight remain
    expect(rotationAt(T, clock, at(500)).phaseEnd).toBe(at(690));
    clock = controlClock(T, clock, "restart", at(900));
    expect(rotationAt(T, clock, at(900))).toMatchObject({ cycle: 0, phase: "lobby", current: { matchId: "a" } });
  });
});

const DIR = new URL("../../liiga/snapshots/", import.meta.url);
const finished = readdirSync(DIR)
  .filter((f) => /^games_\d+_\d+\.json$/.test(f))
  .map((f) => normalizeGame((JSON.parse(readFileSync(new URL(f, DIR), "utf8")) as { game: GameDTO }).game))
  .filter((g) => g.status === "final" && g.goals.length >= 2);

/** cues spread over the video, one per goal, as demo:cues would find them */
const cuesFor = (g: LiigaGame, duration: number): Cue[] =>
  g.goals.filter((x) => x.gameTime < replayEnd(g)).map((x, i, all) => ({ goalId: x.id, gameTime: x.gameTime, videoSec: ((i + 1) * duration) / (all.length + 1) }));

describe("video-driven game clock", () => {
  it.each(finished.map((g) => [g.id, g] as const))("%s: each goal appears exactly at its cue, the game ends with the video", (_id, g) => {
    const duration = 240;
    const cues = cuesFor(g, duration);
    for (const c of cues) {
      expect(gameTimeAtVideo(g, cues, duration, c.videoSec)).toBe(c.gameTime);
      const before = gameAtVideo(g, cues, duration, c.videoSec - 0.5);
      const after = gameAtVideo(g, cues, duration, c.videoSec);
      expect(after.goals.some((x) => x.id === c.goalId)).toBe(true);
      expect(before.goals.some((x) => x.id === c.goalId)).toBe(false);
    }
    expect(gameAtVideo(g, cues, duration, duration).status).toBe("final");
    expect(gameAtVideo(g, cues, duration, duration - 1).status).toBe("live");
  });

  it("without cues it maps the video straight onto the game", () => {
    const g = finished[0];
    expect(gameTimeAtVideo(g, [], 300, 150)).toBeCloseTo(replayEnd(g) / 2, 5);
  });
});

describe("planned calls", () => {
  it.each(finished.map((g) => [g.id, g] as const))("%s: calls open with no goal on screen while answers are open", (_id, g) => {
    const duration = 300;
    const cues = cuesFor(g, duration);
    const plan = planCalls(g, cues, duration, { answerSeconds: 20 });
    const goals = [...goalVideoTimes(g, cues, duration).values()];
    // a goal every 20 s of video (15 goals in 300 s) leaves no quiet window: no calls is right then
    if (g.goals.length <= 10) expect(plan.length).toBeGreaterThan(0);
    for (const p of plan) {
      expect(goals.filter((v) => v > p.videoSec && v <= p.videoSec + 25)).toEqual([]);
      expect(p.draft.kind).not.toBe("who_wins");
    }
    for (let i = 1; i < plan.length; i++) expect(plan[i].videoSec - plan[i - 1].videoSec).toBeGreaterThanOrEqual(28);
  });
});
