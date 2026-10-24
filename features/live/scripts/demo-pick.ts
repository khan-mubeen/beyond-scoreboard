// picks the demo night: the most recent date at least 3 days ago with 3+ finished games that have
// goal clips, then the 3 best games of it (5+ goals, lead changes, a comeback, a late goal, kärpät).
// writes demo/rotation.json (demoNow = 60 min before the night's first game, videos still
// placeholders), demo/candidates.json (every game of the night, ranked, for demo:videos to fall
// back on) and demo/DOWNLOADS.md (what was picked and why, and every clip to download).
// run: npm run demo:pick [-- --date 2026-10-20]   (needs LIIGA_API_URL and LIIGA_API_KEY)
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { LiigaGame } from "@/features/liiga";

try {
  process.loadEnvFile(".env");
} catch {
  // no .env, use the shell environment
}
// the real results, unmasked
process.env.USE_SNAPSHOT = "false";
process.env.DEMO_MODE = "false";

const { getGame, getSchedule, getSeason, helsinkiDate } = await import("@/features/liiga/server");
const { ROTATION_FILE, saveRotation } = await import("@/shared/demo");

const args = process.argv.slice(2);
const forced = args.includes("--date") ? args[args.indexOf("--date") + 1] : null;
const DEMO_DIR = dirname(ROTATION_FILE);
const DAY = 24 * 3600 * 1000;
const FAVORITE = (process.env.FAVORITE_TEAM ?? "kärpät").toLowerCase();

/** "2026-10-20T17:30:00+03:00" in Helsinki time */
function helsinkiIso(d: Date): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Helsinki", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", timeZoneName: "longOffset" })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  const offset = p.timeZoneName === "GMT" ? "+00:00" : p.timeZoneName.replace("GMT", "");
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${offset}`;
}

const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

interface Candidate {
  matchId: string;
  title: string;
  start: string;
  score: string;
  decidedIn: string | null;
  goals: number;
  clips: { goalId: string; period: number; gameTime: number; scorer: string | null; score: string; url: string; thumb: string | null }[];
  tags: string[];
  points: number;
  teams: [string, string];
}

function judge(g: LiigaGame): Candidate {
  // shootout goals have no clips and aren't goals of the game
  const goals = g.goals.filter((x) => x.period <= 4);
  const clips = goals
    .filter((x) => x.videoUrl)
    .map((x) => ({ goalId: x.id, period: x.period, gameTime: x.gameTime, scorer: x.scorer, score: `${x.homeScore}–${x.awayScore}`, url: x.videoUrl!, thumb: x.thumbUrl }));
  const tags: string[] = [];
  let points = 0;
  if (goals.length >= 5) {
    tags.push(`${goals.length} goals`);
    points += 3 + (goals.length - 5);
  }
  // who led after each goal: a lead change is the lead passing from one team to the other
  let leader: "home" | "away" | null = null;
  let changes = 0;
  let trailedHome = false;
  let trailedAway = false;
  for (const x of goals) {
    const now = x.homeScore > x.awayScore ? "home" : x.awayScore > x.homeScore ? "away" : null;
    if (now && leader && now !== leader) changes++;
    if (now) leader = now;
    if (x.homeScore < x.awayScore) trailedHome = true;
    if (x.awayScore < x.homeScore) trailedAway = true;
  }
  if (changes) {
    tags.push(changes === 1 ? "a lead change" : `${changes} lead changes`);
    points += 2 * Math.min(changes, 2);
  }
  const homeWon = g.home.goals > g.away.goals;
  if ((homeWon && trailedHome) || (!homeWon && trailedAway)) {
    tags.push("a comeback win");
    points += 2;
  }
  // the last 5 minutes of the third, or overtime
  if (goals.some((x) => (x.period === 3 && x.gameTime >= 55 * 60) || x.period === 4)) {
    tags.push("a late goal");
    points += 2;
  }
  if (g.decidedIn === "shootout") {
    tags.push("a shootout");
    points += 1;
  }
  if ([g.home.name, g.away.name].some((n) => n.toLowerCase() === FAVORITE)) {
    tags.push(g.home.name.toLowerCase() === FAVORITE ? g.home.name : g.away.name);
    points += 3;
  }
  return {
    matchId: g.id,
    title: `${g.home.name} – ${g.away.name}`,
    start: g.start,
    score: `${g.home.goals}–${g.away.goals}`,
    decidedIn: g.decidedIn,
    goals: goals.length,
    clips,
    tags,
    points,
    teams: [g.home.teamId, g.away.teamId],
  };
}

/** enough video for a highlight: a clip for every goal but at most one */
const hasVideo = (c: Candidate) => c.clips.length > 0 && c.clips.length >= c.goals - 1;

const season = await getSeason();
const schedule = (await getSchedule(season)).data;
const latest = helsinkiDate(new Date(Date.now() - 3 * DAY));
const byDate = new Map<string, typeof schedule>();
for (const f of schedule.filter((x) => x.status === "final")) {
  const d = helsinkiDate(new Date(f.start));
  if (forced ? d === forced : d <= latest) byDate.set(d, [...(byDate.get(d) ?? []), f]);
}

let night: { date: string; ranked: Candidate[] } | null = null;
for (const date of [...byDate.keys()].sort().reverse()) {
  const fixtures = byDate.get(date)!;
  if (fixtures.length < 3) {
    console.log(`${date}: ${fixtures.length} finished games, need 3`);
    continue;
  }
  const games = await Promise.all(fixtures.map((f) => getGame(season, f.gameId).then((r) => r.data.game)));
  const judged = games.map(judge);
  const withVideo = judged.filter(hasVideo);
  console.log(`${date}: ${fixtures.length} finished, ${withVideo.length} with goal clips`);
  if (withVideo.length >= 3) {
    night = { date, ranked: withVideo.sort((a, b) => b.points - a.points || b.goals - a.goals || a.start.localeCompare(b.start)) };
    break;
  }
}
if (!night) {
  console.error(`no date on or before ${latest} has 3 finished games with goal clips`);
  process.exit(1);
}

// the three best, no team twice
const picked: Candidate[] = [];
for (const c of night.ranked) {
  if (picked.length === 3) break;
  if (picked.some((p) => p.teams.some((t) => c.teams.includes(t)))) continue;
  picked.push(c);
}
// play them in the night's order
picked.sort((a, b) => a.start.localeCompare(b.start));
const firstStart = Math.min(...night.ranked.map((c) => Date.parse(c.start)));
const demoNow = helsinkiIso(new Date(firstStart - 60 * 60 * 1000));

saveRotation({
  demoNow,
  lobbySeconds: 60,
  summarySeconds: 600,
  matches: picked.map((c) => ({ matchId: c.matchId, title: c.title, video: "PLACEHOLDER", poster: null, durationSec: 300, cues: [], segments: [], cuesSource: "linear", streamUrl: null })),
});
mkdirSync(DEMO_DIR, { recursive: true });
writeFileSync(join(DEMO_DIR, "candidates.json"), `${JSON.stringify({ date: night.date, demoNow, ranked: night.ranked }, null, 2)}\n`);

const line = (c: Candidate) => `**${c.title} ${c.score}${c.decidedIn && c.decidedIn !== "regulation" ? ` (${c.decidedIn})` : ""}** · \`${c.matchId}\` · ${c.tags.join(", ") || "no extras"} · ${c.points} pts`;
const md = [
  "# Demo downloads",
  "",
  `Written by \`npm run demo:pick\` on ${new Date().toISOString()}. The demo night is **${night.date}**, the most recent date at least 3 days before today with 3+ finished games that have goal clips. The league clock is pinned at \`${demoNow}\` (60 minutes before the first game).`,
  "",
  "Ranking: 5+ goals (+3, +1 per extra goal), each lead change (+2, up to 2), a comeback win (+2), a goal in the last 5 minutes or overtime (+2), a shootout (+1), the site's team (+3). No team twice.",
  "",
  "## Picked (rotation order)",
  "",
  ...picked.map((c, i) => `${i + 1}. ${line(c)}`),
  "",
  "## The other games that night",
  "",
  ...night.ranked.filter((c) => !picked.includes(c)).map((c) => `- ${line(c)}`),
  "",
  "## Clips",
  "",
  "Liiga's goal clips (HLS). `npm run demo:videos` downloads them, joins each match's clips in goal order into one 720p H.264/AAC MP4 and uploads it to the `highlights` bucket.",
  "",
  ...night.ranked.flatMap((c) => [
    `### ${c.title} (\`${c.matchId}\`)${picked.includes(c) ? "" : " — fallback"}`,
    "",
    "| # | Period | Time | Score | Scorer | Clip |",
    "|---|---|---|---|---|---|",
    ...c.clips.map((x, i) => `| ${i + 1} | ${x.period === 4 ? "OT" : x.period} | ${clock(x.gameTime - (x.period - 1) * 1200)} | ${x.score} | ${x.scorer ?? "—"} | ${x.url} |`),
    "",
  ]),
];
writeFileSync(join(DEMO_DIR, "DOWNLOADS.md"), `${md.join("\n")}\n`);

console.log(`\ndemo night ${night.date}, demoNow ${demoNow}`);
for (const c of picked) console.log(`  ${line(c).replaceAll("**", "").replaceAll("`", "")}`);
console.log(`wrote ${ROTATION_FILE}, demo/candidates.json and demo/DOWNLOADS.md`);
