// writes llm content into features/story/cache/ ahead of the demo.
// imports writer/, ledger/ and validator/ only, never server/. run: npm run pregen
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DEMO_GAME_ID, DEMO_TEAM_ID, mockFactInputs } from "@/shared/mock";
import { type ContentMeta, contentId } from "../content-id";
import { buildLedger } from "../ledger/build-ledger";
import { verify } from "../validator/validator";
import { writeContent } from "../writer/writer";

try {
  process.loadEnvFile(".env");
} catch {
  // no .env, use the shell environment
}

if (process.env.LLM_ENABLED !== "true") {
  console.log("LLM_ENABLED is not true, nothing to do. the app serves the template fallback.");
  process.exit(0);
}

const CACHE_DIR = fileURLToPath(new URL("../cache/", import.meta.url));
// todo: targets and fact inputs from stakes snapshots instead of the mock
const targets: ContentMeta[] = (["brief", "story"] as const).flatMap((kind) =>
  (["en", "fi"] as const).map((language) => ({ kind, teamId: DEMO_TEAM_ID, gameId: DEMO_GAME_ID, language })),
);

mkdirSync(CACHE_DIR, { recursive: true });
for (const meta of targets) {
  const ledger = buildLedger(mockFactInputs);
  const draft = await writeContent(meta, ledger);
  const report = verify(draft, ledger);
  // blocked sentences never ship
  const content = { ...draft, sentences: draft.sentences.filter((_, i) => report.claims[i].passed) };
  writeFileSync(`${CACHE_DIR}${contentId(meta)}.json`, JSON.stringify({ content, ledger, report }, null, 2) + "\n");
  console.log(`${contentId(meta)}: ${content.sentences.length} sentences, ${report.blockedCount} blocked`);
}
