// records the liiga responses the site needs into features/liiga/snapshots/, so USE_SNAPSHOT=true
// (or an api outage) still shows a full site. betting fields are stripped before writing.
// run: npm run snapshot   (needs LIIGA_API_URL and LIIGA_API_KEY)
//      npm run snapshot -- --games 2701379,2701398   only those games, added to the recording
export {};

try {
  process.loadEnvFile(".env");
} catch {
  // no .env, use the shell environment
}
process.env.USE_SNAPSHOT = "false";

const { liigaClient, helsinkiDate } = await import("../server");
const { readManifest, writeManifest, writeSnapshot } = await import("../server/snapshots");
const { loadRotation } = await import("@/shared/demo");
const { normalizeFixture } = await import("..");
type GamesDTO = import("../dto").GamesDTO;
type ScheduleItemDTO = import("../dto").ScheduleItemDTO;

const paths: string[] = [];
async function save<T>(path: string): Promise<T | null> {
  try {
    const data = await liigaClient.fetchLive<T>(path);
    writeSnapshot(path, data);
    paths.push(path);
    console.log(`saved ${path}`);
    return data;
  } catch (err) {
    console.log(`skip  ${path} (${(err as Error).message})`);
    return null;
  }
}

/** a game's page: details, past and future, and (once started) stats, shots and players */
async function saveGame(season: number, gameId: number, scheduled: boolean) {
  const base = `/api/v1/games/${season}/${gameId}`;
  await save(base);
  await save(`${base}/pastAndFutureGames`);
  if (!scheduled) {
    await save(`${base}/stats`);
    await save(`/api/v1/shotmap/${season}/${gameId}`);
    await save(`${base}/players`);
  }
}

// --games: add a few games to the existing recording, leave the rest (and its "now") as it is
const only = process.argv.includes("--games") ? process.argv[process.argv.indexOf("--games") + 1] : null;
if (only) {
  const manifest = readManifest();
  if (!manifest) {
    console.log("no recording yet: run npm run snapshot first");
    process.exit(1);
  }
  for (const id of only.split(",").map((x) => Number(x.trim().split("-").at(-1)))) await saveGame(manifest.season, id, false);
  writeManifest({ ...manifest, paths: [...new Set([...manifest.paths, ...paths])] });
  console.log(`\n${paths.length} responses added to features/liiga/snapshots/ (recording of ${manifest.recordedAt} kept)`);
  process.exit(0);
}

const tournament = await save<{ season: number }>("/api/v1/games/web/tournament");
if (!tournament) {
  console.log("the api did not answer. check LIIGA_API_URL / LIIGA_API_KEY in .env");
  process.exit(1);
}
const season = tournament.season;
const serie = "RUNKOSARJA";
await save(`/api/v1/teams?serie=${serie}&season=${season}`);
await save(`/api/v1/standings/${serie}?season=${season}&isLive=true`);
await save(`/api/v1/standings/${serie}?season=${season}&isLive=false`);
const schedule = (await save<ScheduleItemDTO[]>(`/api/v1/games/schedule?season=${season}&serie=${serie}`)) ?? [];

const today = helsinkiDate(new Date());
const todayGames = await save<GamesDTO>(`/api/v1/games?date=${today}&serie=${serie}`);
for (const d of [todayGames?.previousGameDate, todayGames?.nextGameDate]) if (d) await save(`/api/v1/games?date=${d}&serie=${serie}`);

// match pages offline: the latest finished games, today's games, and the demo replay game
const fixtures = schedule.map(normalizeFixture);
const finished = fixtures.filter((f) => f.status === "final").slice(-12);
const upcoming = fixtures.filter((f) => f.status !== "final").slice(0, 8);
const demo = process.env.DEMO_REPLAY_MATCH_ID;
const ids = new Set([...finished, ...upcoming].map((f) => f.gameId));
if (demo && /^\d{4}-\d+$/.test(demo)) ids.add(Number(demo.split("-")[1]));
// the demo rotation's matches (demo/rotation.json), and every game from 3 weeks before the demo
// date to a week after: demo mode links to them (home, team pages, what if?)
const rotation = loadRotation();
for (const m of rotation?.matches ?? []) ids.add(Number(m.matchId.split("-")[1]));
if (rotation) {
  const at = Date.parse(rotation.demoNow);
  const DAY = 24 * 3600 * 1000;
  for (const f of fixtures) if (Date.parse(f.start) > at - 21 * DAY && Date.parse(f.start) < at + 7 * DAY) ids.add(f.gameId);
}

for (const gameId of ids) await saveGame(season, gameId, fixtures.find((f) => f.gameId === gameId)?.status === "scheduled");

writeManifest({ recordedAt: new Date().toISOString(), season, paths });
console.log(`\n${paths.length} responses saved to features/liiga/snapshots/ (season ${season}, today ${today})`);
