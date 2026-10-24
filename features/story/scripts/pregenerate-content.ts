// writes llm match texts into content_cache, ahead of time: the post-game story and the ~60-second
// spoken summary, in english and/or finnish. only texts that pass every validator check are
// stored; otherwise the page keeps its template (which reaches the same length from the facts).
// run: npm run pregen -- --match 2027-2701404 [--match ...] [--lang en,fi]
//      npm run pregen:demo   (the demo rotation's three matches, en and fi)
// works with any openai-compatible endpoint (LLM_BASE_URL)
export {};

try {
  process.loadEnvFile(".env");
} catch {
  // no .env, use the shell environment
}

const args = process.argv.slice(2);
const demo = args.includes("--demo");
const langArg = args[args.indexOf("--lang") + 1];
const langs = (args.includes("--lang") ? langArg : demo ? "en,fi" : "en").split(",").filter((l): l is "en" | "fi" => l === "en" || l === "fi");
let matches = args.flatMap((a, i) => (a === "--match" && args[i + 1] ? [args[i + 1]] : []));
if (demo) {
  const { loadRotation } = await import("@/shared/demo");
  matches = loadRotation()?.matches.map((m) => m.matchId) ?? [];
}
if (matches.length === 0 || langs.length === 0) {
  console.log("usage: npm run pregen -- --match <season-gameId> [--match ...] [--lang en,fi]   or   npm run pregen:demo");
  process.exit(1);
}

const { llmEnabled } = await import("../llm/client");
if (!llmEnabled()) {
  console.log("LLM_ENABLED is not true (or LLM_BASE_URL is empty): nothing to generate, the site uses its templates (stories and summaries).");
  process.exit(0);
}

const { matchFactsFor } = await import("@/features/site/server");
const { buildMatchLedger, contentKey } = await import("@/features/story/server");
const { writeWithLlm } = await import("../writer/llm-writer");
const { verify } = await import("../validator/validator");
const { FI_CASES, isTeamName } = await import("../i18n/fi-team-names");
const { checkDb, getDb } = await import("@/shared/db");
await checkDb();

type Lang = "en" | "fi";
type Ledger = ReturnType<typeof buildMatchLedger>;

/** for finnish: team names only through the case placeholders, never typed endings */
function finnishNames(l: Ledger): string {
  const teams = l.facts.filter((f) => typeof f.value === "string" && isTeamName(f.value));
  const cases = FI_CASES.map((c) => `{F#:${c}}`).join(", ");
  return [
    `Team names inflect in Finnish. Write a team only as its placeholder with a case: ${cases} (nominative, genitive, partitive, inessive, elative, illative, adessive, ablative, allative, essive).`,
    `For example ${teams.slice(0, 2).map((f) => `{${f.id}:gen}`).join(" or ")}. Never add an ending to a placeholder yourself (no {F1}:n, no {F1}lle).`,
    "Keep player names in the nominative. Write ordinals as {F#:ord} (it becomes \"13.\"). Goal types: {F#:fi} gives the Finnish word.",
  ].join("\n");
}

const TASKS = {
  story: (team: string) => `Write a 3-5 sentence post-game story for ${team} fans: the result, the key goals, and what it did to the table and the playoff chance.`,
  summary: (team: string) =>
    [
      `Write a spoken match summary for ${team} fans that takes about 60 seconds to read aloud: 900 to 1,000 characters in total, 8 to 12 short sentences.`,
      "Five parts, in order: 1) what was at stake before the game (position, playoff chance, what a win or loss was worth); 2) how it unfolded: every goal in order with the score; 3) the turning point: the goal that moved the playoff chance most, and how much; 4) what it meant: playoff chance and position before -> after; 5) what's next: the next game and what a win there would be worth.",
      "It is read aloud: plain sentences, no lists, no brackets.",
    ].join("\n"),
};

async function write(kind: keyof typeof TASKS, id: string, teamId: string, facts: Parameters<typeof buildMatchLedger>[0], lang: Lang) {
  const ledger = buildMatchLedger(facts);
  const t0 = Date.now();
  const sentences = await writeWithLlm({
    task: `${TASKS[kind](facts.team)}${lang === "fi" ? `\n${finnishNames(ledger)}` : ""}`,
    ledger: ledger.facts,
    minSentences: kind === "summary" ? 6 : 3,
    timeoutMs: 240_000,
    maxTokens: kind === "summary" ? 8000 : 4000,
    language: lang,
  });
  const where = `${id} ${kind} ${lang}`;
  if (!sentences) return console.log(`${where}: the llm text did not pass validation (or timed out after ${Date.now() - t0} ms); template stays`);
  const chars = sentences.map((s) => s.text).join(" ").length;
  if (kind === "summary" && (chars < 750 || chars > 1150)) return console.log(`${where}: ${chars} characters, outside 750-1150; template stays`);
  const content = {
    id: `${kind}.${teamId}.${id}.${lang}`,
    kind: "story" as const,
    gameId: id,
    teamId,
    language: lang,
    sentences,
    status: "verified" as const,
    generatedAt: new Date().toISOString(),
  };
  const report = verify(content, ledger.facts);
  if (report.blockedCount > 0) return console.log(`${where}: ${report.blockedCount} sentence(s) blocked on recheck; not stored`);
  await getDb().content.put(contentKey(id, teamId, kind, lang), content, "llm");
  console.log(`${where}: stored ${sentences.length} verified sentences, ${chars} characters (${Date.now() - t0} ms, ${getDb().mode})`);
  for (const s of sentences) console.log(`  · ${s.text}`);
}

for (const id of matches) {
  const found = await matchFactsFor(id);
  if (!found) {
    console.log(`${id}: match not found`);
    continue;
  }
  if (found.status !== "final") {
    console.log(`${id}: not finished yet (${found.status}), texts are written after the final whistle`);
    continue;
  }
  for (const lang of langs) {
    await write("story", id, found.teamId, found.facts, lang);
    await write("summary", id, found.teamId, found.summaryFacts, lang);
  }
}
