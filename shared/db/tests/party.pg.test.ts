// the watch party on the real database: the engine leader lease (one holder, atomic), presence,
// a once-only invite and guest pass under parallel use, and a system line posted once. it writes
// to supabase, so it only runs with RUN_PG_TESTS=true (and SUPABASE_URL + SUPABASE_SECRET_KEY,
// read from .env); its fans (and everything of theirs) are removed afterwards.
// run: RUN_PG_TESTS=true npx vitest run shared/db/tests/party.pg.test.ts
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
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe.skipIf(!run)("watch party (postgres)", () => {
  let db: Db;
  const made: string[] = [];
  const fan = async (nickname: string | null = "pg test") => {
    const u = await db.users.create(`test:pg-${randomUUID()}`, nickname);
    made.push(u.id);
    return u;
  };
  const MATCH = `test-${randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    const { createSupabaseDb, supabaseAdmin } = await import("../supabase");
    db = createSupabaseDb(
      supabaseAdmin(
        process.env.SUPABASE_URL!,
        (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!,
      ),
    );
  });
  afterAll(async () => {
    for (const id of made) await db.users.remove(id);
  });

  it("the leader lease: one holder at a time, renewable, released at once, free again once expired", async () => {
    const a = `test-a-${randomUUID().slice(0, 8)}`;
    const first = await db.leader.claim(a, 3);
    if (!first.leader) {
      // a real server holds it: a test instance must never take it from that server
      expect((await db.leader.claim(`${a}-b`, 3)).leader).toBe(false);
      return;
    }
    const others = await Promise.all(Array.from({ length: 10 }, (_, i) => db.leader.claim(`${a}-o${i}`, 3)));
    expect(others.every((r) => !r.leader && r.holder === a)).toBe(true);
    expect((await db.leader.claim(a, 3)).leader).toBe(true);
    await db.leader.release(a);
    // released: exactly one of ten racing servers gets it
    const race = await Promise.all(Array.from({ length: 10 }, (_, i) => db.leader.claim(`${a}-r${i}`, 2)));
    expect(race.filter((r) => r.leader)).toHaveLength(1);
    const winner = race.find((r) => r.leader)!.holder!;
    expect((await db.leader.claim(a, 2)).leader).toBe(false);
    // the winner "dies": two seconds later anyone can take it
    await sleep(2600);
    expect((await db.leader.claim(a, 2)).leader).toBe(true);
    await db.leader.release(a);
    expect(winner).not.toBe(a);
  }, 30_000);

  it("presence: a heartbeat joins, a repeat is no news, a leave keeps the row but not the activity", async () => {
    const [x, y] = [await fan("x"), await fan(null)];
    expect((await db.presence.beat(MATCH, "c1", x.id)).fresh).toBe(true);
    // the next heartbeat (30 s on) is no news
    expect((await db.presence.beat(MATCH, "c1", x.id, new Date(Date.now() + 30_000).toISOString())).fresh).toBe(false);
    expect((await db.presence.beat(MATCH, "c1", y.id)).fresh).toBe(true);
    await db.presence.leave(MATCH, "c1", y.id);
    const rows = await db.presence.list(MATCH, "c1");
    expect(rows).toHaveLength(2);
    const recent = await db.presence.seenSince([x.id, y.id], new Date(Date.now() - 90_000).toISOString());
    expect(recent.map((r) => r.userId)).toEqual([x.id]);
    // another cycle is another party
    expect(await db.presence.list(MATCH, "c2")).toEqual([]);
  }, 30_000);

  it("an invite is used once, even by five fans at the same moment; friends connect", async () => {
    const host = await fan("host");
    const code = `T${randomUUID().replace(/-/g, "").slice(0, 7).toUpperCase()}`;
    await db.invites.create({ code, inviterId: host.id, matchId: MATCH });
    expect(await db.invites.openCount(host.id)).toBe(1);
    const guests = await Promise.all(Array.from({ length: 5 }, () => fan("guest")));
    const used = await Promise.all(guests.map((g) => db.invites.use(code, g.id)));
    expect(used.filter(Boolean)).toHaveLength(1);
    expect(await db.invites.openCount(host.id)).toBe(0);
    const winner = used.find(Boolean)!.usedBy!;
    await db.friends.connect(host.id, winner, host.id);
    expect((await db.friends.list(winner)).map((f) => f.status)).toEqual(["accepted"]);
  }, 30_000);

  it("a guest pass: one per fan ever, consumed once (bound to one match and cycle)", async () => {
    const [host, guest] = [await fan("host"), await fan("guest")];
    expect(await db.passes.grant(guest.id, host.id)).toBe(true);
    expect(await db.passes.grant(guest.id, host.id)).toBe(false);
    const tries = await Promise.all([
      db.passes.consume(guest.id, MATCH, "c1"),
      db.passes.consume(guest.id, MATCH, "c1"),
      db.passes.consume(guest.id, `${MATCH}-2`, "c1"),
    ]);
    expect(tries.filter(Boolean)).toHaveLength(1);
    const p = await db.passes.get(guest.id);
    expect(p?.usedAt).toBeTruthy();
  }, 30_000);

  it("a system line goes in once per key; reactions once per fan and emoji", async () => {
    const u = await fan("reactor");
    const key = `test:${randomUUID()}`;
    const a = await db.comments.createOnce(
      { matchId: MATCH, userId: null, text: "GOAL! Test 1–0 · 01:00", kind: "system", cycle: "c1" },
      key,
    );
    const b = await db.comments.createOnce(
      { matchId: MATCH, userId: null, text: "GOAL! Test 1–0 · 01:00", kind: "system", cycle: "c1" },
      key,
    );
    expect([!!a, b]).toEqual([true, null]);
    expect(await db.comments.react(a!.id, u.id, "🔥")).toBe("ok");
    expect(await db.comments.react(a!.id, u.id, "🔥")).toBe("duplicate");
    expect((await db.comments.list(MATCH, 10, { cycle: "c1" })).map((c) => [c.kind, c.userId])).toEqual([
      ["system", null],
    ]);
    // system lines have no author: removed by hand (the fans' rows go with them)
    const { supabaseAdmin } = await import("../supabase");
    await supabaseAdmin(
      process.env.SUPABASE_URL!,
      (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!,
    )
      .from("comments")
      .delete()
      .eq("id", a!.id);
  }, 30_000);
});
