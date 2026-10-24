// builds each rotation match's highlight from liiga's goal clips: downloads every clip (HLS),
// cuts the sponsor bumper at its start (a ~3 s betting ad: no betting content on our pages), joins
// the clips in goal order into one 720p H.264/AAC MP4 under ~45 MB, takes a poster at 10%, uploads
// both to the public "highlights" bucket and writes the urls, length and clip positions into
// demo/rotation.json. a clip that fails is retried 3 times, then left out; a match with no clip
// is swapped for the next game of the night (demo/candidates.json), else left a placeholder.
// stops starting new work after 20 minutes. run: npm run demo:videos [-- --match 2027-2701379]
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

try {
  process.loadEnvFile(".env");
} catch {
  // no .env, use the shell environment
}

const { FFMPEG, probeDuration, run } = await import("@/shared/media");
const { storageReady, uploadPublic } = await import("@/shared/storage");
const { loadRotation, ROTATION_FILE, saveRotation } = await import("@/shared/demo");
type RotationMatchConfig = import("@/shared/demo").RotationMatchConfig;

const BUCKET = "highlights";
const MAX_BYTES = 45 * 1024 * 1024;
/** aim a little under the cap: the encoder's average wanders */
const TARGET_BYTES = 40 * 1024 * 1024;
const AUDIO_KBPS = 128;
const DEADLINE = Date.now() + 20 * 60 * 1000;
const WORK = join(dirname(ROTATION_FILE), "work");

interface Clip {
  goalId: string;
  url: string;
}
interface Candidate {
  matchId: string;
  title: string;
  clips: Clip[];
  teams: [string, string];
}

const args = process.argv.slice(2);
const only = args.includes("--match") ? args[args.indexOf("--match") + 1] : null;
const config = loadRotation();
if (!config) {
  console.error("no demo/rotation.json: run npm run demo:pick first");
  process.exit(1);
}
if (!storageReady()) {
  console.error("SUPABASE_URL and SUPABASE_SECRET_KEY are needed to upload the videos");
  process.exit(1);
}
const candidatesFile = join(dirname(ROTATION_FILE), "candidates.json");
const candidates: Candidate[] = existsSync(candidatesFile) ? JSON.parse(readFileSync(candidatesFile, "utf8")).ranked : [];

async function retry<T>(what: string, fn: () => Promise<T>, tries = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i >= tries) throw err;
      console.log(`    ${what}: ${(err as Error).message.slice(0, 160)} — retry ${i}/${tries - 1}`);
      await new Promise((r) => setTimeout(r, 2000 * i));
    }
  }
}

/** the first camera cut between 1.5 and 6 s: where liiga's sponsor bumper ends (3 s so far) */
async function bumperEnd(file: string): Promise<number> {
  const { stderr } = await run(FFMPEG, ["-hide_banner", "-t", "8", "-i", file, "-vf", "select='gt(scene,0.25)',showinfo", "-an", "-f", "null", "-"]);
  const cuts = [...stderr.matchAll(/pts_time:([\d.]+)/g)].map((m) => Number(m[1]));
  return cuts.find((t) => t >= 1.5 && t <= 6) ?? 3;
}

interface Downloaded {
  goalId: string;
  raw: string;
  start: number;
  duration: number;
}

async function download(dir: string, clips: Clip[]): Promise<Downloaded[]> {
  const out: Downloaded[] = [];
  for (const [i, c] of clips.entries()) {
    const raw = join(dir, `raw-${i + 1}.mpegts`);
    try {
      if (!existsSync(raw) || statSync(raw).size < 100_000) {
        await retry(`clip ${i + 1}`, () => run(FFMPEG, ["-hide_banner", "-v", "error", "-y", "-i", c.url, "-map", "0:v:0", "-map", "0:a:0", "-c", "copy", "-f", "mpegts", raw], { timeoutMs: 120_000 }));
      }
      const start = await bumperEnd(raw);
      const duration = (await probeDuration(raw)) - start;
      if (duration < 5) throw new Error(`only ${duration.toFixed(1)} s after the bumper`);
      out.push({ goalId: c.goalId, raw, start, duration });
      console.log(`    clip ${i + 1}/${clips.length}: ${duration.toFixed(1)} s (bumper ${start.toFixed(2)} s cut)`);
    } catch (err) {
      console.log(`    clip ${i + 1}/${clips.length}: left out (${(err as Error).message.slice(0, 160)})`);
    }
  }
  return out;
}

/** every clip re-encoded the same way (so they join without another encode), then joined */
async function encode(dir: string, parts: Downloaded[], videoKbps: number): Promise<string> {
  const list: string[] = [];
  for (const [i, p] of parts.entries()) {
    const out = join(dir, `part-${i + 1}.mp4`);
    await run(
      FFMPEG,
      [
        "-hide_banner", "-v", "error", "-y",
        "-i", p.raw, "-ss", p.start.toFixed(3),
        "-vf", "scale=-2:720,fps=25,format=yuv420p",
        "-c:v", "libx264", "-preset", "medium", "-profile:v", "high",
        "-b:v", `${videoKbps}k`, "-maxrate", `${Math.round(videoKbps * 1.5)}k`, "-bufsize", `${videoKbps * 2}k`, "-g", "50",
        "-c:a", "aac", "-b:a", `${AUDIO_KBPS}k`, "-ar", "48000", "-ac", "2",
        out,
      ],
      { timeoutMs: 15 * 60_000 },
    );
    list.push(`file '${out.replaceAll("\\", "/")}'`);
  }
  const listFile = join(dir, "parts.txt");
  writeFileSync(listFile, `${list.join("\n")}\n`);
  const highlight = join(dir, "highlight.mp4");
  await run(FFMPEG, ["-hide_banner", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", "-movflags", "+faststart", highlight]);
  return highlight;
}

const hash = (b: Buffer) => createHash("sha256").update(b).digest("hex").slice(0, 10);

/** builds and uploads one match's highlight; null when none of its clips could be used */
async function build(matchId: string, clips: Clip[]): Promise<Partial<RotationMatchConfig> | null> {
  const dir = join(WORK, matchId);
  mkdirSync(dir, { recursive: true });
  const parts = await download(dir, clips);
  if (!parts.length) return null;
  const total = parts.reduce((s, p) => s + p.duration, 0);
  let kbps = Math.max(500, Math.min(1600, Math.floor((TARGET_BYTES * 8) / 1000 / total) - AUDIO_KBPS));
  let file = await encode(dir, parts, kbps);
  // over the cap (rare): once more, lower
  if (statSync(file).size > MAX_BYTES) {
    kbps = Math.floor((kbps * TARGET_BYTES) / statSync(file).size);
    console.log(`    over ${MAX_BYTES / 1048576} MB, again at ${kbps} kbps`);
    file = await encode(dir, parts, kbps);
  }
  const durationSec = Math.round((await probeDuration(file)) * 100) / 100;
  const poster = join(dir, "poster.jpg");
  await run(FFMPEG, ["-hide_banner", "-v", "error", "-y", "-ss", (durationSec * 0.1).toFixed(2), "-i", file, "-frames:v", "1", "-vf", "scale=1280:-2", "-q:v", "3", poster]);

  const video = readFileSync(file);
  const image = readFileSync(poster);
  // the file name carries its content hash: the bucket caches for a year, a new cut is a new url
  const url = await retry("upload video", () => uploadPublic(BUCKET, `${matchId}/highlight-${hash(video)}.mp4`, video, "video/mp4"));
  const posterUrl = await retry("upload poster", () => uploadPublic(BUCKET, `${matchId}/poster-${hash(image)}.jpg`, image, "image/jpeg"));
  let at = 0;
  const segments = parts.map((p) => {
    const s = { goalId: p.goalId, startSec: Math.round(at * 100) / 100, durationSec: Math.round(p.duration * 100) / 100 };
    at += p.duration;
    return s;
  });
  console.log(`    ${(video.length / 1048576).toFixed(1)} MB, ${durationSec} s at ${kbps} kbps → ${url}`);
  // new video, so old cues are void until demo:cues runs
  return { video: { type: "mp4", url }, poster: posterUrl, durationSec, segments, cues: [], cuesSource: "linear", streamUrl: url };
}

const clipsOf = (matchId: string) => candidates.find((c) => c.matchId === matchId)?.clips.map((c) => ({ goalId: c.goalId, url: c.url })) ?? [];

const matches = [...config.matches];
for (let i = 0; i < matches.length; i++) {
  const m = matches[i];
  if (only && m.matchId !== only) continue;
  if (Date.now() > DEADLINE) {
    console.log(`${m.title}: out of time, stays as it is`);
    continue;
  }
  console.log(`${m.title} (${m.matchId})`);
  let made = await build(m.matchId, clipsOf(m.matchId)).catch((err) => {
    console.log(`    failed: ${(err as Error).message.slice(0, 200)}`);
    return null;
  });
  if (!made) {
    // the next game of the night that isn't in the rotation and shares no team with it
    const taken = matches.flatMap((x) => candidates.find((c) => c.matchId === x.matchId)?.teams ?? []);
    const next = candidates.find((c) => !matches.some((x) => x.matchId === c.matchId) && !c.teams.some((t) => taken.includes(t)));
    if (next && Date.now() < DEADLINE) {
      console.log(`  no usable clips: trying ${next.title} instead`);
      made = await build(next.matchId, clipsOf(next.matchId)).catch(() => null);
      if (made) matches[i] = { ...m, matchId: next.matchId, title: next.title };
    }
  }
  if (made) matches[i] = { ...matches[i], ...made };
  else {
    console.log("  no highlight: stays a placeholder");
    matches[i] = { ...matches[i], video: "PLACEHOLDER", poster: null, cues: [], segments: [], cuesSource: "linear", streamUrl: null };
  }
  // save after every match, so a later failure keeps the earlier ones
  saveRotation({ ...config, matches: [...matches] });
}
console.log(`\nwrote ${ROTATION_FILE}. next: npm run demo:cues`);
