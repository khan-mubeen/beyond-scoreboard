// the points economy without the server: the plans keep money required, the checkout's numbers,
// and the memory db's atomic spend (the postgres functions are tested in shared/db/tests)
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { checkPlans, clampPoints, defaultPoints, halfPriceInPoints, planById, PLANS, POINTS_PER_EURO, quote, summaryText, type Plan } from "@/shared/config/plans";
import { createMemoryDb } from "@/shared/db";
import { checkText } from "@/shared/guardrails";
import { balanceOf, isEarned } from "@/shared/points";
import { CheckoutForm, DEMO_PAYMENT_NOTE } from "../components/Checkout";
import { OFFER_NOTE } from "../components/RewardCards";
import { FREE_NOTE } from "../components/StreamLock";

const pass = planById("sports-pass")!;

describe("plans: money is always required", () => {
  it("the three plans, 100 points = €1, every cap at most half of the price", () => {
    expect(POINTS_PER_EURO).toBe(100);
    expect(PLANS.map((p) => [p.name, p.priceCents, p.maxPointsUsable, p.includesLiveStream])).toEqual([
      ["Kaleva Digital", 1290, 600, false],
      ["Kaleva Sports Pass", 790, 350, true],
      ["Weekend Pass", 390, 150, true],
    ]);
    expect(checkPlans()).toEqual([]);
    for (const p of PLANS) expect(p.maxPointsUsable).toBeLessThanOrEqual(halfPriceInPoints(p.priceCents));
  });

  it("the startup check refuses a plan that points could pay for more than half", () => {
    const greedy: Plan = { ...pass, id: "weekend", maxPointsUsable: 400 };
    expect(checkPlans([greedy])[0]).toMatch(/more than half/);
    expect(checkPlans([{ ...pass, priceCents: 0 }]).length).toBeGreaterThan(0);
  });

  it("even 10,000 points leave part of the price to pay in money", () => {
    for (const p of PLANS) {
      const most = defaultPoints(p, 10_000);
      expect(most).toBe(p.maxPointsUsable);
      expect(quote(p, most).payCents).toBeGreaterThan(0);
    }
  });

  it("the new copy passes the guardrails", () => {
    for (const t of [DEMO_PAYMENT_NOTE, OFFER_NOTE, FREE_NOTE, ...PLANS.flatMap((p) => [p.name, p.description, ...p.includes])]) expect(checkText(t), t).toEqual([]);
  });
});

describe("checkout numbers", () => {
  it("starts at the most points allowed: the balance when low, the cap when high", () => {
    expect(defaultPoints(pass, 120)).toBe(120);
    expect(defaultPoints(pass, 1250)).toBe(350);
    expect(defaultPoints(pass, 0)).toBe(0);
  });

  it("clamps whatever is typed to 0 … the cap", () => {
    expect(clampPoints(pass, 1250, -5)).toBe(0);
    expect(clampPoints(pass, 1250, 999)).toBe(350);
    expect(clampPoints(pass, 1250, 12.7)).toBe(12);
    expect(clampPoints(pass, 200, 300)).toBe(200);
    expect(clampPoints(pass, 1250, Number.NaN)).toBe(0);
  });

  it("the summary follows the points", () => {
    expect(summaryText(pass, 350)).toBe("Points used: 350 (−€3.50) · You pay: €4.40");
    expect(summaryText(pass, 120)).toBe("Points used: 120 (−€1.20) · You pay: €6.70");
    expect(summaryText(pass, 0)).toBe("Points used: 0 (−€0.00) · You pay: €7.90");
  });

  it("the form renders the default and its summary, for a low and a high balance", () => {
    const html = (balance: number) => renderToString(createElement(CheckoutForm, { plan: pass, balance, onDone: () => {} })).replace(/<!-- -->/g, "");
    expect(html(1250)).toContain('value="350"');
    expect(html(1250)).toContain("Points used: 350 (−€3.50) · You pay: €4.40");
    expect(html(1250)).toContain("Use up to 350 points");
    expect(html(80)).toContain('value="80"');
    expect(html(80)).toContain("You pay: €7.10");
    expect(html(80)).toContain(DEMO_PAYMENT_NOTE);
  });
});

describe("the ledger", () => {
  it("the balance is every row; boards count earned points only", () => {
    const rows = [
      { points: 1250, reason: "welcome" },
      { points: 20, reason: "call: who wins?" },
      { points: -350, reason: "subscription" },
    ];
    expect(balanceOf(rows)).toBe(920);
    expect(balanceOf(rows.filter(isEarned))).toBe(20);
  });
});

describe("atomic spend (memory)", () => {
  const buy = (db: ReturnType<typeof createMemoryDb>, userId: string, key: string, points = 350) =>
    db.wallet.purchase({ userId, planId: "sports-pass", points, amountEur: 4.4, days: 30, idempotencyKey: key });

  it("10 parallel purchases with points for one: exactly one succeeds, the balance never goes below zero", async () => {
    const db = createMemoryDb();
    const u = await db.users.create("anon-a", "A");
    await db.points.award({ userId: u.id, matchId: null, callId: null, points: 350, reason: "welcome" });
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => buy(db, u.id, `key-${i}`)));
    expect(results.filter((r) => r.status === "ok")).toHaveLength(1);
    expect(results.filter((r) => r.status === "insufficient")).toHaveLength(9);
    expect(await db.wallet.balance(u.id)).toBe(0);
    expect((await db.points.listForUser(u.id)).filter((p) => p.reason === "subscription")).toHaveLength(1);
    expect(await db.wallet.subscriptions(u.id)).toHaveLength(1);
  });

  it("the same idempotency key, even twice at once, is one subscription and one debit", async () => {
    const db = createMemoryDb();
    const u = await db.users.create("anon-b", "B");
    await db.points.award({ userId: u.id, matchId: null, callId: null, points: 1000, reason: "welcome" });
    const [a, b] = await Promise.all([buy(db, u.id, "same-key"), buy(db, u.id, "same-key")]);
    expect([a.status, b.status]).toEqual(["ok", "ok"]);
    expect([a.status === "ok" && a.replayed, b.status === "ok" && b.replayed].sort()).toEqual([false, true]);
    expect(await db.wallet.subscriptions(u.id)).toHaveLength(1);
    expect(await db.wallet.balance(u.id)).toBe(650);
    // another fan can't reuse it
    const other = await db.users.create("anon-c", "C");
    expect((await buy(db, other.id, "same-key", 0)).status).toBe("conflict");
  });

  it("a second purchase of the same plan extends it from its end", async () => {
    const db = createMemoryDb();
    const u = await db.users.create("anon-d", "D");
    const first = await buy(db, u.id, "k1", 0);
    const second = await buy(db, u.id, "k2", 0);
    if (first.status !== "ok" || second.status !== "ok") throw new Error("expected both to pass");
    expect(second.row.startedAt).toBe(first.row.expiresAt);
    expect(Date.parse(second.row.expiresAt) - Date.parse(first.row.startedAt)).toBeCloseTo(60 * 86_400_000, -4);
  });

  it("an offer: once per fan, parallel clicks spend once", async () => {
    const db = createMemoryDb();
    const u = await db.users.create("anon-e", "E");
    await db.points.award({ userId: u.id, matchId: null, callId: null, points: 600, reason: "welcome" });
    const results = await Promise.all(Array.from({ length: 5 }, (_, i) => db.wallet.redeem({ userId: u.id, offerId: "tickets", points: 500, code: `CODE-${i}` })));
    const codes = new Set(results.map((r) => (r.status === "ok" ? r.row.code : null)));
    expect(codes.size).toBe(1);
    expect(results.filter((r) => r.status === "ok" && !r.replayed)).toHaveLength(1);
    expect(await db.wallet.balance(u.id)).toBe(100);
  });
});
