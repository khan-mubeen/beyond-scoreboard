// the watch party, in-process on the snapshots and the memory db with a short rotation: the one
// public party per match and cycle (0-point fans on the board, old room codes land in it),
// presence, chat, bursts, ask the match, invites and friends, and the guest pass (once, only from
// a member's invite, never again on another match or cycle, the tv untouched). plus the pure
// parser and trivia builder, and the demo reset of friends, invites and passes
import { mkdtempSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { InviteInfo, LiveState, MatchDetail, MeResponse } from "@/shared/types";
import { fold, parseAsk, type AskPlayer } from "../ask/parse";
import { buildTrivia, type TriviaPlayer } from "../ask/trivia";

const HOST = "test-host-token";
const ROTATION = ["2027-2701379", "2027-2701398", "2027-2701400"];
const url = (i: number) => `https://storage.example/highlights/match-${i + 1}.mp4`;
const file = join(mkdtempSync(join(tmpdir(), "ks-party-")), "rotation.json");
writeFileSync(
  file,
  JSON.stringify({
    demoNow: "2026-10-20T17:30:00+03:00",
    lobbySeconds: 30,
    summarySeconds: 30,
    // two hosted highlights: a guest pass is never good for a second one
    matches: ROTATION.map((matchId, i) => ({
      matchId,
      title: `Match ${i + 1}`,
      video: i < 2 ? { type: "mp4", url: url(i) } : "PLACEHOLDER",
      durationSec: 60,
      cues: [],
      cuesSource: "linear",
    })),
  }),
);

Object.assign(process.env, {
  DEMO_MODE: "true",
  DEMO_ROTATION_FILE: file,
  USE_SNAPSHOT: "true",
  DB_MODE: "memory",
  SIM_RUNS: "300",
  HOST_TOKEN: HOST,
  CALL_ANSWER_SECONDS: "20",
  LLM_ENABLED: "false",
});
for (const k of [
  "LIIGA_API_URL",
  "LIIGA_API_KEY",
  "SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DEMO_REPLAY_MATCH_ID",
  "PUBLIC_BASE_URL",
])
  delete process.env[k];

let base = "";
let close = () => {};
beforeAll(async () => {
  const express = (await import("express")).default;
  const { api } = await import("@/server/api");
  const { healthz } = await import("@/features/site/server/routes/health");
  const { startup } = await import("@/features/site/server/routes/startup");
  await startup();
  const app = express();
  app.set("trust proxy", 1);
  app.get("/healthz", healthz);
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
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** a browser of its own: a cookie jar and the site api */
function fan() {
  let cookie = "";
  const http = async (
    path: string,
    opts: { method?: string; body?: unknown; host?: boolean; headers?: Record<string, string> } = {},
  ) => {
    const res = await fetch(`${base}/api/site${path}`, {
      method: opts.method ?? (opts.body === undefined ? "GET" : "POST"),
      headers: {
        "content-type": "application/json",
        ...(cookie && { cookie }),
        ...(opts.host && { "x-host-token": HOST }),
        ...opts.headers,
      },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    const c = res.headers
      .getSetCookie()
      .map((x) => x.split(";")[0])
      .find((x) => x.startsWith("ks_anon="));
    if (c && !cookie) cookie = c;
    return { status: res.status, body: (await res.json().catch(() => null)) as Json };
  };
  return { http, cookie: () => cookie };
}
const host = fan();
const control = (action: string) => host.http("/rotation/control", { body: { action }, host: true });
const rotation = async () => (await host.http("/rotation")).body;
/** a rotation phase on the current or a named match, by skipping */
async function goTo(matchId: string, phase: "lobby" | "live" | "summary") {
  for (let i = 0; i < 12; i++) {
    const r = await rotation();
    if (r.current.matchId === matchId && r.current.phase === phase) return;
    await control("skip");
  }
  throw new Error(`could not reach ${matchId} ${phase}`);
}
/** a fan with a nickname, in the match's party */
async function named(name: string, matchId = ROTATION[0]) {
  const f = fan();
  expect((await f.http(`/matches/${matchId}/join`, { body: { nickname: name } })).status).toBe(200);
  return f;
}
const buyPass = (f: ReturnType<typeof fan>) =>
  f.http("/subscriptions", { body: { planId: "sports-pass", pointsToUse: 350, idempotencyKey: `t-${Math.random()}` } });

describe("the server", () => {
  it("answers /healthz; the memory db is always the leader", async () => {
    const r = await (await fetch(`${base}/healthz`)).json();
    expect(r).toMatchObject({ ok: true, role: "leader", db: "memory" });
  });
});

describe("one public party per match and cycle", () => {
  it("opening the match joins it: a guest is on the board with 0 points at once; an old room code lands in the same party", async () => {
    await control("restart");
    const guest = fan();
    // presence: a guest row with the welcome balance, "Guest" until a nickname
    const beat = await guest.http(`/matches/${ROTATION[0]}/presence`, { body: {} });
    expect(beat.status).toBe(200);
    expect(beat.body.watching).toBe(1);
    const me = (await guest.http("/me")).body as MeResponse;
    expect([me.user.name, me.user.points, me.joined]).toEqual(["Guest", 1250, false]);
    const late = fan();
    expect(
      (await late.http(`/matches/${ROTATION[0]}/join`, { body: { nickname: "Late", roomCode: "ZZZZ" } })).status,
    ).toBe(200);
    const s = (await guest.http(`/matches/${ROTATION[0]}/state`)).body as LiveState;
    expect(s.watching).toBe(2);
    expect(s.leaderboard.map((r) => [r.name, r.score])).toEqual([
      ["Guest", 0],
      ["Late", 0],
    ]);
    expect(s.party?.cycle).toMatch(/:/);
    // the polling fallback carries the feed, bursts, members and which server answered
    expect(
      Array.isArray(s.feed) && Array.isArray(s.bursts) && s.members?.length === 2 && s.server?.role === "leader",
    ).toBe(true);
    // a leave: not watching, still on the board
    await late.http(`/matches/${ROTATION[0]}/presence`, { body: { leave: true } });
    const after = (await guest.http(`/matches/${ROTATION[0]}/state`)).body as LiveState;
    expect([after.watching, after.leaderboard.length]).toEqual([1, 2]);
  });

  it("chat, bursts and emoji: a nickname first, rate limits, and everything in the polled feed", async () => {
    const g = fan();
    await g.http(`/matches/${ROTATION[0]}/presence`, { body: {} });
    expect((await g.http(`/matches/${ROTATION[0]}/bursts`, { body: { emoji: "🔥" } })).status).toBe(401);
    const a = await named("Chatter");
    const c = await a.http(`/matches/${ROTATION[0]}/comments`, { body: { text: "Hyvä peli!" } });
    expect(c.status).toBe(201);
    expect((await a.http(`/matches/${ROTATION[0]}/bursts`, { body: { emoji: "🔥" } })).status).toBe(201);
    expect((await a.http(`/matches/${ROTATION[0]}/bursts`, { body: { emoji: "👏" } })).status).toBe(429);
    expect((await a.http(`/matches/${ROTATION[0]}/bursts`, { body: { emoji: "💰" } })).status).toBe(422);
    const b = await named("Reactor");
    expect((await b.http(`/comments/${c.body.comment.id}/react`, { body: { emoji: "👏" } })).status).toBe(201);
    expect((await b.http(`/comments/${c.body.comment.id}/react`, { body: { emoji: "👏" } })).status).toBe(409);
    const s = (await b.http(`/matches/${ROTATION[0]}/state`)).body as LiveState;
    const line = s.feed!.find((x) => x.id === c.body.comment.id);
    expect(line?.reactions).toEqual({ "👏": 1 });
    expect(s.bursts!.map((x) => [x.emoji, x.name])).toContainEqual(["🔥", "Chatter"]);
    // moderation as before: betting talk is refused
    expect((await b.http(`/matches/${ROTATION[0]}/comments`, { body: { text: "what are the odds" } })).status).toBe(
      422,
    );
  });

  it("ask the match: a fact card for the party (en and fi), not-in-data only to the asker, one ask every 5 s", async () => {
    const a = await named("Asker");
    const en = await a.http(`/matches/${ROTATION[0]}/ask`, { body: { text: "How old is Lindbohm?" } });
    expect(en.status).toBe(201);
    expect(en.body.card.answer).toMatch(/^Petteri Lindbohm is \d+ \(born 23 Sept 1993\)\.$/);
    expect(en.body.card.source).toBe("Liiga data");
    expect(en.body.card.subject.photo).toMatch(/^https:\/\//);
    expect((await a.http(`/matches/${ROTATION[0]}/ask`, { body: { text: "Mistä Sund on kotoisin?" } })).status).toBe(
      429,
    );
    const b = await named("Kysyjä");
    const fi = await b.http(`/matches/${ROTATION[0]}/ask`, { body: { text: "Mistä Sund on kotoisin?" } });
    expect(fi.body.card.answer).toBe("Tony Sund · syntymäpaikka: Kokkola, Suomi.");
    const c = await named("Curious");
    const no = await c.http(`/matches/${ROTATION[0]}/ask`, { body: { text: "What's Lindbohm's middle name?" } });
    expect([no.status, no.body.posted, no.body.card.answer]).toEqual([
      200,
      false,
      "That's not in the Liiga data — try age, birthplace or goals this season.",
    ]);
    const feed = ((await c.http(`/matches/${ROTATION[0]}/state`)).body as LiveState).feed!;
    expect(feed.filter((x) => x.kind === "fact").map((x) => x.fact?.answer)).toEqual([
      en.body.card.answer,
      fi.body.card.answer,
    ]);
  });
});

describe("friends and invites", () => {
  it("a friend code adds a friend (pending until accepted); an invite makes friends at once and joins the party", async () => {
    const a = await named("Aino");
    const b = await named("Bea");
    const code = ((await a.http("/me")).body as MeResponse).friendCode!;
    expect(code).toMatch(/^[A-Z2-9]{6}$/);
    expect((await b.http("/friends/add", { body: { code } })).body.status).toBe("requested");
    const bId = ((await b.http("/me")).body as MeResponse).user.id;
    expect((await a.http("/friends")).body.incoming.map((f: Json) => f.name)).toEqual(["Bea"]);
    expect((await a.http(`/friends/${bId}/accept`, { body: {} })).status).toBe(200);
    expect((await b.http("/friends")).body.friends.map((f: Json) => [f.name, f.watching?.matchId])).toEqual([
      ["Aino", ROTATION[0]],
    ]);
    // an invite: friends at once, the party joined
    const inv = await a.http("/invites", { body: { matchId: ROTATION[0] } });
    expect(inv.status).toBe(201);
    expect(inv.body.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/i\/[A-Z2-9]{8}$/);
    const c = fan();
    expect(((await c.http(`/invites/${inv.body.code}`)).body as InviteInfo).inviter).toBe("Aino");
    expect((await c.http(`/invites/${inv.body.code}/accept`, { body: {} })).status).toBe(401);
    const acc = await c.http(`/invites/${inv.body.code}/accept`, { body: { nickname: "Cleo" } });
    expect(acc.body).toMatchObject({ matchId: ROTATION[0], friend: "Aino", pass: false });
    expect(((await c.http("/me")).body as MeResponse).friends).toHaveLength(1);
    // used once: someone else gets 409
    expect((await fan().http(`/invites/${inv.body.code}/accept`, { body: { nickname: "Dan" } })).status).toBe(409);
  });

  it("at most 10 open invites per fan; invite creation is rate limited", async () => {
    const a = await named("Inviter");
    expect((await a.http("/invites", { body: { matchId: null } })).status).toBe(201);
    expect((await a.http("/invites", { body: { matchId: null } })).status).toBe(429);
    const { getDb } = await import("@/shared/db");
    const id = ((await a.http("/me")).body as MeResponse).user.id;
    for (let i = 0; i < 9; i++) await getDb().invites.create({ code: `OPEN${i}XYZ`, inviterId: id, matchId: null });
    await sleep(3100);
    expect((await a.http("/invites", { body: { matchId: null } })).status).toBe(409);
  });
});

describe("the guest pass: the first live match free via a member's invite", () => {
  it("only via a member's invite; works once; not on another match or cycle; one per fan ever; the tv never locks", async () => {
    await control("restart");
    await goTo(ROTATION[0], "live");
    // a fan's invite (no plan): no pass
    const plain = await named("Plain");
    const noPass = fan();
    await noPass.http(
      `/invites/${(await plain.http("/invites", { body: { matchId: ROTATION[0] } })).body.code}/accept`,
      { body: { nickname: "NoPass" } },
    );
    const lockedNoPass = (await noPass.http(`/matches/${ROTATION[0]}`)).body as MatchDetail & Json;
    expect([lockedNoPass.highlight, lockedNoPass.streamLock?.guestPass ?? null]).toEqual([null, null]);
    expect((await noPass.http(`/matches/${ROTATION[0]}/pass`, { body: {} })).status).toBe(404);

    // a member's invite: one free live match
    const member = await named("Member");
    expect((await buyPass(member)).status).toBe(200);
    const inv = (await member.http("/invites", { body: { matchId: ROTATION[0] } })).body;
    expect(inv.freeMatch).toBe(true);
    const guest = fan();
    expect((await guest.http(`/invites/${inv.code}`)).body.freeMatch).toBe(true);
    expect((await guest.http(`/invites/${inv.code}/accept`, { body: { nickname: "Guesty" } })).body.pass).toBe(true);
    expect(((await guest.http("/me")).body as MeResponse).guestPass).toEqual({
      from: "Member",
      status: "unused",
      matchId: null,
    });
    const offer = (await guest.http(`/matches/${ROTATION[0]}`)).body as Json;
    expect([offer.highlight, offer.streamLock.guestPass]).toEqual([null, { from: "Member" }]);
    expect(JSON.stringify(offer)).not.toContain(url(0));
    // played: bound to this match and cycle, the stream comes
    expect((await guest.http(`/matches/${ROTATION[0]}/pass`, { body: {} })).status).toBe(200);
    expect(((await guest.http(`/matches/${ROTATION[0]}`)).body as Json).highlight.url).toBe(url(0));
    expect((await guest.http(`/matches/${ROTATION[0]}/pass`, { body: {} })).status).toBe(200);
    expect(((await guest.http("/me")).body as MeResponse).guestPass?.status).toBe("active");

    // the next match: used
    await goTo(ROTATION[1], "live");
    const next = (await guest.http(`/matches/${ROTATION[1]}`)).body as Json;
    expect([next.highlight, next.streamLock.passUsed, next.streamLock.guestPass]).toEqual([null, true, null]);
    expect((await guest.http(`/matches/${ROTATION[1]}/pass`, { body: {} })).body.error).toBe(
      "Your free match is used — get Kaleva Sports Pass",
    );
    // the same match in the next cycle: used too
    await control("restart");
    await goTo(ROTATION[0], "live");
    const again = (await guest.http(`/matches/${ROTATION[0]}`)).body as Json;
    expect([again.highlight, again.streamLock.passUsed]).toEqual([null, true]);
    // one pass per fan, ever: a second member's invite gives none
    const member2 = await named("Member2");
    await buyPass(member2);
    const inv2 = (await member2.http("/invites", { body: { matchId: ROTATION[0] } })).body;
    expect((await guest.http(`/invites/${inv2.code}/accept`, { body: {} })).body.pass).toBe(false);
    // the host's tv: always the stream
    expect(((await fan().http(`/matches/${ROTATION[0]}?tv=1`, { host: true })).body as Json).highlight.url).toBe(
      url(0),
    );
    // the member's own stream still plays
    expect(((await member.http(`/matches/${ROTATION[0]}`)).body as Json).highlight.url).toBe(url(0));
  }, 40_000);
});

describe("ask the match: the parser", () => {
  const players: AskPlayer[] = [
    { id: 1, firstName: "Saku", lastName: "Salminen", jersey: 17, teamId: "k" },
    { id: 2, firstName: "Patrik", lastName: "Siikanen", jersey: 75, teamId: "s" },
    { id: 3, firstName: "Tommi", lastName: "Tikka", jersey: 19, teamId: "k" },
    { id: 4, firstName: "Veeti", lastName: "Moilanen", jersey: 19, teamId: "s" },
    { id: 5, firstName: "Otto", lastName: "Mäenpää", jersey: 8, teamId: "s" },
  ];
  const teams = [
    { id: "k", name: "Kärpät" },
    { id: "s", name: "SaiPa" },
  ];
  const ask = (q: string) => parseAsk(q, { players, teams });
  const pick = (r: ReturnType<typeof ask>) => [
    r.kind,
    "intent" in r ? r.intent : r.reason,
    r.lang,
    ...(r.kind === "player" ? [r.players.map((p) => p.id)] : r.kind === "team" ? [r.team.id] : []),
  ];

  it.each([
    ["How old is Salminen?", ["player", "age", "en", [1]]],
    ["Kuinka vanha Salminen on?", ["player", "age", "fi", [1]]],
    ["Salmisen ikä", ["player", "age", "fi", [1]]],
    ["Where was Siikanen born?", ["player", "birthplace", "en", [2]]],
    ["Mistä Siikanen on kotoisin?", ["player", "birthplace", "fi", [2]]],
    ["Siikasen kansalaisuus", ["player", "nationality", "fi", [2]]],
    ["How tall is Maenpaa?", ["player", "height", "en", [5]]],
    ["Paljonko Mäenpää painaa?", ["player", "weight", "fi", [5]]],
    ["What number does Salminen wear?", ["player", "jersey", "en", [1]]],
    ["What position does Siikanen play?", ["player", "position", "en", [2]]],
    ["Salmisen pelipaikka", ["player", "position", "fi", [1]]],
    ["How many goals has Salminen scored this season?", ["player", "goals", "en", [1]]],
    ["Montako syöttöä Salmisella on?", ["player", "assists", "fi", [1]]],
    ["Salminen points", ["player", "points", "en", [1]]],
    ["Has Salminen scored tonight?", ["player", "goalsTonight", "en", [1]]],
    ["Who's #19?", ["player", "who", "en", [3, 4]]],
    ["Who is #19 for Kärpät?", ["player", "who", "en", [3]]],
    ["Kuka on numero 75?", ["player", "who", "fi", [2]]],
    ["Salminen?", ["player", "who", "en", [1]]],
    ["Top scorer tonight", ["match", "topScorerTonight", "en"]],
    ["Head-to-head", ["match", "headToHead", "en"]],
    ["Team form", ["match", "form", "en"]],
    ["Kärppien sijoitus?", ["team", "standing", "fi", "k"]],
    ["What's SaiPa's position in the table?", ["team", "standing", "en", "s"]],
    ["SaiPan vire", ["team", "form", "fi", "s"]],
    ["Keskinäiset ottelut", ["match", "headToHead", "fi"]],
    ["What's Salminen's middle name?", ["unknown", "not-in-data", "en"]],
    ["How old is he?", ["unknown", "no-subject", "en"]],
  ])("%s", (q, want) => {
    expect(pick(ask(q))).toEqual(want);
  });

  it("folds case, accents and punctuation", () => {
    expect(fold("  Kärpät: MÄENPÄÄ's #19?! ")).toBe("karpat maenpaa s #19");
  });
});

describe("party trivia: deterministic and verified", () => {
  const roster = (team: string, n: number, f: (i: number) => Partial<TriviaPlayer>): TriviaPlayer[] =>
    Array.from({ length: n }, (_, i) => ({
      id: Number(`${team === "a" ? 1 : 2}${i}`),
      name: `${team.toUpperCase()} Player ${i}`,
      teamId: team,
      jersey: i + 2,
      birthPlace: `Town ${i % 4}`,
      height: 180 + (i % 5),
      birthDate: `199${i % 10}-01-0${(i % 9) + 1}`,
      ...f(i),
    }));
  const players = [
    ...roster("a", 12, (i) => (i === 7 ? { height: 201, birthPlace: "Oulu" } : {})),
    ...roster("b", 12, (i) => (i === 3 ? { birthDate: "1984-05-05" } : {})),
  ];
  const input = (n: number, seed = "m:c1") => ({
    seed,
    n,
    teams: [
      { id: "a", name: "Kärpät", genitive: "Kärppien" },
      { id: "b", name: "SaiPa", genitive: "SaiPan" },
    ],
    players,
    goals: new Map([
      [13, 7],
      [10, 3],
    ]),
  });

  it("the same match, cycle and number give the same question", () => {
    expect(buildTrivia(input(2))).toEqual(buildTrivia(input(2)));
    const asked = new Set(Array.from({ length: 6 }, (_, n) => buildTrivia(input(n))?.question));
    expect(asked.size).toBeGreaterThan(2);
  });

  it("every answer is checked against the data: no other option is also right", () => {
    for (let n = 0; n < 20; n++) {
      for (const seed of ["x:1", "y:2", "z:3"]) {
        const q = buildTrivia(input(n, seed))!;
        expect(q.options).toHaveLength(4);
        expect(new Set(q.options.map((o) => o.label)).size).toBe(4);
        const right = q.options.find((o) => o.id === q.answer)!.label;
        const team = q.question.includes("Kärpät") ? "a" : "b";
        const p = (label: string) => players.find((x) => x.name === label && x.teamId === team);
        if (q.kind === "birthplace") {
          const place = q.question.match(/born in (.+)\?$/)![1];
          expect(p(right)!.birthPlace).toBe(place);
          for (const o of q.options) if (o.id !== q.answer) expect(p(o.label)!.birthPlace).not.toBe(place);
        }
        if (q.kind === "tallest")
          for (const o of q.options) if (o.id !== q.answer) expect(p(o.label)!.height!).toBeLessThan(p(right)!.height!);
        if (q.kind === "oldest")
          for (const o of q.options)
            if (o.id !== q.answer) expect(p(o.label)!.birthDate! > p(right)!.birthDate!).toBe(true);
        if (q.kind === "leader")
          for (const o of q.options)
            if (o.id !== q.answer)
              expect(input(0).goals.get(p(o.label)!.id) ?? 0).toBeLessThan(input(0).goals.get(p(right)!.id)!);
        expect(q.fi.question.length).toBeGreaterThan(10);
      }
    }
  });
});

describe("demo reset", () => {
  it("removes non-seeded fans with their friendships, invites and guest passes; seeded fans stay", async () => {
    const { createMemoryDb } = await import("@/shared/db");
    const db = createMemoryDb();
    const seeded = await db.users.create("seed:laura", "Laura");
    const a = await db.users.create("a", "A");
    const b = await db.users.create("b", "B");
    await db.friends.connect(a.id, b.id, a.id);
    await db.friends.connect(seeded.id, a.id, seeded.id);
    await db.invites.create({ code: "CODE1234", inviterId: a.id, matchId: null });
    await db.invites.create({ code: "SEED1234", inviterId: seeded.id, matchId: null });
    await db.passes.grant(b.id, a.id);
    await db.presence.beat("m", "c", seeded.id);
    const out = await db.admin.resetDemo();
    expect(out).toMatchObject({ users: 2, friendships: 2, invites: 1, guestPasses: 1, presence: 1 });
    expect(await db.friends.list(seeded.id)).toEqual([]);
    expect(await db.invites.get("SEED1234")).not.toBeNull();
    expect(await db.users.getByAnonId("seed:laura")).not.toBeNull();
  });
});
