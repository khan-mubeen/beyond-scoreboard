// a plan stamped by the database's clock, a little ahead of the server's, is running at once
import { describe, expect, it } from "vitest";
import type { DbSubscription } from "@/shared/db";
import { activePlans } from "../server/wallet";

const sub = (startOffsetMs: number, days = 30): DbSubscription => {
  const start = Date.now() + startOffsetMs;
  return {
    id: "s",
    userId: "u",
    planId: "sports-pass",
    startedAt: new Date(start).toISOString(),
    expiresAt: new Date(start + days * 86_400_000).toISOString(),
    pointsUsed: 0,
    demoAmountEur: 7.9,
    status: "active",
    idempotencyKey: "k",
    createdAt: new Date().toISOString(),
  };
};

describe("running plans and the database clock", () => {
  it("a plan the database started a second 'in the future' is active now", () => {
    expect(activePlans([sub(1500)])).toHaveLength(1);
  });
  it("an extension queued days ahead doesn't count on its own", () => {
    expect(activePlans([sub(5 * 86_400_000)])).toHaveLength(0);
  });
});
