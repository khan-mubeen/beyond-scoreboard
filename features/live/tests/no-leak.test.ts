import { describe, expect, it } from "vitest";
import { mockRoomStates } from "@/shared/mock";
import type { Call, GoalEvent } from "@/shared/types";
import { toPublicCall } from "../calls/public";
import { scheduleCalls } from "../calls/schedule";
import { stateAt } from "../replay/state-at";

const game = { id: "g", homeTeamId: "home", awayTeamId: "away" };
const goal = (id: string, teamId: string, t: number): GoalEvent => ({
  id,
  gameId: "g",
  teamId,
  gameTimeSeconds: t,
  period: Math.min(3, Math.floor(t / 1200) + 1),
});

const events = [goal("1", "home", 462), goal("2", "away", 1455), goal("3", "away", 2190), goal("4", "home", 2885)];

/** the same past with different futures */
function futuresAfter(t: number): GoalEvent[][] {
  const past = events.filter((e) => e.gameTimeSeconds <= t);
  const future = events.filter((e) => e.gameTimeSeconds > t);
  const flip = (e: GoalEvent) => ({ ...e, teamId: e.teamId === "home" ? "away" : "home" });
  return [
    past,
    [...past, ...future.map(flip)],
    [...past, goal("x", "home", t + 1), goal("y", "away", t + 500)],
    [...future, ...past],
  ];
}

describe("no leak", () => {
  it.each([0, 462, 1500, 2400, 3000, 3600])("changing events after t=%i changes nothing", (t) => {
    const state = stateAt(events, t, game);
    const calls = scheduleCalls(events, t, game);
    for (const f of futuresAfter(t)) {
      expect(stateAt(f, t, game)).toEqual(state);
      expect(scheduleCalls(f, t, game)).toEqual(calls);
    }
    expect(state.events.every((e) => e.gameTimeSeconds <= t)).toBe(true);
  });

  it("scheduled calls never carry an answer", () => {
    for (const c of scheduleCalls(events, 3600, game)) expect(c.correctOptionId).toBeNull();
  });

  it("toPublicCall removes correctOptionId and leaves the call alone", () => {
    const call: Call = { ...scheduleCalls(events, 3600, game)[0], correctOptionId: "home" };
    const pub = toPublicCall(call);
    expect("correctOptionId" in pub).toBe(false);
    expect({ ...pub, correctOptionId: "home" }).toEqual(call);
    expect(call.correctOptionId).toBe("home");
  });

  it("no mock room state sends an answer or a future event to clients", () => {
    for (const s of mockRoomStates) {
      if (s.activeCall) expect("correctOptionId" in s.activeCall).toBe(false);
      expect(s.events.every((e) => e.gameTimeSeconds <= s.gameTimeSeconds)).toBe(true);
    }
  });
});
