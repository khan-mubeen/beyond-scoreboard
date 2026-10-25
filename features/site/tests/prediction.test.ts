// the match prediction end to end, in demo mode on the snapshots and the memory db: one per fan,
// match and cycle; made from what if? on the preview page or the lobby's card (the same record);
// locked when the game starts; resolved from the real result; +30 once. and the leaderboard
// breakdown adds up to the boards
import { mkdtempSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { LeaderboardPageData, LiveState, MatchPrediction, MyCallsData, NotificationsResponse, PointsBreakdown, RotationInfo } from "@/shared/types";

const HOST = "test-host-token";
const ROTATION = ["2027-2701398", "2027-2701399", "2027-2701400"];
const file = join(mkdtempSync(join(tmpdir(), "ks-prediction-")), "rotation.json");
writeFileSync(
  file,
  JSON.stringify({
    demoNow: "2026-10-20T17:30:00+03:00",
    lobbySeconds: 30,
    summarySeconds: 30,
    matches: ROTATION.map((matchId, i) => ({ matchId, title: `Match ${i + 1}`, video: "PLACEHOLDER", durationSec: 30, cues: [], cuesSource: "linear" })),
  }),
);

Object.assign(process.env, {
  DEMO_MODE: "true",
  DEMO_ROTATION_FILE: file,
  USE_SNAPSHOT: "true",
  DB_MODE: "memory",
  SIM_RUNS: "300",
  HOST_TOKEN: HOST,
  CALL_ANSWER_SECONDS: "2",
  LLM_ENABLED: "false",
});
for (const k of ["LIIGA_API_URL", "LIIGA_API_KEY", "SUPABASE_URL", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY", "DEMO_REPLAY_MATCH_ID"]) delete process.env[k];

let base = "";
let close = () => {};
beforeAll(async () => {
  const express = (await import("express")).default;
  const { api } = await import("@/server/api");
  const { startup } = await import("@/features/site/server/routes/startup");
  await startup();
  const app = express();
  app.use(express.json());
  app.use("/api", api);
  const server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => server.close();
}, 60_000);
afterAll(() => close());

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;
/** a fan is a cookie jar of one */
function fan() {
  let cookie = "";
  return async (path: string, opts: { method?: string; body?: unknown; host?: boolean } = {}) => {
    const res = await fetch(`${base}/api/site${path}`, {
      method: opts.method ?? "GET",
      headers: { "content-type": "application/json", ...(cookie && { cookie }), ...(opts.host && { "x-host-token": HOST }) },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    const c = res.headers.getSetCookie().map((x) => x.split(";")[0]).find((x) => x.startsWith("ks_anon="));
    if (c && !cookie) cookie = c;
    return { status: res.status, body: (await res.json().catch(() => null)) as Json };
  };
}
const host = fan();
const ada = fan();
const bea = fan();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until<T>(what: string, fn: () => Promise<T | null | undefined | false>, ms = 20_000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await sleep(150);
  }
}
const rotation = async () => (await host("/rotation")).body as RotationInfo;
const control = (action: string) => host("/rotation/control", { method: "POST", body: { action }, host: true });
/** skips phases until match `i` is in `phase` */
async function goTo(i: number, phase: "lobby" | "live" | "summary") {
  await until(`${ROTATION[i]} ${phase}`, async () => {
    const r = await rotation();
    if (r.current.matchId === ROTATION[i] && r.current.phase === phase) return r;
    await control("skip");
    return null;
  });
}
const MATCH = ROTATION[1];
const predictionOf = async (who: ReturnType<typeof fan>) => (await who(`/matches/${MATCH}/prediction`)).body as MatchPrediction;

describe("one prediction per match", () => {
  let callId = "";
  let correct = "";
  beforeAll(async () => {
    await control("restart");
    // the real result of match 2: what the prediction must resolve to
    const { getGame } = await import("@/features/liiga/server");
    const g = (await getGame(2027, 2701399, { unmasked: true })).data.game;
    const home = g.home.goals > g.away.goals;
    correct = g.decidedIn === "regulation" ? (home ? "home_win" : "away_win") : home ? "home_ot" : "away_ot";
  });

  it("is open on the preview page (what if?), with four outcomes from the home team's view", async () => {
    expect((await rotation()).current).toMatchObject({ matchId: ROTATION[0], phase: "lobby" });
    expect((await ada(`/matches/${MATCH}`)).body.status).toBe("preview");
    const p = await predictionOf(ada);
    expect(p).toMatchObject({ status: "open", callId: null, choice: null, points: 30 });
    expect(p.options.map((o) => [o.id, o.outcome])).toEqual([
      ["home_win", "regulationWin"],
      ["home_ot", "overtimeWin"],
      ["away_ot", "overtimeLoss"],
      ["away_win", "regulationLoss"],
    ]);
  });

  it("can be made once only", async () => {
    const made = await ada(`/matches/${MATCH}/prediction`, { method: "POST", body: { optionId: correct } });
    expect(made.status).toBe(201);
    expect(made.body).toMatchObject({ status: "open", choice: correct });
    callId = made.body.callId;
    expect(callId).toMatch(/^[0-9a-f-]{36}$/);
    // a second try, a change of mind, the lobby card's route: all refused
    const again = await ada(`/matches/${MATCH}/prediction`, { method: "POST", body: { optionId: "home_win" } });
    expect(again.status).toBe(409);
    expect(again.body.error).toMatch(/already made your prediction/);
    expect((await ada(`/calls/${callId}/answer`, { method: "POST", body: { optionId: "away_win" } })).status).toBe(409);
    expect((await predictionOf(ada)).choice).toBe(correct);
    // an unknown outcome
    expect((await bea(`/matches/${MATCH}/prediction`, { method: "POST", body: { optionId: "draw" } })).status).toBe(400);
    // another fan gets the same record, with their own choice
    const wrong = ["home_win", "home_ot", "away_ot", "away_win"].find((o) => o !== correct)!;
    const b = await bea(`/matches/${MATCH}/prediction`, { method: "POST", body: { optionId: wrong } });
    expect(b.status).toBe(201);
    expect(b.body.callId).toBe(callId);
  });

  it("the lobby's your call! card is the same prediction, with the same locked-in choice", async () => {
    await goTo(1, "lobby");
    const s = await until("the lobby call", async () => {
      const st = (await ada(`/matches/${MATCH}/state`)).body as LiveState;
      return st.call?.type === "who_wins" ? st : null;
    });
    expect(s.call!.id).toBe(callId);
    expect(s.call!.points).toBe(30);
    expect(s.call!.options.map((o) => o.id)).toEqual(["home_win", "home_ot", "away_ot", "away_win"]);
    expect(s.me?.answers[callId]).toBe(correct);
    expect((await ada(`/calls/${callId}/answer`, { method: "POST", body: { optionId: "home_win" } })).status).toBe(409);
    // a fan who hadn't predicted can still do it in the lobby, from either place
    const cyd = fan();
    expect((await cyd(`/calls/${callId}/answer`, { method: "POST", body: { optionId: "home_win" } })).status).toBe(201);
    expect((await predictionOf(cyd)).choice).toBe("home_win");
  });

  it("locks when the game starts", async () => {
    await goTo(1, "live");
    const late = fan();
    expect((await late(`/matches/${MATCH}/prediction`, { method: "POST", body: { optionId: "home_win" } })).status).toBe(409);
    expect((await late(`/calls/${callId}/answer`, { method: "POST", body: { optionId: "home_win" } })).status).toBe(409);
    expect((await predictionOf(ada)).status).toBe("locked");
    expect((await predictionOf(late)).status).toBe("closed");
  });

  it("resolves from the real result and pays +30 once", async () => {
    await goTo(1, "summary");
    const done = await until("resolved", async () => {
      const p = await predictionOf(ada);
      return p.status === "won" || p.status === "lost" ? p : null;
    });
    expect(done).toMatchObject({ status: "won", correctOptionId: correct, choice: correct });
    expect((await predictionOf(bea)).status).toBe("lost");
    const pointsOf = async (who: ReturnType<typeof fan>) => ((await who(`/matches/${MATCH}/state`)).body as LiveState).me?.matchPoints;
    expect(await pointsOf(ada)).toBe(30);
    expect(await pointsOf(bea)).toBe(0);
    // more engine ticks (and a settle run again) never pay twice
    await sleep(1500);
    expect(await pointsOf(ada)).toBe(30);
    const { getDb } = await import("@/shared/db");
    const adaId = (await ada("/me")).body.user.id as string;
    const rows = (await getDb().points.listForUser(adaId)).filter((r) => r.callId === callId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ points: 30 });
    expect(rows[0].reason).toMatch(/^prediction: /);
    expect(await getDb().points.award({ userId: adaId, matchId: MATCH, callId, points: 30, reason: "prediction: again" })).toBe(false);
  });

  it("shows in my calls and the notifications", async () => {
    const calls = (await ada("/calls")).body as MyCallsData;
    expect(calls.calls.find((c) => c.callId === callId)).toMatchObject({ kind: "prediction", status: "won", points: 30 });
    const notes = (await ada("/notifications")).body as NotificationsResponse;
    expect(notes.items.some((n) => n.title === "Your prediction was right! +30 pts")).toBe(true);
    const bn = (await bea("/notifications")).body as NotificationsResponse;
    expect(bn.items.some((n) => n.title === "Not this time")).toBe(true);
  });

  it("the next cycle has a new prediction of its own", async () => {
    // match 2 is over: its next prediction belongs to the next cycle
    await goTo(2, "lobby");
    const p = await predictionOf(ada);
    expect(p).toMatchObject({ status: "open", choice: null, callId: null });
    const made = await ada(`/matches/${MATCH}/prediction`, { method: "POST", body: { optionId: "home_win" } });
    expect(made.status).toBe(201);
    expect(made.body.callId).not.toBe(callId);
  });
});

describe("a host pause in the lobby", () => {
  it("holds the prediction open (its lock follows the game's start) and keeps the same cycle", async () => {
    await control("restart");
    const first = ROTATION[0];
    const p0 = (await ada(`/matches/${first}/prediction`)).body as MatchPrediction;
    expect(p0.status).toBe("open");
    await control("pause");
    await sleep(2500);
    // made during the pause: open, and its lock is the time left to the start from now
    const made = await ada(`/matches/${first}/prediction`, { method: "POST", body: { optionId: "home_win" } });
    expect(made.status).toBe(201);
    expect(made.body.locksAt).toBeGreaterThan(p0.locksAt! + 2000);
    const cycle = ((await ada(`/matches/${first}/state`)).body as LiveState).party?.cycle;
    await control("resume");
    await sleep(600);
    // the same party and the same prediction after the resume
    const st = (await ada(`/matches/${first}/state`)).body as LiveState;
    expect(st.party?.cycle).toBe(cycle);
    expect((await predictionOf2(first)).choice).toBe("home_win");
    expect((await ada(`/calls/${made.body.callId}/answer`, { method: "POST", body: { optionId: "away_win" } })).status).toBe(409);
  }, 20_000);
});
const predictionOf2 = async (id: string) => (await ada(`/matches/${id}/prediction`)).body as MatchPrediction;

describe("the leaderboard breakdown", () => {
  it("adds up to every board's totals, by source and by match", async () => {
    for (const scope of ["weekly", "season", "room"] as const) {
      const board = (await ada(`/leaderboard?scope=${scope}`)).body as LeaderboardPageData;
      for (const e of [...board.entries, ...(board.you ? [board.you] : [])]) {
        const b = await ada(`/leaderboard/breakdown?scope=${scope}&user=${e.playerId}`);
        expect(b.status, `${scope} ${e.nickname}`).toBe(200);
        const d = b.body as PointsBreakdown;
        expect(d.total, `${scope} ${e.nickname}`).toBe(e.score);
        expect(d.bySource.call + d.bySource.prediction + d.bySource.trivia).toBe(d.total);
        expect(d.perMatch.reduce((s, m) => s + m.points, 0)).toBe(d.total);
      }
    }
  });

  it("splits ada's season points: the prediction, and the welcome balance left out", async () => {
    const adaId = (await ada("/me")).body.user.id as string;
    const d = (await ada(`/leaderboard/breakdown?scope=season&user=${adaId}`)).body as PointsBreakdown;
    expect(d.bySource.prediction).toBe(30);
    expect(d.total).toBe(30);
    expect(d.perMatch).toEqual([{ matchId: MATCH, title: expect.any(String), points: 30 }]);
    expect(d).toMatchObject({ answered: 1, correct: 1, correctPct: 100 });
    expect(d.bestCall).toMatchObject({ points: 30 });
    expect((await ada(`/leaderboard/breakdown?scope=season&user=00000000-0000-4000-8000-000000000000`)).status).toBe(404);
  });
});
