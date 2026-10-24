import { numbersIn, numbersOf } from "./text";
import type { Check } from "./types";

/**
 * every number in the text (digits, "13th", "58:51", "three") must equal a value of one of
 * the cited facts. catches numbers the model typed itself instead of using a placeholder
 */
export const modelTypedNumber: Check = (sentence, ledger) => {
  const cited = ledger.filter((f) => sentence.factIds.includes(f.id));
  const allowed = new Set(cited.flatMap(numbersOf));
  const stray = numbersIn(sentence.text).filter((n) => !allowed.has(n));
  if (stray.length === 0) return null;
  return {
    errorType: "model_typed_number",
    reason: `"${stray[0]}" is not a value in the cited facts (${sentence.factIds.join(", ") || "none"})`,
  };
};
