import { capitalisedWords, wordsOf } from "./text";
import type { Check } from "./types";

// capitalised words that are fine without a fact behind them
const COMMON = new Set([
  "Liiga",
  "Kaleva",
  "OT",
  "I",
  "Playoffs",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]);

/**
 * every capitalised word mid-sentence must be a name the ledger knows (a team, a player,
 * a venue) or a common word. blocks people and places the model made up
 */
export const unknownName: Check = (sentence, ledger) => {
  const known = wordsOf(ledger);
  const unknown = capitalisedWords(sentence.text).filter((w) => !known.has(w) && !COMMON.has(w));
  if (unknown.length === 0) return null;
  return { errorType: "unknown_name", reason: `"${unknown[0]}" is not a name in the fact ledger` };
};
