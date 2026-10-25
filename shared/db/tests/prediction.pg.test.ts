// the match prediction on the real database: many servers asking for a match's prediction call at
// once get one call (create_call_once), and a fan's prediction is taken once. it writes to
// supabase, so it only runs with RUN_PG_TESTS=true; its fans are removed afterwards (the call rows
// of the made-up test match stay, like the other pg tests' feed lines).
// run: RUN_PG_TESTS=true npx vitest run shared/db/tests/prediction.pg.test.ts
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db, DbCall } from "../types";

const run = process.env.RUN_PG_TESTS === "true";
if (run) {
  try {
    process.loadEnvFile(".env");
  } catch {
    // the shell environment
  }
}

describe.skipIf(!run)("match prediction (postgres)", () => {
  let db: Db;
  const made: string[] = [];
  const MATCH = `test-${randomUUID().slice(0, 8)}`;
  const call = (trigger: string): Omit<DbCall, "id"> => ({
    matchId: MATCH,
    type: "who_wins",
    trigger,
    question: "Who wins?",
    options: ["home_win", "home_ot", "away_ot", "away_win"].map((id) => ({ id, label: id })),
    stakesLine: null,
    openedGameTime: 0,
    openedAt: new Date().toISOString(),
    locksAt: new Date(Date.now() + 60_000).toISOString(),
    lockGameTime: null,
    resolvesRule: { kind: "who_wins" },
    status: "open",
    correctOptionId: null,
    resolvedAt: null,
    i18n: null,
  });

  beforeAll(async () => {
    const { createSupabaseDb, supabaseAdmin } = await import("../supabase");
    db = createSupabaseDb(supabaseAdmin(process.env.SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!));
  });
  afterAll(async () => {
    for (const id of made) await db.users.remove(id);
  });

  it("10 servers asking at once make one call for the match and cycle", async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => db.calls.createOnce(call("run:1:who_wins"))));
    expect(new Set(results.map((r) => r.call.id)).size).toBe(1);
    expect(results.filter((r) => r.created)).toHaveLength(1);
    expect((await db.calls.listForMatch(MATCH)).filter((c) => c.trigger === "run:1:who_wins")).toHaveLength(1);
    // the next cycle is a call of its own
    const next = await db.calls.createOnce(call("run:2:who_wins"));
    expect(next.created).toBe(true);
    expect(next.call.id).not.toBe(results[0].call.id);
  });

  it("a fan's prediction is taken once, even when sent five times at once", async () => {
    const u = await db.users.create(`test:pg-${randomUUID()}`, "pg test");
    made.push(u.id);
    const { call: c } = await db.calls.createOnce(call("run:3:who_wins"));
    const tries = await Promise.all(["home_win", "away_win", "home_ot", "home_win", "away_ot"].map((optionId) => db.answers.create({ callId: c.id, userId: u.id, optionId, answeredAt: new Date().toISOString() })));
    expect(tries.filter((t) => t === "ok")).toHaveLength(1);
    expect(await db.answers.listForCall(c.id)).toHaveLength(1);
  });
});
