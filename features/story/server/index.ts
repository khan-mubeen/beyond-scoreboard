// story server api. server only: never import this from browser code (lint enforces it).
// reads pre-generated content from the cache, never calls the llm at request time
import { getFactInputs } from "@/features/stakes/server";
import type { Content, ContentKind, Fact, Language, VerificationReport } from "@/shared/types";
import { type ContentMeta, contentId, parseContentId } from "../content-id";
import { buildLedger } from "../ledger/build-ledger";
import { fallbackContent } from "../templates/fallback";
import { verify } from "../validator/validator";
import { readCache } from "./cache";

// real matches: ledger, story (content_cache or template) and the live "what it means" line
export {
  buildMatchLedger,
  contentKey,
  matchStory,
  matchSummary,
  spokenSummary,
  summaryText,
  whatItMeansText,
  type MatchFactsInput,
  type MatchLedger,
} from "./match-content";
// the spoken summaries' audio (prep-time scripts)
export { AUDIO_BUCKET, generateAudio, saveAudio, storedAudio, transcriptHash, type AudioRecord } from "./audio";
export { hasAzureKey, ttsEnabled, ttsFromEnv, voices } from "../tts";

async function ledgerFor(teamId: string, gameId: string): Promise<Fact[]> {
  return buildLedger(await getFactInputs(teamId, gameId));
}

async function generate(meta: ContentMeta): Promise<Content> {
  const cached = readCache(contentId(meta));
  if (cached) return cached.content;
  return fallbackContent(meta, await ledgerFor(meta.teamId, meta.gameId));
}

export function generateBrief(teamId: string, gameId: string, language: Language): Promise<Content> {
  return generate({ kind: "brief", teamId, gameId, language });
}

export function generateStory(teamId: string, gameId: string, language: Language): Promise<Content> {
  return generate({ kind: "story", teamId, gameId, language });
}

export function generateContent(
  kind: ContentKind,
  teamId: string,
  gameId: string,
  language: Language,
): Promise<Content> {
  return generate({ kind, teamId, gameId, language });
}

/** the cached report, or a fresh check of the fallback. null for an unknown id */
export async function getVerification(id: string): Promise<VerificationReport | null> {
  const cached = readCache(id);
  if (cached) return cached.report;
  const meta = parseContentId(id);
  if (!meta) return null;
  const ledger = await ledgerFor(meta.teamId, meta.gameId);
  return verify(fallbackContent(meta, ledger), ledger);
}
