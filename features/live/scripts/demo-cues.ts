// finds where each goal happens in a rotation match's highlight, so the live phase reveals the
// goal (and the "Watch" button seeks) at the right moment. demo:videos joined one liiga clip per
// goal; in those clips the broadcast stays on the game camera until the puck goes in, then cuts to
// the celebration about a second later, and the crowd roars. per clip:
//   the first camera cut 6 s or more into the clip  -> goal = cut − 1 s
//   the loudest moment (EBU R128 momentary) shortly before that cut -> the confidence check
//   no cut: a clear loudness peak − 1 s; neither: a quarter into the clip (low confidence)
// writes the cues into demo/rotation.json (cuesSource "audio-peaks") and demo/cues-report.json.
// run: npm run demo:cues [-- --match 2027-2701379]
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

try {
  process.loadEnvFile(".env");
} catch {
  // no .env, use the shell environment
}
process.env.DEMO_MODE = "false";

const { FFMPEG, run } = await import("@/shared/media");
const { loadRotation, ROTATION_FILE, saveRotation } = await import("@/shared/demo");
const { getGame } = await import("@/features/liiga/server");
const { parseMatchId } = await import("@/features/liiga");

const WORK = join(dirname(ROTATION_FILE), "work");
const args = process.argv.slice(2);
const only = args.includes("--match") ? args[args.indexOf("--match") + 1] : null;
const config = loadRotation();
if (!config) {
  console.error("no demo/rotation.json: run npm run demo:pick first");
  process.exit(1);
}

/** camera cuts, in seconds */
async function sceneCuts(file: string): Promise<number[]> {
  const { stderr } = await run(FFMPEG, ["-hide_banner", "-i", file, "-vf", "select='gt(scene,0.25)',showinfo", "-an", "-f", "null", "-"], { timeoutMs: 10 * 60_000 });
  return [...stderr.matchAll(/pts_time:([\d.]+)/g)].map((m) => Number(m[1]));
}

/** momentary loudness (LUFS, 400 ms window) ten times a second */
async function loudness(file: string): Promise<{ t: number; m: number }[]> {
  const { stdout } = await run(FFMPEG, ["-hide_banner", "-v", "error", "-i", file, "-vn", "-af", "ebur128=metadata=1,ametadata=print:key=lavfi.r128.M:file=-", "-f", "null", "-"], {
    timeoutMs: 10 * 60_000,
  });
  const out: { t: number; m: number }[] = [];
  let t = 0;
  for (const line of stdout.split("\n")) {
    const time = line.match(/pts_time:([\d.]+)/);
    if (time) t = Number(time[1]);
    const m = line.match(/lavfi\.r128\.M=(-?[\d.]+|-inf)/);
    if (m && m[1] !== "-inf") out.push({ t, m: Number(m[1]) });
  }
  return out;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : -70;
};
const r1 = (x: number) => Math.round(x * 10) / 10;

type Confidence = "high" | "medium" | "low";
interface Found {
  goalId: string;
  videoSec: number;
  confidence: Confidence;
  cut: number | null;
  peak: number | null;
  prominence: number | null;
}

function findGoal(seg: { goalId: string; startSec: number; durationSec: number }, cuts: number[], loud: { t: number; m: number }[]): Found {
  const s = seg.startSec;
  const end = s + seg.durationSec;
  const inClip = loud.filter((p) => p.t >= s + 3 && p.t < end);
  const base = median(inClip.map((p) => p.m));
  const loudest = (from: number, to: number) => inClip.filter((p) => p.t >= from && p.t <= to).reduce<{ t: number; m: number } | null>((a, p) => (!a || p.m > a.m ? p : a), null);
  // not always the first cut: a clip can open on a faceoff close-up and cut *to* the game camera.
  // the goal's cut has the crowd rising just before it, and comes about 15 s in (every clip so far)
  const roar = (c: number) => (loudest(c - 4, c + 1.5)?.m ?? -70) - base;
  const candidates = cuts.filter((c) => c >= s + 6 && c <= Math.min(end - 1, s + 30));
  const cut = candidates.reduce<number | null>((best, c) => (best === null || roar(c) - Math.abs(c - s - 15) / 4 > roar(best) - Math.abs(best - s - 15) / 4 ? c : best), null);
  if (cut !== null) {
    const peak = loudest(cut - 6, cut + 1.5);
    const prominence = peak ? peak.m - base : null;
    const agrees = peak !== null && prominence !== null && prominence >= 3;
    return { goalId: seg.goalId, videoSec: r1(cut - 1), confidence: agrees ? "high" : "medium", cut: r1(cut), peak: peak && r1(peak.t), prominence: prominence && r1(prominence) };
  }
  const peak = loudest(s + 6, s + seg.durationSec * 0.6);
  const prominence = peak ? peak.m - base : null;
  if (peak && prominence !== null && prominence >= 6) return { goalId: seg.goalId, videoSec: r1(peak.t - 1), confidence: "medium", cut: null, peak: r1(peak.t), prominence: r1(prominence) };
  return { goalId: seg.goalId, videoSec: r1(s + seg.durationSec * 0.25), confidence: "low", cut: null, peak: peak && r1(peak.t), prominence: prominence && r1(prominence) };
}

async function localCopy(matchId: string, url: string): Promise<string> {
  const dir = join(WORK, matchId);
  const file = join(dir, "highlight.mp4");
  if (existsSync(file)) return file;
  mkdirSync(dir, { recursive: true });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${url}: ${res.status}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return file;
}

const report: Record<string, { title: string; cues: Found[] }> = {};
const matches = [...config.matches];
for (const [i, m] of matches.entries()) {
  if (only && m.matchId !== only) continue;
  if (m.video === "PLACEHOLDER" || m.video.type !== "mp4" || !m.segments.length) {
    console.log(`${m.title}: no joined highlight, cues stay linear`);
    continue;
  }
  console.log(`${m.title} (${m.matchId})`);
  const file = await localCopy(m.matchId, m.video.url);
  const [cuts, loud] = await Promise.all([sceneCuts(file), loudness(file)]);
  const ids = parseMatchId(m.matchId)!;
  const game = (await getGame(ids.season, ids.gameId, { unmasked: true })).data.game;
  const found: Found[] = [];
  for (const seg of m.segments) {
    const goal = game.goals.find((g) => g.id === seg.goalId);
    if (!goal) continue;
    const f = findGoal(seg, cuts, loud);
    // cues must move forward
    const prev = found.at(-1);
    if (prev && f.videoSec <= prev.videoSec) f.videoSec = r1(prev.videoSec + 1);
    found.push(f);
    const clock = `${Math.floor(goal.gameTime / 60)}:${String(goal.gameTime % 60).padStart(2, "0")}`;
    console.log(`  ${goal.homeScore}–${goal.awayScore} at ${clock}: video ${f.videoSec} s · ${f.confidence} (cut ${f.cut ?? "—"}, peak ${f.peak ?? "—"}, +${f.prominence ?? "—"} LU)`);
  }
  const cues = found.map((f) => ({ goalId: f.goalId, videoSec: f.videoSec, gameTime: game.goals.find((g) => g.id === f.goalId)!.gameTime }));
  matches[i] = { ...m, cues, cuesSource: "audio-peaks" };
  report[m.matchId] = { title: m.title, cues: found };
}
saveRotation({ ...config, matches });
writeFileSync(join(dirname(ROTATION_FILE), "cues-report.json"), `${JSON.stringify(report, null, 2)}\n`);
const all = Object.values(report).flatMap((r) => r.cues);
const count = (c: Confidence) => all.filter((f) => f.confidence === c).length;
console.log(`\n${all.length} cues: ${count("high")} high, ${count("medium")} medium, ${count("low")} low confidence. wrote ${ROTATION_FILE} and demo/cues-report.json`);
