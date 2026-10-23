import type { ContentSentence, Fact } from "@/shared/types";

const PLACEHOLDER = /\{(F\d+)(?::(ord))?\}/g;

function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

/**
 * swaps {F12} (or {F1:ord} for "13th") for ledger values, so the model never types a number.
 * every placeholder becomes a citation. unknown ids stay in the text and get cited,
 * so the validator blocks the sentence
 */
export function fill(template: string, ledger: Fact[]): ContentSentence {
  const factIds: string[] = [];
  const text = template.replace(PLACEHOLDER, (whole, id: string, format?: string) => {
    if (!factIds.includes(id)) factIds.push(id);
    const fact = ledger.find((f) => f.id === id);
    if (!fact) return whole;
    return format === "ord" && typeof fact.value === "number" ? ordinal(fact.value) : String(fact.value);
  });
  return { text, factIds };
}
