// the whole server in-process, on the recorded snapshots and the memory db: no page response and
// no realtime broadcast carries betting fields, host controls need the token, and a demo replay
// runs end to end (call opens, fans answer, the call resolves, the points add up)
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FinishedMatchDetail, LiveCall, LiveState } from "@/shared/types";

const MATCH = "2027-2701404"; // K-Espoo 0-3 HIFK, decided in regulation
const HOST = "test-host-token";

// before any server module reads its env
Object.assign(process.env, {
  USE_SNAPSHOT: "true",
  DB_MODE: "memory",
  SIM_RUNS: "300",
  HOST_TOKEN: HOST,
  DEMO_REPLAY_MATCH_ID: MATCH,
  DEMO_REPLAY_SPEED: "600",
  DEMO_REPLAY_AUTOSTART: "false",
  CALL_ANSWER_SECONDS: "2",
  DEMO_PROFILE: "false",
  LLM_ENABLED: "false",
});
for (const k of ["LIIGA_API_URL", "LIIGA_API_KEY", "SUPABASE_URL", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) delete process.env[k];

let base = "";
let close = () => {};
let liiga: typeof import("@/features/liiga");
let live: typeof import("@/features/live/server");

beforeAll(async () => {
  const express = (await import("express")).default;
  const { api } = await import("@/server/api");
  const { startup } = await import("@/features/site/server/routes/startup");
  liiga = await import("@/features/liiga");
  live = await import("@/features/live/server");
  await startup();
  const app = express();
  app.use(express.json());
  app.use("/api", api);
  const server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => server.close();
}, 60_000);

afterAll(async () => {
  await live?.controlReplay(MATCH, "pause");
  close();
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

async function http(path: string, opts: { method?: string; body?: unknown; cookie?: string; headers?: Record<string, string> } = {}) {
  const res = await fetch(`${base}/api/site${path}`, {
    method: opts.method ?? "GET",
    headers: { ...(opts.body !== undefined && { "content-type": "application/json" }), ...(opts.cookie && { cookie: opts.cookie }), ...opts.headers },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const cookie = res.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("ks_anon="));
  return { status: res.status, body: (await res.json()) as Json, cookie };
}

const control = (action: string, token: string | null = HOST) =>
  http(`/matches/${MATCH}/control`, { method: "POST", body: { action }, headers: token ? { "x-host-token": token } : {} });

async function until<T>(what: string, fn: () => Promise<T | null | undefined | false>, ms = 30_000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 100));
  }
}

describe("site api responses", () => {
  const pages = [
    "/home",
    "/me",
    `/matches/${MATCH}`,
    `/matches/${MATCH}/state`,
    `/matches/${MATCH}/comments`,
    "/matches/2027-2701401", // regulation final
    "/matches/2027-2701398", // shootout final
    "/matches/2027-2701410", // not played yet
    "/standings",
    "/rewards",
    "/reminders",
    "/teams",
    "/teams/k%C3%A4rp%C3%A4t",
    "/profile",
    "/calls",
    "/calls?view=history",
    "/leaderboard?scope=season",
    "/notifications",
  ];

  it.each(pages)("GET %s: asOf, source, no betting fields", async (path) => {
    const { status, body } = await http(path);
    expect(status).toBe(200);
    expect(typeof body.asOf).toBe("string");
    expect(["live", "snapshot", "db", "config"]).toContain(body.source);
    expect(liiga.findGamblingFields(body)).toEqual([]);
  });

  it("rejects bad input with 400 and unknown matches with 404", async () => {
    expect((await http("/matches/not-a-match")).status).toBe(400);
    expect((await http("/matches/2027-1")).status).toBe(404);
  });
});

describe("round 3 fixes", () => {
  it("a game that hasn't started is a preview; its state, join and presence are 409", async () => {
    const id = "2027-2701410";
    const d = (await http(`/matches/${id}`)).body;
    expect(d.status).toBe("preview");
    for (const k of ["video", "events", "room", "discussion", "callIt"]) expect(d[k], k).toBeUndefined();
    expect(d.liigaUrl).toBe("https://liiga.fi/fi/peli/2027/2701410/seuranta");
    expect(d.headToHead.summary).toMatch(/this season/);
    expect(d.seasonStakes.worth.regulationWin).toBeGreaterThanOrEqual(0);
    expect(typeof d.reminder).toBe("boolean");
    for (const [path, method] of [[`/matches/${id}/state`, "GET"], [`/matches/${id}/join`, "POST"], [`/matches/${id}/presence`, "POST"]] as const) {
      expect((await http(path, { method, body: method === "POST" ? { nickname: "Early" } : undefined })).status, path).toBe(409);
    }
  });

  it("no page ever plays a liiga stream: hosted clips only, else Watch on liiga.fi", async () => {
    for (const path of ["/home", `/matches/${MATCH}`, "/matches/2027-2701401", "/matches/2027-2701398", "/matches/2027-2701410"]) {
      expect(JSON.stringify((await http(path)).body), path).not.toMatch(/m3u8|videos\.liiga\.fi\/videos\/[^"]*playlist/);
    }
    const final = (await http("/matches/2027-2701401")).body;
    expect(final.liigaUrl).toBe("https://liiga.fi/fi/peli/2027/2701401/tilastot");
    const goals = final.events.filter((e: Json) => e.video);
    expect(goals.length).toBeGreaterThan(0);
    for (const e of goals) expect(e.video).toMatchObject({ src: null, href: final.liigaUrl });
  });

  it("watching counts active viewers, and every join, leave and heartbeat tells the room", async () => {
    const a = (await http("/me")).cookie!;
    const b = (await http("/me")).cookie!;
    const rooms = () => live.recentBroadcasts.filter((m) => m.topic === `match:${MATCH}` && m.event === "room");
    const before = rooms().length;
    expect((await http(`/matches/${MATCH}/presence`, { method: "POST", body: {}, cookie: a })).body.watching).toBe(1);
    expect((await http(`/matches/${MATCH}/presence`, { method: "POST", body: {}, cookie: b })).body.watching).toBe(2);
    // a repeat heartbeat changes nothing, so it isn't broadcast
    await http(`/matches/${MATCH}/presence`, { method: "POST", body: {}, cookie: b });
    expect(rooms().length - before).toBe(2);
    expect((rooms().at(-1)!.payload as Json).watching).toBe(2);
    expect(((await http(`/matches/${MATCH}/state`, { cookie: a })).body as LiveState).watching).toBe(2);
    expect((await http(`/matches/${MATCH}/presence`, { method: "POST", body: { leave: true }, cookie: b })).body.watching).toBe(1);
    expect((rooms().at(-1)!.payload as Json).watching).toBe(1);
    // joining broadcasts the room (the new fan, the board) at once
    const n = rooms().length;
    expect((await http(`/matches/${MATCH}/join`, { method: "POST", body: { nickname: "Joiner" }, cookie: b })).status).toBe(200);
    expect(rooms().length).toBe(n + 1);
    expect((rooms().at(-1)!.payload as Json).watching).toBe(2);
    for (const m of rooms()) expect(liiga.findGamblingFields(m.payload)).toEqual([]);
    await http(`/matches/${MATCH}/presence`, { method: "POST", body: { leave: true }, cookie: a });
    await http(`/matches/${MATCH}/presence`, { method: "POST", body: { leave: true }, cookie: b });
  });

  it("saving only a nickname answers with that nickname (not a guest)", async () => {
    const cookie = (await http("/me")).cookie!;
    const r = await http("/settings", { method: "POST", cookie, body: { nickname: "Pekka" } });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ nickname: "Pekka", joined: true, user: { name: "Pekka" } });
    // the db contract behind it: an empty update is the user as they are
    const db = (await import("@/shared/db")).getDb();
    const id = r.body.user.id as string;
    expect((await db.users.update(id, {}))?.nickname).toBe("Pekka");
  });

  it("liiga only: no coming-soon cards, and favourites are real follows only", async () => {
    const home = (await http("/home")).body;
    expect(home.comingSoon).toEqual([]);
    expect(JSON.stringify(home)).not.toMatch(/Korisliiga|Superpesis|Coming soon/);
    expect((await http("/me")).body.favorites).toEqual([]);
    const rewards = (await http("/rewards")).body;
    expect(rewards.earnChips.map((c: Json) => c.label)).toContain("Your Call!");
  });
});

describe("teams, follows, settings and the profile", () => {
  it("follows a team, personalises home, saves settings and resets", async () => {
    const teams = (await http("/teams")).body;
    expect(teams.teams).toHaveLength(17);
    const team = teams.teams.find((t: Json) => t.slug === "tappara");
    expect((await http("/favorites", { method: "POST", body: { teamId: "nope", on: true } })).status).toBe(400);

    const fav = await http("/favorites", { method: "POST", body: { teamId: team.team.id, on: true } });
    expect(fav.status).toBe(200);
    const cookie = fav.cookie!;
    expect(fav.body.follows).toEqual([team.team.id]);
    expect((await http("/me", { cookie })).body.follows).toEqual([team.team.id]);
    expect((await http("/teams", { cookie })).body.teams.find((t: Json) => t.slug === "tappara").followed).toBe(true);
    const home = (await http("/home", { cookie })).body;
    expect(home.table.highlightTeamIds).toContain(team.team.id);
    expect(home.yourTeams.map((t: Json) => t.team.id)).toEqual([team.team.id]);
    expect((await http("/teams/tappara", { cookie })).body.item.followed).toBe(true);
    expect((await http("/teams/not-a-team")).status).toBe(404);

    const saved = await http("/settings", {
      method: "POST",
      cookie,
      body: { nickname: "Tapsa", language: "fi", notificationPrefs: { callResults: false, favoriteReminders: true, favoriteResults: false } },
    });
    expect(saved.status).toBe(200);
    expect(saved.body).toMatchObject({ nickname: "Tapsa", language: "fi", notificationPrefs: { callResults: false, favoriteResults: false } });
    expect((await http("/settings", { method: "POST", cookie, body: { language: "sv" } })).status).toBe(400);

    const profile = (await http("/profile", { cookie })).body;
    expect(profile.stats).toMatchObject({ answered: 0, correctPct: 0, bestStreak: 0 });
    expect(profile.achievements.length).toBeGreaterThan(0);

    expect((await http("/me/reset", { method: "POST", cookie, body: {} })).status).toBe(200);
    const after = (await http("/me", { cookie })).body;
    expect(after.joined).toBe(false);
    expect(after.follows).toEqual([]);
  });
});

describe("what if?", () => {
  const UPCOMING = "2027-2701410";
  const post = (body: unknown) => http("/whatif", { method: "POST", body });

  it("a set win gives the stakes card's win number; win >= overtime win >= overtime loss >= loss", async () => {
    const page = (await http(`/matches/${UPCOMING}`)).body;
    const options = page.seasonStakes.whatIf;
    expect(options.games[0].gameId).toBe(UPCOMING);
    expect(options.max).toBe(4);
    const { home, away } = options.games[0];
    const focusHome = page.seasonStakes.teamName === home.name;
    const focus = focusHome ? home.id : away.id;
    // the card's outcomes are the focus team's view; the api takes the home team's
    const homeView = { regulationWin: "regulationWin", overtimeWin: "overtimeWin", overtimeLoss: "overtimeLoss", regulationLoss: "regulationLoss" } as const;
    const flip = { regulationWin: "regulationLoss", overtimeWin: "overtimeLoss", overtimeLoss: "overtimeWin", regulationLoss: "regulationWin" } as const;
    const chances: number[] = [];
    for (const o of ["regulationWin", "overtimeWin", "overtimeLoss", "regulationLoss"] as const) {
      const t0 = Date.now();
      const r = await post({ matchId: UPCOMING, overrides: [{ gameId: UPCOMING, outcome: focusHome ? homeView[o] : flip[o] }] });
      expect(Date.now() - t0).toBeLessThan(1000);
      expect(r.status).toBe(200);
      expect(liiga.findGamblingFields(r.body)).toEqual([]);
      const team = r.body.teams.find((t: Json) => t.team.id === focus);
      expect(team.after.playoffs, o).toBe(page.seasonStakes.worth[o]);
      expect(team.before.playoffs).toBe(page.seasonStakes.before);
      chances.push(team.after.playoffs);
    }
    expect(chances).toEqual([...chances].sort((a, b) => b - a));
  });

  it("rejects decided games, repeats, unknown outcomes and more than four results", async () => {
    const finished = "2027-2701401";
    expect((await post({ matchId: finished, overrides: [] })).status).toBe(400);
    expect((await post({ matchId: UPCOMING, overrides: [{ gameId: finished, outcome: "regulationWin" }] })).status).toBe(400);
    expect((await post({ matchId: UPCOMING, overrides: [{ gameId: UPCOMING, outcome: "regulationWin" }, { gameId: UPCOMING, outcome: "regulationLoss" }] })).status).toBe(400);
    expect((await post({ matchId: UPCOMING, overrides: [{ gameId: UPCOMING, outcome: "draw" }] })).status).toBe(400);
    const five = Array.from({ length: 5 }, (_, i) => ({ gameId: `2027-27014${11 + i}`, outcome: "regulationWin" }));
    expect((await post({ matchId: UPCOMING, overrides: five })).status).toBe(400);
    // a finished match's page offers no what-if
    expect((await http(`/matches/${finished}`)).body.seasonStakes.whatIf).toBeNull();
  });
});

describe("host controls", () => {
  it("need the right token", async () => {
    expect((await control("pause", null)).status).toBe(403);
    expect((await control("pause", "wrong-token-same-len")).status).toBe(403);
    expect((await control("dance")).status).toBe(400);
    expect((await control("pause")).status).toBe(200);
    const other = await http("/matches/2027-2701401/control", { method: "POST", body: { action: "start" }, headers: { "x-host-token": HOST } });
    expect(other.status).toBe(409);
  });

  it("are off without HOST_TOKEN", async () => {
    delete process.env.HOST_TOKEN;
    try {
      expect((await control("pause")).status).toBe(503);
    } finally {
      process.env.HOST_TOKEN = HOST;
    }
  });
});

describe("demo replay end to end", () => {
  it("opens a call, takes one answer per fan, resolves it and pays 20 points", async () => {
    const joinA = await http(`/matches/${MATCH}/join`, { method: "POST", body: { nickname: "Aino" } });
    const joinB = await http(`/matches/${MATCH}/join`, { method: "POST", body: { nickname: "Bea" } });
    expect([joinA.status, joinB.status]).toEqual([200, 200]);
    const [a, b] = [joinA.cookie!, joinB.cookie!];

    expect((await control("reset")).status).toBe(200);
    expect((await control("start")).status).toBe(200);

    const call = await until<LiveCall>("the who-wins call", async () => {
      const s = (await http(`/matches/${MATCH}/state`, { cookie: a })).body as LiveState;
      return s.call?.status === "open" && s.call.type === "who_wins" ? s.call : null;
    });
    // an open call never carries its answer
    expect(call.correctOptionId).toBeNull();
    expect(call.split).toBeNull();
    expect((await http(`/calls/${call.id}/answer`, { method: "POST", body: { optionId: "away_reg" }, cookie: a })).status).toBe(201);
    expect((await http(`/calls/${call.id}/answer`, { method: "POST", body: { optionId: "home_reg" }, cookie: b })).status).toBe(201);
    expect((await http(`/calls/${call.id}/answer`, { method: "POST", body: { optionId: "home_reg" }, cookie: a })).status).toBe(409);

    const done = await until<LiveState>("the end of the replay", async () => {
      const s = (await http(`/matches/${MATCH}/state`, { cookie: a })).body as LiveState;
      return s.status === "final" && !s.call ? s : null;
    }, 45_000);
    expect(done.score).toEqual({ home: 0, away: 3 });
    expect(done.me?.matchPoints).toBe(20);
    expect((await http(`/matches/${MATCH}/state`, { cookie: b })).body.me.matchPoints).toBe(0);

    const pageA = (await http(`/matches/${MATCH}`, { cookie: a })).body as FinishedMatchDetail;
    expect(pageA.status).toBe("final");
    expect(pageA.yourNight).toMatchObject({ points: 20, callsCorrect: 1, callsTotal: 1 });
    expect(((await http(`/matches/${MATCH}`, { cookie: b })).body as FinishedMatchDetail).yourNight).toMatchObject({ points: 0, callsCorrect: 0 });
  }, 60_000);

  it("broadcast every event type, none with betting fields or an early answer", async () => {
    const sent = live.recentBroadcasts.filter((m) => m.topic === `match:${MATCH}`);
    const events = new Set(sent.map((m) => m.event));
    for (const e of ["state", "stakes", "call_open", "call_locked", "call_resolved", "leaderboard", "game_end"]) expect(events).toContain(e);
    for (const m of sent) expect(liiga.findGamblingFields(m.payload)).toEqual([]);
    for (const m of sent.filter((x) => x.event === "call_open")) {
      expect((m.payload as { call: LiveCall }).call).toMatchObject({ status: "open", correctOptionId: null, split: null });
    }
    // the score only ever goes up during the replay
    const states = sent.filter((m) => m.event === "state").map((m) => m.payload as LiveState);
    const totals = states.map((s) => s.score.home + s.score.away);
    expect(totals.at(-1)).toBe(3);
    expect(totals).toEqual([...totals].sort((x, y) => x - y));
    // every tick's clock is that tick's game time, not the last re-render's
    const { clockIn } = await import("@/features/site/server/labels");
    for (const s of states.filter((x) => x.status === "live")) expect(s.clock.clock).toBe(clockIn(s.clock.gameTime, s.clock.period));
  });

  it("refuses to broadcast betting fields", async () => {
    await expect(live.publish(MATCH, [{ event: "state", payload: { game: { gamblingEvent: { odds: 1.9 } } } }])).rejects.toThrow(/betting/);
  });
});
