import type { Fact, Language } from "@/shared/types";
import { writerRules } from "./rules";

export function briefPrompt(teamName: string, ledger: Fact[], language: Language): string {
  return [
    `Write a pre-game brief of 4-5 sentences for ${teamName} fans watching together.`,
    "Lead with what tonight's game means for the playoff chase.",
    "",
    writerRules(ledger, language),
  ].join("\n");
}
