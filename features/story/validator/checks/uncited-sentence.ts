import type { Check } from "./types";

/** every sentence cites at least one fact, and every cited fact exists */
export const uncitedSentence: Check = (sentence, ledger) => {
  if (sentence.factIds.length === 0) return { errorType: "uncited_sentence", reason: "cites no facts" };
  const missing = sentence.factIds.filter((id) => !ledger.some((f) => f.id === id));
  if (missing.length > 0)
    return { errorType: "uncited_sentence", reason: `cites ${missing.join(", ")}, not in the ledger` };
  return null;
};
