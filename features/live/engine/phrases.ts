// pure: built-in call wordings, and filling a template's {placeholders}.
// approved phrase_bank rows (npm run pregen:phrases) take turns with these at runtime
import { checkText } from "@/shared/guardrails";
import type { CallKind } from "./rules";

export type PhraseLang = "en" | "fi";

/** placeholders each call kind may use */
export const PHRASE_VARS: Record<CallKind, string[]> = {
  who_wins: ["home", "away"],
  first_goal_period: ["home", "away", "period"],
  power_play: ["team", "home", "away"],
  answer_back: ["team", "home", "away"],
  overtime: ["home", "away"],
};

export const BUILT_IN: Record<CallKind, Record<PhraseLang, string>> = {
  who_wins: { en: "Who wins?", fi: "Kuka voittaa?" },
  first_goal_period: { en: "Who scores first in period {period}?", fi: "Kuka tekee {period}. erän ensimmäisen maalin?" },
  power_play: { en: "Will {team} score on this power play?", fi: "Tekeekö {team} maalin tällä ylivoimalla?" },
  answer_back: { en: "Will {team} answer within 5 minutes?", fi: "Vastaako {team} viiden minuutin sisällä?" },
  overtime: { en: "Will this go to overtime?", fi: "Mennäänkö jatkoajalle?" },
};

export const fillPhrase = (template: string, vars: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (whole, k: string) => vars[k] ?? whole);

/** calls answered yes or no */
const YES_NO: CallKind[] = ["power_play", "answer_back", "overtime"];
/** what the wording must still be about */
const SUBJECT: Partial<Record<CallKind, RegExp>> = {
  power_play: /power ?play|man advantage|ylivoim/i,
  overtime: /overtime|jatkoaj/i,
};

/**
 * a template is usable when it's a short question that still asks what the call decides: only its
 * kind's placeholders, its options' shape (yes / no), its subject, and the guardrails
 */
export function phraseProblem(kind: CallKind, template: string): string | null {
  const t = template.trim();
  if (t.length < 8 || t.length > 90) return "length";
  if (!t.endsWith("?")) return "not a question";
  const used = [...t.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
  const bad = used.find((v) => !PHRASE_VARS[kind].includes(v));
  if (bad) return `unknown placeholder {${bad}}`;
  if (kind === "power_play" || kind === "answer_back") {
    if (!used.includes("team")) return "must name {team}";
  }
  // a team name can't take a finnish case ending: "{team}:n" would read "Kärpät:n"
  if (/\{\w+\}:\p{L}/u.test(t)) return "inflected placeholder";
  // {period} is a bare number: "in period 2" or "2. erän", never "in 2"
  if (used.includes("period") && !/period \{period\}|\{period\}\. erä/i.test(t)) return "{period} needs its word";
  if (YES_NO.includes(kind) && /^(who|which|what|kumpi|kuka|mikä|mitkä)\b/i.test(t)) return "not a yes/no question";
  const subject = SUBJECT[kind];
  if (subject && !subject.test(t)) return "loses its subject";
  if (checkText(t).length) return "betting language";
  // answer back may say its window, 5 minutes; no call types any other number
  const digits = t.replace(/\{\w+\}/g, "").match(/\d+/g) ?? [];
  if (digits.some((d) => !(kind === "answer_back" && d === "5"))) return "types a number";
  if (kind === "answer_back" && !/\b5\b|\bfive\b|viiden/i.test(t)) return "must say 5 minutes";
  return null;
}

/** a random approved template, else the built-in, filled and checked */
export function wordCall(kind: CallKind, vars: Record<string, string>, approved: string[], lang: PhraseLang = "en", rand = Math.random): string {
  const pool = approved.filter((t) => phraseProblem(kind, t) === null);
  const template = pool.length ? pool[Math.floor(rand() * pool.length)] : BUILT_IN[kind][lang];
  const text = fillPhrase(template, vars);
  return checkText(text).length || /\{\w+\}/.test(text) ? fillPhrase(BUILT_IN[kind][lang], vars) : text;
}
