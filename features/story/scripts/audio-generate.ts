// prep time only: reads each match summary aloud with azure (whatever TTS_ENABLED says), uploads
// the mp3s to the public "match-audio" bucket and records them with their exact transcript.
// with the placeholder key it makes nothing: the pages then use the browser's own voice.
// run: npm run audio:generate [-- --match <id>] [-- --lang en,fi]   (default: the demo rotation, en and fi)
export {};

try {
  process.loadEnvFile(".env");
} catch {
  // no .env, use the shell environment
}

const args = process.argv.slice(2);
const langs = (args.includes("--lang") ? args[args.indexOf("--lang") + 1] : "en,fi").split(",").filter((l): l is "en" | "fi" => l === "en" || l === "fi");
let matches = args.flatMap((a, i) => (a === "--match" && args[i + 1] ? [args[i + 1]] : []));
if (!matches.length) {
  const { loadRotation } = await import("@/shared/demo");
  matches = loadRotation()?.matches.map((m) => m.matchId) ?? [];
}
if (!matches.length) {
  console.log("usage: npm run audio:generate [-- --match <season-gameId>] [-- --lang en,fi]  (no demo/rotation.json to default to)");
  process.exit(1);
}

const { hasAzureKey, ttsFromEnv, voices, matchSummary, summaryText, generateAudio } = await import("@/features/story/server");
if (!hasAzureKey()) {
  console.log("AZURE_SPEECH_KEY is the placeholder (or empty): no audio made. The summary pages read the transcript with the browser's own voice (\"Device voice\").");
  console.log(`To make the ${matches.length * langs.length} mp3s: put a real Azure Speech key in .env (AZURE_SPEECH_KEY, AZURE_SPEECH_REGION) and run npm run audio:generate again.`);
  process.exit(0);
}
const { storageReady } = await import("@/shared/storage");
if (!storageReady()) {
  console.error("SUPABASE_URL and SUPABASE_SECRET_KEY are needed to upload the audio");
  process.exit(1);
}

const { matchFactsFor } = await import("@/features/site/server");
const { checkDb } = await import("@/shared/db");
await checkDb();
const tts = ttsFromEnv();
console.log(`voices: ${JSON.stringify(voices())}`);

let failed = 0;
for (const id of matches) {
  const found = await matchFactsFor(id);
  if (!found || found.status !== "final") {
    console.log(`${id}: ${found ? `not finished (${found.status})` : "not found"}`);
    continue;
  }
  for (const lang of langs) {
    const { content, source } = await matchSummary(found.summaryFacts, found.teamId, lang);
    const text = summaryText(content);
    try {
      const rec = await generateAudio(tts, id, found.teamId, lang, text);
      const ok = rec.durationSec >= 50 && rec.durationSec <= 75 ? "ok" : "outside 50-75 s";
      console.log(`${id} ${lang}: ${rec.durationSec} s (${ok}${rec.rate ? `, made at ${rec.rate > 0 ? "+" : ""}${rec.rate}% speed` : ""}), ${text.length} chars from the ${source} text, ${rec.voice}`);
      console.log(`  ${rec.url}`);
    } catch (err) {
      failed++;
      console.error(`${id} ${lang}: ${(err as Error).message}`);
    }
  }
}
process.exit(failed ? 1 : 0);
