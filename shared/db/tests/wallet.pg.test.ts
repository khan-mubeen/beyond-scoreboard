// the atomic spend on the real database: purchase_subscription / redeem_offer under parallel load.
// it writes to supabase, so it only runs with RUN_PG_TESTS=true (and SUPABASE_URL +
// SUPABASE_SECRET_KEY, read from .env); its fans are removed afterwards.
// run: RUN_PG_TESTS=true npx vitest run shared/db/tests/wallet.pg.test.ts
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "../types";

const run = process.env.RUN_PG_TESTS === "true";
if (run) {
  try {
    process.loadEnvFile(".env");
  } catch {
    // the shell environment
  }
}

describe.skipIf(!run)("atomic spend (postgres)", () => {
  let db: Db;
  const made: string[] = [];
  const fan = async (points: number) => {
    const u = await db.users.create(`test:pg-${randomUUID()}`, "pg test");
    made.push(u.id);
    if (points) await db.points.award({ userId: u.id, matchId: null, callId: null, points, reason: "welcome" });
    return u.id;
  };
  const buy = (userId: string, key: string, points = 350) => db.wallet.purchase({ userId, planId: "sports-pass", points, amountEur: 4.4, days: 30, idempotencyKey: key });

  beforeAll(async () => {
    const { createSupabaseDb, supabaseAdmin } = await import("../supabase");
    db = createSupabaseDb(supabaseAdmin(process.env.SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!));
  });
  afterAll(async () => {
    for (const id of made) await db.users.remove(id);
  });

  it("10 parallel purchases with points for one: exactly one succeeds, the balance never goes below zero", async () => {
    const u = await fan(350);
    const results = await Promise.all(Array.from({ length: 10 }, () => buy(u, randomUUID())));
    expect(results.filter((r) => r.status === "ok")).toHaveLength(1);
    expect(results.filter((r) => r.status === "insufficient")).toHaveLength(9);
    expect(await db.wallet.balance(u)).toBe(0);
    expect((await db.points.listForUser(u)).filter((p) => p.reason === "subscription")).toHaveLength(1);
    expect(await db.wallet.subscriptions(u)).toHaveLength(1);
  }, 60_000);

  it("the same idempotency key twice at once: one subscription, one debit", async () => {
    const u = await fan(1000);
    const key = randomUUID();
    const [a, b] = await Promise.all([buy(u, key), buy(u, key)]);
    expect([a.status, b.status]).toEqual(["ok", "ok"]);
    expect([a.status === "ok" && a.replayed, b.status === "ok" && b.replayed].sort()).toEqual([false, true]);
    expect(await db.wallet.subscriptions(u)).toHaveLength(1);
    expect(await db.wallet.balance(u)).toBe(650);
  }, 60_000);

  it("an offer under parallel clicks: one code, one debit", async () => {
    const u = await fan(600);
    const results = await Promise.all(Array.from({ length: 5 }, () => db.wallet.redeem({ userId: u, offerId: "tickets", points: 500, code: `KALEVA-DEMO-${randomUUID().slice(0, 8)}` })));
    expect(new Set(results.map((r) => (r.status === "ok" ? r.row.code : null))).size).toBe(1);
    expect(results.filter((r) => r.status === "ok" && !r.replayed)).toHaveLength(1);
    expect(await db.wallet.balance(u)).toBe(100);
  }, 60_000);

  it("the database refuses a purchase with no money in it", async () => {
    const u = await fan(1000);
    expect((await db.wallet.purchase({ userId: u, planId: "sports-pass", points: 0, amountEur: 0, days: 30, idempotencyKey: randomUUID() })).status).toBe("invalid");
  }, 60_000);
});
