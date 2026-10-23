import type { Fact, Language } from "@/shared/types";

// shared rules for every writer prompt. the validator enforces them, the prompt just asks nicely
export function writerRules(ledger: Fact[], language: Language): string {
  const facts = ledger.map((f) => `${f.id}: ${f.label} = ${f.value}${f.unit ? ` ${f.unit}` : ""}`).join("\n");
  return [
    `Write in ${language === "fi" ? "Finnish" : "English"}. One sentence per line.`,
    "Use only the facts below. Never type a number yourself: write {F12} and it is filled in. Use {F1:ord} for 13th.",
    "Every sentence must use at least one fact.",
    "No quotes, no injuries or other off-ice claims, no names that are not in the facts.",
    'Say "chance", never "odds". Never mention betting or prizes.',
    "",
    "Facts:",
    facts,
  ].join("\n");
}
