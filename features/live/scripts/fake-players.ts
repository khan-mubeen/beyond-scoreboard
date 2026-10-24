// joins fake fans (bots) to a match on a running server and answers every open call. talks http
// only (never imports server code); each fan has its own ks_anon cookie. a demo rotation match:
// skips to its lobby and plays it to its summary; a speed replay: resets and starts it.
// then checks the points two ways and that no bot shows on a leaderboard. exits 1 on any error.
// run: npm run fake-players -- <matchId> [count]   (HOST_TOKEN from .env; DEMO_MODE or DEMO_REPLAY_MATCH_ID)
import type { FinishedMatchDetail, LiveCall, LiveState } from "@/shared/types";

try {
  process.loadEnvFile(".env");
} catch {
  // no .env, use the shell environment
}

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const HOST_TOKEN = process.env.HOST_TOKEN;
const [matchId, countArg] = process.argv.slice(2);
const count = Number(countArg ?? 30);
const MAX_MINUTES = 30;
const ANSWER_RATE = 0.9;

if (!matchId || !/^\d{4}-\d+$/.test(matchId) || !(count > 0)) {
  console.error("usage: npm run fake-players -- <matchId like 2027-2701404> [count]");
  process.exit(1);
}
if (!HOST_TOKEN) {
  console.error("HOST_TOKEN is needed (in .env or the shell): fake players join as bots, which only the host may add");
  process.exit(1);
}

interface Fan {
  name: string;
  cookie: string;
  answered: Set<string>;
}

const errors: string[] = [];

async function call(path: string, opts: { method?: string; body?: unknown; cookie?: string; host?: boolean } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? "GET",
    headers: {
      ...(opts.body !== undefined && { "content-type": "application/json" }),
      ...(opts.cookie && { cookie: opts.cookie }),
      ...(opts.host && HOST_TOKEN && { "x-host-token": HOST_TOKEN }),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const cookie = res.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("ks_anon="));
  return { status: res.status, body, cookie };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 1. every fan gets a cookie and a nickname, and joins the match room
const fans: Fan[] = [];
for (let i = 1; i <= count; i++) {
  const name = `Fan ${String(i).padStart(2, "0")}`;
  // bots: real rows, but never on a leaderboard, in a watching count or a notification
  const r = await call(`/api/site/matches/${matchId}/join`, { method: "POST", body: { nickname: name, bot: true }, host: true });
  if (r.status !== 200 || !r.cookie) throw new Error(`join failed for ${name}: ${r.status} ${JSON.stringify(r.body)}`);
  fans.push({ name, cookie: r.cookie, answered: new Set() });
}
console.log(`${fans.length} fans joined ${matchId}`);

// 2. a demo rotation match (DEMO_MODE): skip to its lobby. a speed replay: a fresh run
type Rotation = { current: { matchId: string; phase: string }; matches: { matchId: string }[] };
const rot = await call("/api/site/rotation");
const rotation = rot.status === 200 && (rot.body as unknown as Rotation).matches.some((m) => m.matchId === matchId);
if (rotation) {
  for (let i = 0; i < 12; i++) {
    const r = (await call("/api/site/rotation")).body as unknown as Rotation;
    if (r.current.matchId === matchId && r.current.phase === "lobby") break;
    await call("/api/site/rotation/control", { method: "POST", body: { action: "skip" }, host: true });
  }
  console.log("rotation: at the match's lobby; playing it to its summary");
} else {
  for (const action of ["reset", "start"]) {
    const r = await call(`/api/site/matches/${matchId}/control`, { method: "POST", body: { action }, host: true });
    if (r.status !== 200) throw new Error(`host ${action} failed: ${r.status} ${JSON.stringify(r.body)}`);
  }
  console.log("replay reset and started");
}

// 3. follow the state, answer each call once, log every call's life
const lastStatus = new Map<string, string>();
const track = (c: LiveCall | null) => {
  if (!c || lastStatus.get(c.id) === c.status) return;
  lastStatus.set(c.id, c.status);
  const split = c.split ? ` split ${JSON.stringify(c.split)}` : "";
  if (c.status === "open") console.log(`  open      ${c.question} [${c.options.map((o) => o.label).join(" / ")}]`);
  else if (c.status === "locked") console.log(`  locked   ${split}`);
  else if (c.status === "resolved") console.log(`  resolved  ${c.question} -> ${c.options.find((o) => o.id === c.correctOptionId)?.label}${split}`);
  else console.log(`  cancelled ${c.question} (${c.reason})`);
};

async function answerAll(c: LiveCall) {
  const results = await Promise.all(
    fans.map(async (f) => {
      if (Math.random() > ANSWER_RATE) return "skipped";
      const option = c.options[Math.floor(Math.random() * c.options.length)];
      const r = await call(`/api/site/calls/${c.id}/answer`, { method: "POST", body: { optionId: option.id }, cookie: f.cookie });
      if (r.status === 201) f.answered.add(c.id);
      // the call can lock between our poll and the answer; that 409 is fair, anything else is a bug
      else if (!(r.status === 409 && /locked|cancelled/.test(String(r.body.error)))) errors.push(`${f.name} answer ${c.id}: ${r.status} ${JSON.stringify(r.body)}`);
      return r.status;
    }),
  );
  const accepted = results.filter((s) => s === 201).length;
  // a second answer must be refused
  const first = fans.find((f) => f.answered.has(c.id));
  if (first) {
    const again = await call(`/api/site/calls/${c.id}/answer`, { method: "POST", body: { optionId: c.options[0].id }, cookie: first.cookie });
    if (again.status !== 409) errors.push(`duplicate answer to ${c.id} got ${again.status}, expected 409`);
  }
  console.log(`            ${accepted}/${fans.length} answers accepted`);
}

const answeredCalls = new Set<string>();
const started = Date.now();
let finalSeenAt: number | null = null;
let state: LiveState | null = null;
for (;;) {
  const r = await call(`/api/site/matches/${matchId}/state`, { cookie: fans[0].cookie });
  if (r.status !== 200) errors.push(`state: ${r.status} ${JSON.stringify(r.body)}`);
  else {
    state = r.body as unknown as LiveState;
    track(state.lastCall);
    track(state.call);
    if (state.call?.status === "open" && !answeredCalls.has(state.call.id)) {
      answeredCalls.add(state.call.id);
      await answerAll(state.call);
    }
    // final (a rotation match: its summary), with nothing left to resolve, a moment after the end
    const done = rotation ? state.rotation?.phase === "summary" : state.status === "final";
    if (done && !state.call) finalSeenAt ??= Date.now();
    if (finalSeenAt && Date.now() - finalSeenAt > 2000) break;
  }
  if (Date.now() - started > MAX_MINUTES * 60_000) {
    errors.push(`replay did not finish in ${MAX_MINUTES} minutes`);
    break;
  }
  await sleep(1000);
}

// 4. the books: 20 points per correct call, the same total on /state and on the finished page
let checked = 0;
for (const f of fans) {
  const d = await call(`/api/site/matches/${matchId}`, { cookie: f.cookie });
  const night = (d.body as unknown as FinishedMatchDetail).yourNight;
  if (d.status !== 200) {
    errors.push(`${f.name} match page: ${d.status}`);
    continue;
  }
  if (!night) {
    if (f.answered.size) {
      const s = await call(`/api/site/matches/${matchId}/state`, { cookie: f.cookie });
      if ((s.body as unknown as LiveState).me?.matchPoints) errors.push(`${f.name} has points but no "your night"`);
    }
    continue;
  }
  checked++;
  if (night.points !== night.callsCorrect * 20) errors.push(`${f.name}: ${night.points} points for ${night.callsCorrect} correct calls`);
  if (night.callsTotal > f.answered.size) errors.push(`${f.name}: ${night.callsTotal} calls counted, only ${f.answered.size} answered`);
  const s = await call(`/api/site/matches/${matchId}/state`, { cookie: f.cookie });
  const me = (s.body as unknown as LiveState).me;
  if (me?.matchPoints !== night.points) errors.push(`${f.name}: /state says ${me?.matchPoints} points, the match page ${night.points}`);
}

// 5. bots never count: no fake fan on a leaderboard, and the room's watching count leaves them out
const names = new Set(fans.map((f) => f.name));
for (const scope of ["weekly", "season", "room"]) {
  const b = (await call(`/api/site/leaderboard?scope=${scope}`)).body as { entries?: { nickname: string }[] };
  const leaked = (b.entries ?? []).filter((e) => names.has(e.nickname));
  if (leaked.length) errors.push(`${leaked.length} bots on the ${scope} leaderboard`);
}
if ((state?.watching ?? 0) >= fans.length) errors.push(`watching says ${state?.watching}: the bots are counted`);

const calls = [...lastStatus.values()];
const by = (s: string) => calls.filter((v) => v === s).length;
// polling sees the last call to change; several can resolve in one tick (the final whistle)
console.log(`\nfinal ${state?.score.home}-${state?.score.away}. calls: ${calls.length}, last seen ${by("resolved")} resolved, ${by("cancelled")} cancelled`);
console.log(`points checked for ${checked} fans; bots on no leaderboard, watching ${state?.watching} (bots left out)`);
if (errors.length) {
  console.error(`\n${errors.length} errors:\n${errors.slice(0, 20).join("\n")}`);
  process.exit(1);
}
console.log("no errors");
