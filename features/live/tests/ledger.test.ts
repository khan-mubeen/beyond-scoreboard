// answers and the points ledger: one answer per fan per call, no answers after the lock, and a
// call pays each fan once however often resolution runs
import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryDb, getDb, setDb, type DbCall } from "@/shared/db";
import { answerCall } from "../server/calls";

const openCall = (patch: Partial<DbCall> = {}): Omit<DbCall, "id"> => ({
  matchId: "2027-1",
  type: "who_wins",
  trigger: "who_wins",
  question: "Who wins?",
  options: [
    { id: "home_reg", label: "Kärpät in regulation" },
    { id: "away_reg", label: "Tappara in regulation" },
  ],
  stakesLine: null,
  openedGameTime: 10,
  openedAt: new Date(1_000).toISOString(),
  locksAt: new Date(21_000).toISOString(),
  lockGameTime: null,
  resolvesRule: { kind: "who_wins" },
  status: "open",
  correctOptionId: null,
  resolvedAt: null,
  ...patch,
});

beforeEach(() => setDb(createMemoryDb()));

describe("answering a call", () => {
  it("takes one answer per fan while open", async () => {
    const call = await getDb().calls.create(openCall());
    expect(await answerCall(call.id, "u1", "home_reg", 5_000)).toEqual({ status: 201 });
    expect(await answerCall(call.id, "u1", "away_reg", 6_000)).toMatchObject({ status: 409, error: "already answered" });
    expect(await answerCall(call.id, "u2", "away_reg", 6_000)).toEqual({ status: 201 });
    expect((await getDb().answers.listForCall(call.id)).map((a) => [a.userId, a.optionId])).toEqual([
      ["u1", "home_reg"],
      ["u2", "away_reg"],
    ]);
  });

  it("refuses late, unknown, locked and cancelled answers", async () => {
    const db = getDb();
    const call = await db.calls.create(openCall());
    expect(await answerCall("00000000-0000-0000-0000-000000000000", "u1", "home_reg", 5_000)).toMatchObject({ status: 404 });
    expect(await answerCall(call.id, "u1", "draw", 5_000)).toMatchObject({ status: 400 });
    // the lock is server time; the client's clock never counts
    expect(await answerCall(call.id, "u1", "home_reg", 21_000)).toMatchObject({ status: 409, error: "this call is locked" });
    await db.calls.update(call.id, { status: "locked" });
    expect(await answerCall(call.id, "u1", "home_reg", 5_000)).toMatchObject({ status: 409, error: "this call is locked" });
    const cancelled = await db.calls.create(openCall({ trigger: "x", status: "cancelled" }));
    expect(await answerCall(cancelled.id, "u1", "home_reg", 5_000)).toMatchObject({ status: 409, error: "this call was cancelled" });
  });
});

describe("points ledger", () => {
  it("pays a call once per fan, however often it is awarded", async () => {
    const db = getDb();
    const award = { userId: "u1", matchId: "2027-1", callId: "c1", points: 20, reason: "call: Who wins?" };
    expect(await db.points.award(award)).toBe(true);
    expect(await db.points.award(award)).toBe(false);
    expect(await db.points.award({ ...award, callId: "c2" })).toBe(true);
    expect(await db.points.award({ ...award, userId: "u2" })).toBe(true);
    const mine = await db.points.listForUser("u1");
    expect(mine.map((p) => p.callId)).toEqual(["c1", "c2"]);
    expect(mine.reduce((s, p) => s + p.points, 0)).toBe(40);
  });

  it("counts a match from a given time, for a replay that runs again", async () => {
    const db = getDb();
    await db.points.award({ userId: "u1", matchId: "2027-1", callId: "old", points: 20, reason: "", createdAt: "2026-10-24T10:00:00.000Z" });
    await db.points.award({ userId: "u1", matchId: "2027-1", callId: "new", points: 20, reason: "", createdAt: "2026-10-24T11:00:00.000Z" });
    await db.points.award({ userId: "u1", matchId: "2027-2", callId: "other", points: 20, reason: "", createdAt: "2026-10-24T11:00:00.000Z" });
    expect((await db.points.listSince("2026-10-24T10:30:00.000Z", "2027-1")).map((p) => p.callId)).toEqual(["new"]);
  });

  it("marks answers right or wrong once the call resolves", async () => {
    const db = getDb();
    const call = await db.calls.create(openCall());
    await answerCall(call.id, "u1", "home_reg", 5_000);
    await answerCall(call.id, "u2", "away_reg", 5_000);
    await db.answers.setCorrect(call.id, "away_reg");
    expect((await db.answers.listForCall(call.id)).map((a) => [a.userId, a.correct])).toEqual([
      ["u1", false],
      ["u2", true],
    ]);
  });
});
