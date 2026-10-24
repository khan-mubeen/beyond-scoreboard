// demo mode end to end, in-process on the snapshots and the memory db: the pinned clock, no
// future leaks, and a short rotation (lobby -> live -> summary, three matches, then a new cycle)
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { HomePage, LiveState, MatchDetail, MeResponse, RotationInfo } from "@/shared/types";

const HOST = "test-host-token";
const ROTATION = ["2027-2701398", "2027-2701399", "2027-2701400"];
const file = join(mkdtempSync(join(tmpdir(), "ks-demo-")), "rotation.json");
writeFileSync(
  file,
  JSON.stringify({
    demoNow: "2026-10-20T17:30:00+03:00",
    lobbySeconds: 4,
    summarySeconds: 4,
    matches: ROTATION.map((matchId, i) => ({ matchId, title: `Match ${i + 1}`, video: "PLACEHOLDER", durationSec: 6, cues: [], cuesSource: "linear" })),
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
  DEMO_PROFILE: "false",
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
let cookie = "";
async function http(path: string, opts: { method?: string; body?: unknown; host?: boolean } = {}) {
  const res = await fetch(`${base}/api/site${path}`, {
    method: opts.method ?? "GET",
    headers: { "content-type": "application/json", ...(cookie && { cookie }), ...(opts.host && { "x-host-token": HOST }) },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const c = res.headers.getSetCookie().map((x) => x.split(";")[0]).find((x) => x.startsWith("ks_anon="));
  if (c && !cookie) cookie = c;
  return { status: res.status, body: (await res.json().catch(() => null)) as Json };
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until<T>(what: string, fn: () => Promise<T | null | undefined | false>, ms = 20_000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await sleep(200);
  }
}
const rotation = async () => (await http("/rotation")).body as RotationInfo;
const control = (action: string) => http("/rotation/control", { method: "POST", body: { action }, host: true });

// every game the snapshot has from the demo date on (all of them already played in reality)
const schedule = JSON.parse(readFileSync(new URL("../../liiga/snapshots/games_schedule__season-2027__serie-RUNKOSARJA.json", import.meta.url), "utf8")) as { id: number; season: number; start: string }[];
const playedLater = new Set(schedule.filter((g) => g.start >= "2026-10-19T21:00:00Z").map((g) => `${g.season}-${g.id}`));

describe("pinned demo clock", () => {
  beforeAll(async () => {
    await control("restart");
  });

  it("the top nav chip, the home date and the table come from demoNow", async () => {
    const me = (await http("/me")).body as MeResponse;
    expect(me.demo?.label).toBe("Demo · Tue 20 Oct 2026");
    const home = (await http("/home")).body as HomePage;
    expect(home.dateLabel).toBe("Tuesday, 20 October 2026");
    // the 117 games finished before the demo date, nothing after
    expect(home.table.rows.reduce((n, r) => n + r.gamesPlayed, 0)).toBe(234);
    const standings = (await http("/standings")).body;
    expect(standings.rows.reduce((n: number, r: { gamesPlayed: number }) => n + r.gamesPlayed, 0)).toBe(234);
  });

  it("no result from the demo date on reaches the client, except the rotation match on now", async () => {
    // another game on the demo date, and one three days later
    // not started: the preview, with no score, events, stats, video, calls or room at all
    for (const id of ["2027-2701767", "2027-2701404", ...ROTATION.slice(1)]) {
      const d = (await http(`/matches/${id}`)).body as Json;
      expect(d.status, id).toBe("preview");
      expect(d.match.score, id).toBeNull();
      for (const k of ["events", "stats", "video", "highlight", "room", "discussion", "callIt"]) expect(d[k], `${id} ${k}`).toBeUndefined();
      expect(d.liigaUrl, id).toMatch(/^https:\/\/liiga\.fi\/fi\/peli\/2027\/\d+\/seuranta$/);
      expect(typeof d.headToHead.summary, id).toBe("string");
      expect(d.seasonStakes.worth, id).toBeTruthy();
    }
    const home = (await http("/home")).body as HomePage;
    expect(home.recent.length).toBeGreaterThan(0);
    expect(home.recent.filter((m) => playedLater.has(m.id))).toEqual([]);
    expect(home.recent.every((m) => !ROTATION.includes(m.id))).toBe(true);
    expect(home.upcoming.slice(0, 2).map((m) => m.id)).toEqual(ROTATION.slice(1));
    expect(home.upcoming.slice(0, 2).every((m) => typeof m.startsAt === "number" && m.score === null)).toBe(true);
    expect(home.featured?.match.id).toBe(ROTATION[0]);
    // 2701767 was played on the demo date: on home it is a game to come, with no score
    expect(JSON.stringify(home)).not.toMatch(/"score":\{"home":0,"away":3\}/);
  });
  it("a game that hasn't started: preview only; its state, join and presence are 409; the lobby counts as started", async () => {
    const idle = ROTATION[1];
    for (const [path, method, body] of [
      [`/matches/${idle}/state`, "GET", undefined],
      [`/matches/${idle}/join`, "POST", { nickname: "Early" }],
      [`/matches/${idle}/presence`, "POST", {}],
    ] as const) {
      const r = await http(path, { method, body });
      expect(r.status, path).toBe(409);
      expect(r.body.error).toMatch(/hasn't started/);
    }
    // a rotation idle match counts down to its next lobby
    const preview = (await http(`/matches/${idle}`)).body as Json;
    expect(preview.match.startsAt).toBeGreaterThan(Date.now());
    // match 1 is in its lobby (or past it): the live page, its state, and presence work
    await control("restart");
    const lobby = (await http(`/matches/${ROTATION[0]}`)).body as MatchDetail;
    expect(lobby.status).not.toBe("preview");
    expect((await http(`/matches/${ROTATION[0]}/state`)).status).toBe(200);
    expect((await http(`/matches/${ROTATION[0]}/presence`, { method: "POST", body: {} })).status).toBe(200);
  });

  it("what if? takes games on the demo date and refuses one finished before it", async () => {
    const home = (await http("/home")).body as HomePage;
    const before = home.recent[0].id;
    const ok = await http("/whatif", { method: "POST", body: { matchId: ROTATION[0], overrides: [{ gameId: ROTATION[0], outcome: "regulationWin" }, { gameId: "2027-2701767", outcome: "regulationLoss" }] } });
    expect(ok.status).toBe(200);
    expect(ok.body.teams).toHaveLength(4);
    const bad = await http("/whatif", { method: "POST", body: { matchId: ROTATION[0], overrides: [{ gameId: before, outcome: "regulationWin" }] } });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toMatch(/already played/);
  });

  it("a followed team playing later on the demo date gets one reminder, made on the league clock", async () => {
    const teams = (await http("/teams")).body;
    const team = teams.teams.find((t: Json) => t.next?.matchId === "2027-2701767");
    expect(team, "a team playing 2701767").toBeTruthy();
    expect((await http("/favorites", { method: "POST", body: { teamId: team.team.id, on: true } })).status).toBe(200);
    const first = (await http("/notifications")).body;
    const again = (await http("/notifications")).body;
    const soon = (r: Json) => r.items.filter((n: Json) => n.type === "favorite_soon" && n.link === "/match/2027-2701767");
    expect(soon(first)).toHaveLength(1);
    expect(soon(first)[0].title).toMatch(/play today/);
    expect(soon(again)).toHaveLength(1);
    // no result is told before it happens
    expect(first.items.some((n: Json) => n.type === "favorite_result")).toBe(false);
    await http("/favorites", { method: "POST", body: { teamId: team.team.id, on: false } });
  });
});

describe("rotation", () => {
  it("lobby: who wins? opens and closes at the game's start; live follows the video; summary shows the result", async () => {
    await control("restart");
    expect((await rotation()).current).toMatchObject({ matchId: ROTATION[0], phase: "lobby" });
    await http(`/matches/${ROTATION[0]}/join`, { method: "POST", body: { nickname: "Ada" } });
    const call = await until("the lobby call", async () => {
      const s = (await http(`/matches/${ROTATION[0]}/state`)).body as LiveState;
      return s.rotation?.phase === "lobby" && s.call?.type === "who_wins" ? s.call : null;
    });
    expect(call.locksAt).toBe((await rotation()).current.phaseEndsAt);
    // 2701398 ended 3-2 KooKoo after a shootout: overtime is right
    expect((await http(`/calls/${call.id}/answer`, { method: "POST", body: { optionId: "overtime" } })).status).toBe(201);

    const live = await until("live", async () => {
      const s = (await http(`/matches/${ROTATION[0]}/state`)).body as LiveState;
      return s.rotation?.phase === "live" ? s : null;
    });
    expect(live.status).toBe("live");
    expect(live.rotation?.videoSec).toBeGreaterThanOrEqual(0);
    // only what has happened by the video's second
    const end = await until("summary", async () => {
      const s = (await http(`/matches/${ROTATION[0]}/state`)).body as LiveState;
      return s.rotation?.phase === "summary" && !s.call ? s : null;
    });
    expect(end.status).toBe("final");
    expect(end.score).toEqual({ home: 3, away: 2 });
    expect(end.me?.matchPoints).toBe(20);
    const page = (await http(`/matches/${ROTATION[0]}`)).body as MatchDetail;
    expect(page.status).toBe("final");
  }, 40_000);

  it("the watch together board grows across the cycle's matches and starts over with match 1", async () => {
    const board = async () => (await http("/leaderboard?scope=room")).body.entries.map((e: { nickname: string; score: number }) => [e.nickname, e.score]);
    expect(await board()).toEqual([["Ada", 20]]);
    // on to match 2: Ada's points from match 1 still count in the room
    await until("match 2", async () => {
      const r = await rotation();
      if (r.current.matchId === ROTATION[1]) return r;
      await control("skip");
      return null;
    });
    expect(await board()).toEqual([["Ada", 20]]);
    // after match 1 is over, its page is back to "not played" (no result outside its own turn)
    expect(((await http(`/matches/${ROTATION[0]}`)).body as MatchDetail).match.score).toBeNull();
    // a new cycle: the room board is empty again; season points stay
    await control("restart");
    expect((await rotation()).cycle).toBeGreaterThanOrEqual(0);
    expect(await board()).toEqual([]);
    expect(((await http("/me")).body as MeResponse).user.points).toBe(20);
  }, 40_000);

  it("pause holds the phase, and the controls need the host token", async () => {
    expect((await http("/rotation/control", { method: "POST", body: { action: "pause" } })).status).toBe(403);
    await control("pause");
    const a = await rotation();
    await sleep(1500);
    const b = await rotation();
    expect(b.paused).toBe(true);
    expect([b.current.matchId, b.current.phase, b.current.phaseEndsAt]).toEqual([a.current.matchId, a.current.phase, a.current.phaseEndsAt]);
    await control("resume");
  });
});
