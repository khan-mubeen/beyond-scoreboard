// shared text helpers for the checks
import type { Fact } from "@/shared/types";
import { surnameGenitive, teamForms } from "../../i18n/fi-team-names";

const WORD_NUMBERS: Record<string, number> = {
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  twenty: 20,
  twice: 2,
  kaksi: 2,
  kolme: 3,
  neljä: 4,
  viisi: 5,
};

/**
 * every number a sentence states: digits ("13th" -> 13, "3–2" -> 3 and 2, "58:51" stays a clock),
 * and spelled-out cardinals ("two" -> 2). "one" and ordinals like "third period" are not counted
 */
export function numbersIn(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\d+(?::\d{2})?(?:[.,]\d+)?/g)) out.push(m[0].replace(",", "."));
  for (const m of text.toLowerCase().matchAll(/\p{L}+/gu)) if (WORD_NUMBERS[m[0]] !== undefined) out.push(String(WORD_NUMBERS[m[0]]));
  return out;
}

/** the numbers a fact can back: its value, and any number written inside a text value */
export function numbersOf(fact: Fact): string[] {
  if (typeof fact.value === "number") return [String(fact.value)];
  return numbersIn(fact.value);
}

/** capitalised words that are not the first word of a sentence: candidate names */
export function capitalisedWords(text: string): string[] {
  const out: string[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  for (const s of sentences) {
    const words = [...s.matchAll(/[\p{L}][\p{L}'’-]*/gu)].map((m) => m[0]);
    words.slice(1).forEach((w) => {
      if (/^\p{Lu}/u.test(w)) out.push(w.replace(/['’]s$/u, ""));
    });
  }
  return out;
}

const WORD = /[\p{L}][\p{L}'’-]*/gu;
const wordList = (s: string) => [...s.matchAll(WORD)].map((m) => m[0].replace(/['’]s$/u, ""));

/**
 * every word that appears in a fact's label or text value, plus the finnish forms a known name
 * can take: any listed case of a team ("Kärppien", "HIFK:lle" -> HIFK), and a name's genitive
 * ("Virtasen" for Virtanen)
 */
export function wordsOf(facts: Fact[]): Set<string> {
  const out = new Set<string>();
  for (const f of facts) {
    const value = typeof f.value === "string" ? f.value : "";
    for (const w of [...wordList(f.label), ...wordList(value)]) out.add(w);
    for (const form of teamForms(value)) for (const w of wordList(form)) out.add(w);
    for (const w of wordList(value)) if (/^\p{Lu}/u.test(w)) out.add(surnameGenitive(w));
  }
  return out;
}
