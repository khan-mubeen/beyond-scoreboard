import { checkText } from "@/shared/guardrails";
import type { Check } from "./types";

/** the shared guardrails: no betting words, no odds formats. chances are percentages */
export const bettingLanguage: Check = (sentence) => {
  const hit = checkText(sentence.text)[0];
  return hit ? { errorType: "betting_language", reason: `"${hit.match}" (${hit.kind.replace("_", " ")})` } : null;
};
