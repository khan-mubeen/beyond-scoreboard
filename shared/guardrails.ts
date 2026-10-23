// guardrails for user-facing text only: content sentences, call questions
// and options, ui copy. not for code identifiers.
// rules: say "chance", never "odds". no prizes, no betting, no odds formatting.

export type GuardrailKind = "banned_word" | "odds_format";

export interface GuardrailMatch {
  kind: GuardrailKind;
  match: string;
  index: number;
}

// letters on either side, unicode-aware so finnish ä/ö count as letters
const before = "(?<![\\p{L}\\p{N}])";
const after = "(?![\\p{L}\\p{N}])";

/** whole english words, with common endings */
const EN_WORDS = [
  "bets?",
  "betting",
  "bettors?",
  "wagers?",
  "wagering",
  "bookmakers?",
  "bookies?",
  "payouts?",
  "prizes?",
  "odds",
];

/** finnish stems, so inflected forms match too (kertoimet, palkinnon, ...) */
const FI_STEMS = ["vedonly[öo]", "veto" + after, "kerroin", "kertoim", "panostu", "palkin"];

const BANNED = new RegExp(`${before}(?:${EN_WORDS.join("|")})${after}|${before}(?:${FI_STEMS.join("|")})`, "giu");

/** betting-style number formats. plain stats ("2.35 goals") and chances ("64%") pass */
const ODDS_FORMATS = [
  /@\s?\d+[.,]\d{1,2}/gu, // @2.35
  /(?<![\p{L}\p{N}.,])\d+[.,]\d{1,2}\s?x(?![\p{L}\p{N}])/giu, // 2.35x
  /\d[.,]\d{2}\s?[/|]\s?\d[.,]\d{2}(?:\s?[/|]\s?\d[.,]\d{2})?/gu, // 1.85 / 3.40 / 4.10
];

export function checkText(text: string): GuardrailMatch[] {
  const found: GuardrailMatch[] = [];
  for (const m of text.matchAll(BANNED)) found.push({ kind: "banned_word", match: m[0], index: m.index });
  for (const re of ODDS_FORMATS) {
    for (const m of text.matchAll(re)) found.push({ kind: "odds_format", match: m[0], index: m.index });
  }
  return found.sort((a, b) => a.index - b.index);
}

export function isClean(text: string): boolean {
  return checkText(text).length === 0;
}
