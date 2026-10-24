// the llm writes sentences with {F12} placeholders from the ledger; we fill and validate.
// only sentences that pass every check survive; too few survivors means no llm text at all
import type { ContentSentence, Fact } from "@/shared/types";
import { chatJson } from "../llm/client";
import { checkSentence } from "../validator/validator";
import { fill } from "./fill";

export interface LlmWriteOptions {
  task: string;
  ledger: Fact[];
  /** fewest passing sentences to accept the result */
  minSentences?: number;
  timeoutMs?: number;
  language?: "en" | "fi";
}

const SYSTEM = [
  "You write short, factual sports texts for Finnish ice hockey fans.",
  "Use ONLY the facts given. Never type a number or a name yourself: write the fact's placeholder, e.g. {F12}, or {F3:ord} for 13th.",
  "Every sentence must use at least one placeholder. No quotes, no injuries or other off-ice claims.",
  'Say "chance", never "odds". Never mention betting or prizes.',
  'Reply with JSON only: {"sentences":[{"text":"..."}]}',
].join("\n");

export async function writeWithLlm(opts: LlmWriteOptions): Promise<ContentSentence[] | null> {
  const facts = opts.ledger.map((f) => `{${f.id}}: ${f.label} = ${f.value}${f.unit ? ` ${f.unit}` : ""}`).join("\n");
  const reply = await chatJson({
    system: SYSTEM,
    user: `${opts.task}\nWrite in ${opts.language === "fi" ? "Finnish" : "English"}.\n\nFacts:\n${facts}`,
    timeoutMs: opts.timeoutMs,
  });
  const raw = (reply as { sentences?: { text?: unknown }[] } | null)?.sentences;
  if (!Array.isArray(raw)) return null;
  const passed = raw
    .map((s) => (typeof s?.text === "string" ? fill(s.text, opts.ledger) : null))
    .filter((s): s is ContentSentence => !!s && checkSentence(s, opts.ledger) === null);
  return passed.length >= (opts.minSentences ?? 1) ? passed : null;
}
