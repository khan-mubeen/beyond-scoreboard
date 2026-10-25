// badges: their tier, and the moment each was reached (the answer, the settled call or the ledger row)
import { describe, expect, it } from "vitest";
import type { DbAnswer, DbCall } from "@/shared/db";
import { achievementsOf, callStats, unlockDates, type Played } from "../server/profile";

const at = (min: number) => new Date(Date.UTC(2026, 9, 20, 15, min)).toISOString();

function play(i: number, matchId: string, right: boolean): Played {
  const call = { id: `c${i}`, matchId, type: "next_goal", status: "resolved", correctOptionId: "a", openedAt: at(i), resolvedAt: at(i + 1) } as unknown as DbCall;
  const answer = { id: `a${i}`, callId: call.id, userId: "u", optionId: right ? "a" : "b", answeredAt: at(i), correct: right } as DbAnswer;
  return { call, answer };
}

describe("achievements", () => {
  const list = [play(1, "m1", false), play(2, "m1", true), play(3, "m1", true), play(4, "m1", true)];
  const earned = [
    { points: 60, createdAt: at(3) },
    { points: 60, createdAt: at(5) },
  ];
  const dates = unlockDates(list, earned);

  it("dates each badge when it was reached", () => {
    expect(dates["first-call"]).toBe(at(1));
    expect(dates["called-it"]).toBe(at(3));
    expect(dates["sharp-eye"]).toBe(at(5));
    expect(dates.century).toBe(at(5));
    expect(dates["hot-streak"]).toBeUndefined();
  });

  it("every badge has a tier; locked ones have no date, unlocked ones keep theirs", () => {
    const all = achievementsOf(callStats(list), { points: 120, follows: 0, joined: true, dates });
    expect(all).toHaveLength(8);
    for (const a of all) expect(["bronze", "silver", "gold"]).toContain(a.tier);
    const by = Object.fromEntries(all.map((a) => [a.id, a]));
    expect(by["sharp-eye"]).toMatchObject({ unlocked: true, unlockedAt: at(5), tier: "silver" });
    expect(by["hot-streak"]).toMatchObject({ unlocked: false, unlockedAt: null, tier: "gold", progress: { have: 3, need: 5 } });
    expect(by["team-player"]).toMatchObject({ unlocked: true, unlockedAt: null });
  });
});
