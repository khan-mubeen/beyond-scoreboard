import type { Content, ContentSentence, Fact, VerificationReport } from "@/shared/types";
import { bettingLanguage } from "./checks/betting-language";
import { modelTypedNumber } from "./checks/model-typed-number";
import { offIceClaim } from "./checks/off-ice-claim";
import { quote } from "./checks/quote";
import { repeatedFacts } from "./checks/repeated-fact";
import type { Check } from "./checks/types";
import { uncitedSentence } from "./checks/uncited-sentence";
import { unknownName } from "./checks/unknown-name";

/** order matters: the first failing check names the error */
export const CHECKS: Check[] = [uncitedSentence, bettingLanguage, quote, offIceClaim, unknownName, modelTypedNumber];

export function checkSentence(s: ContentSentence, ledger: Fact[]) {
  return CHECKS.map((check) => check(s, ledger)).find((f) => f !== null) ?? null;
}

/**
 * the only judge of whether content may be shown. deterministic, no llm. each sentence passes every
 * check on its own, and the text as a whole never repeats a claim
 */
export function verify(content: Content, ledger: Fact[]): VerificationReport {
  const repeats = repeatedFacts(content.sentences, ledger);
  const claims = content.sentences.map((s, i) => {
    const failure = checkSentence(s, ledger) ?? repeats[i];
    return {
      text: s.text,
      factIds: s.factIds,
      passed: failure === null,
      errorType: failure?.errorType ?? null,
      reason: failure?.reason ?? null,
    };
  });
  return { contentId: content.id, claims, blockedCount: claims.filter((c) => !c.passed).length };
}
