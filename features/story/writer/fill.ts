import type { ContentSentence, Fact, Language } from "@/shared/types";
import { FI_CASES, FI_GOAL_KIND, teamCase, type FiCase } from "../i18n/fi-team-names";

const PLACEHOLDER = /\{(F\d+)(?::(\w+))?\}/g;

function ordinal(n: number, lang: Language): string {
  if (lang === "fi") return `${n}.`;
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

/** a fact value in a format: {F1:ord} "13th" ("13." in finnish), {F2:gen} a finnish case of a team name, {F9:fi} a goal kind in finnish */
function format(value: string | number, f: string | undefined, lang: Language): string {
  if (f === "ord" && typeof value === "number") return ordinal(value, lang);
  if (f && (FI_CASES as readonly string[]).includes(f)) return teamCase(String(value), f as FiCase);
  if (f === "fi") return FI_GOAL_KIND[String(value)] ?? String(value);
  return String(value);
}

/**
 * swaps {F12} (and formatted {F12:gen}, {F1:ord}) for ledger values, so the model never types a
 * number or inflects a name itself. every placeholder becomes a citation. unknown ids stay in the
 * text and get cited, so the validator blocks the sentence
 */
export function fill(template: string, ledger: Fact[], lang: Language = "en"): ContentSentence {
  const factIds: string[] = [];
  const text = template.replace(PLACEHOLDER, (whole, id: string, f?: string) => {
    if (!factIds.includes(id)) factIds.push(id);
    const fact = ledger.find((x) => x.id === id);
    return fact ? format(fact.value, f, lang) : whole;
  });
  return { text, factIds };
}
