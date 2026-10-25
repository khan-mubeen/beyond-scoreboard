// texts for real matches: an approved text from content_cache first (stored by `npm run pregen`,
// reviewed by an editor in /editor), else the template. a stored text is checked again against
// today's ledger, so stale numbers never show, and a text no editor approved is never shown. every
// served text carries its origin: who wrote it (ai or the template) and whether it was reviewed
import { getDb } from "@/shared/db";
import type { Content, Language, SpokenSummary, TextOrigin } from "@/shared/types";
import { buildMatchLedger, type MatchFactsInput, type MatchLedger } from "../ledger/match-ledger";
import { filled, templateContent, whatItMeansLine } from "../templates/match";
import { summaryContent } from "../templates/summary";
import { ttsEnabled, ttsFromEnv } from "../tts";
import { generateAudio, sayOnce, spokenFrom, storedAudio } from "./audio";
import { verify } from "../validator/validator";
import { fill } from "../writer/fill";

export const contentKey = (matchId: string, teamId: string, kind: string, lang: Language) => `${matchId}:${teamId}:${kind}:${lang}`;

/** a stored text that may be shown: approved by an editor, and still passing the validator today */
async function approvedText(key: string, ledger: MatchLedger): Promise<{ content: Content; origin: TextOrigin } | null> {
  const cached = await getDb()
    .content.get(key)
    .catch(() => null);
  const content = cached?.content as Content | undefined;
  const review = content?.review;
  if (!cached || !content || review?.status !== "approved" || !Array.isArray(content.sentences) || !content.sentences.length) return null;
  if (verify(content, ledger.facts).blockedCount > 0) return null;
  const origin: TextOrigin = { source: cached.source === "llm" ? "ai" : "template", reviewed: review.by && review.at ? { by: review.by, at: review.at } : null, key };
  return { content: { ...content, origin }, origin };
}

const templateOrigin = (key: string): TextOrigin => ({ source: "template", reviewed: null, key });

/** the match story: an approved stored text, else the template */
export async function matchStory(m: MatchFactsInput, teamId: string, lang: Language = "en"): Promise<{ content: Content; ledger: MatchLedger }> {
  const ledger = buildMatchLedger(m);
  const key = contentKey(m.matchId, teamId, "story", lang);
  const approved = await approvedText(key, ledger);
  if (approved) return { content: approved.content, ledger };
  return { content: { ...templateContent("story", m, ledger, teamId, lang), origin: templateOrigin(key) }, ledger };
}

/** the ~60-second summary: an approved stored text, else the template (both languages) */
export async function matchSummary(m: MatchFactsInput, teamId: string, lang: Language): Promise<{ content: Content; ledger: MatchLedger; source: "llm" | "template" }> {
  const ledger = buildMatchLedger(m);
  const key = contentKey(m.matchId, teamId, "summary", lang);
  const approved = await approvedText(key, ledger);
  if (approved) return { content: approved.content, ledger, source: approved.origin.source === "ai" ? "llm" : "template" };
  return { content: { ...summaryContent(m, ledger, teamId, lang), origin: templateOrigin(key) }, ledger, source: "template" };
}

export const summaryText = (c: Content) => c.sentences.map((s) => s.text).join(" ");

/**
 * the summary as the page plays it: the stored audio with the transcript it was made from. with
 * TTS_ENABLED=false (the demo) nothing is synthesized here, ever: stored audio or none
 */
export async function spokenSummary(m: MatchFactsInput, teamId: string, lang: Language): Promise<SpokenSummary> {
  const [{ content }, rec] = await Promise.all([matchSummary(m, teamId, lang), storedAudio(m.matchId, teamId, lang)]);
  const text = summaryText(content);
  if (!rec) {
    if (!ttsEnabled()) sayOnce("story: TTS API disabled — using stored audio");
    else void makeAudioLater(m.matchId, teamId, lang, text);
  }
  return { ...spokenFrom(lang, text, rec, m.matchId), origin: content.origin ?? null };
}

// a running server with TTS_ENABLED=true fills in missing audio once, in the background
const making = new Set<string>();
async function makeAudioLater(matchId: string, teamId: string, lang: Language, text: string) {
  const key = `${matchId}:${lang}`;
  const tts = ttsFromEnv();
  if (making.has(key) || tts.name === "none") return;
  making.add(key);
  await generateAudio(tts, matchId, teamId, lang, text).catch((err) => console.warn(`story: tts failed for ${key}: ${(err as Error).message}`));
}

/** the live "what it means" line for the latest goal (template; the live loop may swap in an llm line) */
export function whatItMeansText(m: MatchFactsInput): string {
  const ledger = buildMatchLedger(m);
  if (m.goals.length === 0) {
    const s = fill(`Before the game: {${ledger.ids.team}}'s ${m.chanceNoun ?? "playoff chance"} is {${ledger.ids.chanceBefore}}%.`, ledger.facts);
    return ledger.ids.chanceBefore ? s.text : "";
  }
  return filled([whatItMeansLine(ledger, m.goals.length - 1, m.decidedIn !== null, m.chanceNoun)], ledger)[0].text;
}

export { buildMatchLedger, type MatchFactsInput, type MatchLedger } from "../ledger/match-ledger";
