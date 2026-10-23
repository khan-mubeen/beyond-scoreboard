import type { Content, Fact, VerificationReport } from "@/shared/types";
import { modelTypedNumber } from "./checks/model-typed-number";
import { offIceClaim } from "./checks/off-ice-claim";
import { quote } from "./checks/quote";
import type { Check } from "./checks/types";
import { uncitedSentence } from "./checks/uncited-sentence";
import { unknownName } from "./checks/unknown-name";

/** order matters: the first failing check names the error */
export const CHECKS: Check[] = [uncitedSentence, modelTypedNumber, unknownName, quote, offIceClaim];

/** the only judge of whether content may be shown. deterministic, no llm */
export function verify(content: Content, ledger: Fact[]): VerificationReport {
  const claims = content.sentences.map((s) => {
    const failure = CHECKS.map((check) => check(s, ledger)).find((f) => f !== null) ?? null;
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
