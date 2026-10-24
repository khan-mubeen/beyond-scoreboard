import type { Check } from "./types";

// we have no verified quotes, so no quotation marks and no "said" attributions
const QUOTE_MARKS = /["“”„«»]/;
const ATTRIBUTION = /\b(said|says|told|according to|quoted|sanoi|sanoo|kertoi|totesi|mukaan)\b/i;

export const quote: Check = (sentence) => {
  const mark = QUOTE_MARKS.exec(sentence.text);
  if (mark) return { errorType: "quote", reason: `quotation mark ${mark[0]} (no verified quotes)` };
  const said = ATTRIBUTION.exec(sentence.text);
  if (said) return { errorType: "quote", reason: `"${said[0]}" attributes words to someone (no verified quotes)` };
  return null;
};
