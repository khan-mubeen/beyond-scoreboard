import type { ContentSentence, Fact, ValidationErrorType } from "@/shared/types";

export interface CheckFailure {
  errorType: ValidationErrorType;
  reason: string;
}

/** one check per error type. returns null when the sentence passes */
export type Check = (sentence: ContentSentence, ledger: Fact[]) => CheckFailure | null;
