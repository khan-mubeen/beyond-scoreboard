// writes llm match stories into content_cache, ahead of time. only texts that pass every
// validator check are stored; otherwise the page keeps its template.
// run: npm run pregen -- --match 2027-2701404 [--match ...] [--lang en]
// works with any openai-compatible endpoint (LLM_BASE_URL), e.g. a roihu tunnel on localhost:8000/v1
export {};

try {
  process.loadEnvFile(".env");
} catch {
  // no .env, use the shell environment
}

const args = process.argv.slice(2);
const matches = args.flatMap((a, i) => (a === "--match" && args[i + 1] ? [args[i + 1]] : []));
const lang = (args[args.indexOf("--lang") + 1] === "fi" ? "fi" : "en") as "en" | "fi";
if (matches.length === 0) {
  console.log("usage: npm run pregen -- --match <season-gameId> [--match ...] [--lang en|fi]");
  process.exit(1);
}

const { llmEnabled } = await import("../llm/client");
if (!llmEnabled()) {
  console.log("LLM_ENABLED is not true (or LLM_BASE_URL is empty): nothing to generate, the site uses templates.");
  process.exit(0);
}

const { matchFactsFor } = await import("@/features/site/server");
const { buildMatchLedger, contentKey } = await import("@/features/story/server");
const { writeWithLlm } = await import("../writer/llm-writer");
const { verify } = await import("../validator/validator");
const { checkDb, getDb } = await import("@/shared/db");
await checkDb();

for (const id of matches) {
  const found = await matchFactsFor(id);
  if (!found) {
    console.log(`${id}: match not found`);
    continue;
  }
  if (found.status !== "final") {
    console.log(`${id}: not finished yet (${found.status}), stories are written after the final whistle`);
    continue;
  }
  const ledger = buildMatchLedger(found.facts);
  const t0 = Date.now();
  const sentences = await writeWithLlm({
    task: `Write a 3-5 sentence post-game story for ${found.facts.team} fans: the result, the key goals, and what it did to the table and the playoff chance.`,
    ledger: ledger.facts,
    minSentences: 3,
    timeoutMs: 90_000,
    language: lang,
  });
  if (!sentences) {
    console.log(`${id}: the llm text did not pass validation (or timed out after ${Date.now() - t0} ms); template stays`);
    continue;
  }
  const content = {
    id: `story.${found.teamId}.${id}.${lang}`,
    kind: "story" as const,
    gameId: id,
    teamId: found.teamId,
    language: lang,
    sentences,
    status: "verified" as const,
    generatedAt: new Date().toISOString(),
  };
  const report = verify(content, ledger.facts);
  if (report.blockedCount > 0) {
    console.log(`${id}: ${report.blockedCount} sentence(s) blocked on recheck; not stored`);
    continue;
  }
  await getDb().content.put(contentKey(id, found.teamId, "story", lang), content, "llm");
  console.log(`${id}: stored ${sentences.length} verified sentences (${Date.now() - t0} ms, ${getDb().mode})`);
  for (const s of sentences) console.log(`  · ${s.text}  [${s.factIds.join(", ")}]`);
}
