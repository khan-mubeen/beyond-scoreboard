// whole-text check: one text never says the same thing twice. a claim (a chance in %, a league
// position) is cited once; the same change ("85% to 88%") is stated once, whatever facts carry it;
// and no sentence is a near copy of an earlier one. names, dates, periods and scores may repeat
import type { ContentSentence, Fact } from "@/shared/types";
import type { CheckFailure } from "./types";

/** facts that make a claim: a chance (unit %) or a league position */
const isClaim = (f: Fact | undefined) => !!f && typeof f.value === "number" && (f.unit === "%" || /position/i.test(f.label));

/** the percentages in a sentence, in order ("85%", "88 %", "85 prosentista") */
const percents = (text: string) => [...text.matchAll(/(\d+(?:[.,]\d+)?)\s?(?:%|prosent)/g)].map((m) => m[1]);

const words = (text: string) => new Set(text.toLowerCase().match(/[\p{L}\d]+/gu) ?? []);
function similarity(a: Set<string>, b: Set<string>): number {
  const shared = [...a].filter((w) => b.has(w)).length;
  return shared / Math.max(1, new Set([...a, ...b]).size);
}

/** per sentence: null, or why it repeats an earlier one */
export function repeatedFacts(sentences: ContentSentence[], ledger: Fact[]): (CheckFailure | null)[] {
  const seenFacts = new Map<string, number>();
  const seenPairs = new Map<string, number>();
  const seenWords: Set<string>[] = [];
  return sentences.map((s, i) => {
    let failure: CheckFailure | null = null;
    for (const id of s.factIds) {
      if (!isClaim(ledger.find((f) => f.id === id))) continue;
      if (seenFacts.has(id) && !failure) failure = { errorType: "repeated_fact", reason: `${id} was already stated in sentence ${seenFacts.get(id)! + 1}` };
      if (!seenFacts.has(id)) seenFacts.set(id, i);
    }
    const p = percents(s.text);
    for (let k = 0; k + 1 < p.length; k++) {
      const pair = `${p[k]}->${p[k + 1]}`;
      if (seenPairs.has(pair) && !failure) failure = { errorType: "repeated_fact", reason: `the change ${p[k]}% to ${p[k + 1]}% was already stated in sentence ${seenPairs.get(pair)! + 1}` };
      if (!seenPairs.has(pair)) seenPairs.set(pair, i);
    }
    const w = words(s.text);
    const twin = w.size >= 6 ? seenWords.findIndex((x) => similarity(x, w) >= 0.8) : -1;
    if (twin >= 0 && !failure) failure = { errorType: "repeated_fact", reason: `a near copy of sentence ${twin + 1}` };
    seenWords.push(w);
    return failure;
  });
}
