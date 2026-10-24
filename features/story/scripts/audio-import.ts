// stores an mp3 made elsewhere (e.g. the azure portal's audio content creation) as a match
// summary's audio: the same bucket and record as audio:generate, source "azure-portal". the file
// must read the summary's current transcript, which is stored with it
// run: npm run audio:import -- --match <id> --lang <en|fi> --file <path.mp3> [--voice fi-FI-HarriNeural]
export {};

import { readFileSync } from "node:fs";

try {
  process.loadEnvFile(".env");
} catch {
  // no .env, use the shell environment
}

const args = process.argv.slice(2);
const arg = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const matchId = arg("--match");
const lang = arg("--lang");
const file = arg("--file");
if (!matchId || (lang !== "en" && lang !== "fi") || !file) {
  console.log("usage: npm run audio:import -- --match <season-gameId> --lang <en|fi> --file <path.mp3> [--voice <voice name>]");
  process.exit(1);
}

const { probeDuration } = await import("@/shared/media");
const { matchSummary, summaryText, saveAudio, voices } = await import("@/features/story/server");
const { matchFactsFor } = await import("@/features/site/server");
const { checkDb } = await import("@/shared/db");
await checkDb();

const found = await matchFactsFor(matchId);
if (!found) {
  console.error(`${matchId}: match not found`);
  process.exit(1);
}
const durationSec = await probeDuration(file);
const { content } = await matchSummary(found.summaryFacts, found.teamId, lang);
const rec = await saveAudio(matchId, found.teamId, lang, {
  mp3: readFileSync(file),
  durationSec,
  voice: arg("--voice") ?? voices()[lang],
  transcript: summaryText(content),
  source: "azure-portal",
});
console.log(`${matchId} ${lang}: ${rec.durationSec} s stored, ${rec.url}`);
