import type { Fact, Language } from "@/shared/types";
import { writerRules } from "./rules";

export function storyPrompt(teamName: string, ledger: Fact[], language: Language): string {
  return [
    `Write a post-game story of 4-6 sentences for ${teamName} fans.`,
    "Start with the result, then how it moved the table and the playoff chance.",
    "",
    writerRules(ledger, language),
  ].join("\n");
}
