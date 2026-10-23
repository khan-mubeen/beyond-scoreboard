import { teamById } from "@/shared/mock";
import type { Content, Fact } from "@/shared/types";
import { type ContentMeta, contentId } from "../content-id";
import { fallbackContent } from "../templates/fallback";
import { fill } from "./fill";
import { complete } from "./llm-client";
import { briefPrompt } from "./prompts/brief";
import { storyPrompt } from "./prompts/story";

/**
 * drafts content with the llm, or the template when LLM_ENABLED is not "true".
 * a draft is not trusted until validator/verify() has passed it
 */
export async function writeContent(meta: ContentMeta, ledger: Fact[]): Promise<Content> {
  if (process.env.LLM_ENABLED !== "true") return fallbackContent(meta, ledger);

  const team = teamById(meta.teamId).name;
  const prompt =
    meta.kind === "brief" ? briefPrompt(team, ledger, meta.language) : storyPrompt(team, ledger, meta.language);
  const raw = await complete(prompt);
  const sentences = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => fill(line, ledger));

  return { ...meta, id: contentId(meta), sentences, status: "verified", generatedAt: new Date().toISOString() };
}
