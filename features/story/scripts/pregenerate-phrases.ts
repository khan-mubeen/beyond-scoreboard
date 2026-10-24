// asks the llm for other wordings of each call it! question and stores them in phrase_bank.
// every wording is checked (a short question, only its call's placeholders, no betting language,
// no typed numbers); those that pass are approved, and the engine takes turns with them at
// runtime. the rest are kept unapproved, for a look.
// run: npm run pregen:phrases [-- --count 10]
export {};

try {
  process.loadEnvFile(".env");
} catch {
  // no .env, use the shell environment
}

const args = process.argv.slice(2);
const at = args.indexOf("--count");
const count = (at >= 0 && Number(args[at + 1])) || 10;

const { chatJson, llmEnabled } = await import("../llm/client");
if (!llmEnabled()) {
  console.log("LLM_ENABLED is not true (or LLM_BASE_URL is empty): nothing to generate, calls use the built-in wordings.");
  process.exit(0);
}

const { BUILT_IN, PHRASE_VARS, phraseProblem } = await import("@/features/live/server");
type CallKind = keyof typeof PHRASE_VARS;
const { checkDb, getDb } = await import("@/shared/db");
await checkDb();
const db = getDb();

const LANGS = { en: "English", fi: "Finnish" } as const;
const SYSTEM =
  "You write short quiz questions for ice hockey fans following a game live. Never mention betting, odds, stakes, money or bookmakers. " +
  "Keep the exact meaning of the question you are given, only change the wording. Use the placeholders you are given for team names, " +
  "and never attach a case ending to a placeholder (no {team}:n or {home}:lle). Reply with JSON only.";

/** what each wording must keep, beyond the placeholders */
const KEEP: Record<CallKind, string> = {
  who_wins: "The answers are: the home team in regulation, the away team in regulation, or overtime.",
  first_goal_period: "The answers are the two teams or no goal.",
  power_play: "It is a yes/no question about scoring during this power play.",
  answer_back: 'It is a yes/no question, and the window is exactly five minutes: keep "5 minutes" (English) or "viiden minuutin" (Finnish).',
  overtime: "It is a yes/no question about whether the game goes to overtime. Do not ask which team.",
};

let approvedTotal = 0;
for (const kind of Object.keys(PHRASE_VARS) as CallKind[]) {
  for (const lang of Object.keys(LANGS) as (keyof typeof LANGS)[]) {
    const vars = PHRASE_VARS[kind].map((v) => `{${v}}`).join(", ");
    const ask = () =>
      chatJson({
        system: SYSTEM,
        user:
          `Write ${count} different ${LANGS[lang]} wordings of the question "${BUILT_IN[kind][lang]}". ` +
          `${KEEP[kind]} Each is one question ending in "?", at most 90 characters, and uses only these placeholders, written exactly so: ${vars}.` +
          (kind === "power_play" || kind === "answer_back" ? " Each must contain {team}." : "") +
          (kind === "first_goal_period" ? ` {period} is a bare number, so write it as ${lang === "fi" ? '"{period}. erän"' : '"period {period}"'}.` : "") +
          ` Reply as {"phrases": ["..."]}.`,
        // a reasoning model thinks for a minute or so on a list; offline, so we wait (and retry once)
        timeoutMs: 240_000,
        temperature: 0.8,
        maxTokens: 6000,
      });
    const reply = ((await ask()) ?? (await ask())) as { phrases?: unknown } | null;
    const phrases = [...new Set((Array.isArray(reply?.phrases) ? reply.phrases : []).filter((p): p is string => typeof p === "string").map((p) => p.trim()))];
    if (!phrases.length) {
      console.log(`${kind}/${lang}: no usable reply from the llm`);
      continue;
    }
    const known = new Set(await db.phrases.listApproved(kind, lang));
    const rows = phrases.filter((t) => !known.has(t)).map((t) => ({ callType: kind, lang, template: t, problem: phraseProblem(kind, t) }));
    await db.phrases.insert(rows.map(({ callType, lang: l, template, problem }) => ({ callType, lang: l, template, approved: problem === null })));
    const ok = rows.filter((r) => !r.problem).length;
    approvedTotal += ok;
    const rejected = rows.filter((r) => r.problem).map((r) => `${r.problem}: ${r.template}`);
    console.log(`${kind}/${lang}: ${ok}/${rows.length} approved${rejected.length ? `\n  rejected ${rejected.join("\n  rejected ")}` : ""}`);
  }
}
console.log(`${approvedTotal} wordings approved in phrase_bank (${db.mode})`);
