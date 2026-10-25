// texts for real matches: content_cache first (llm texts stored by `npm run pregen`), else the
// template. cached text is checked again against today's ledger, so stale numbers never show
import { getDb } from "@/shared/db";
import type { Content, Language, SpokenSummary } from "@/shared/types";
import { buildMatchLedger, type MatchFactsInput, type MatchLedger } from "../ledger/match-ledger";
import { filled, templateContent, whatItMeansLine } from "../templates/match";
import { summaryContent } from "../templates/summary";
import { ttsEnabled, ttsFromEnv } from "../tts";
import { generateAudio, sayOnce, spokenFrom, storedAudio } from "./audio";
import { verify } from "../validator/validator";
import { fill } from "../writer/fill";

export const contentKey = (matchId: string, teamId: string, kind: string, lang: Language) => `${matchId}:${teamId}:${kind}:${lang}`;

/** the match story: a stored llm text if it still checks out, else the template */
export async function matchStory(m: MatchFactsInput, teamId: string, lang: Language = "en"): Promise<{ content: Content; ledger: MatchLedger }> {
  const ledger = buildMatchLedger(m);
  const cached = await getDb()
    .content.get(contentKey(m.matchId, teamId, "story", lang))
    .catch(() => null);
  if (cached) {
    const content = cached.content as Content;
    if (Array.isArray(content?.sentences) && content.sentences.length && verify(content, ledger.facts).blockedCount === 0) {
      return { content, ledger };
    }
  }
  return { content: templateContent("story", m, ledger, teamId, lang), ledger };
}

/** the ~60-second summary: a stored llm text if it still checks out, else the template (both languages) */
export async function matchSummary(m: MatchFactsInput, teamId: string, lang: Language): Promise<{ content: Content; ledger: MatchLedger; source: "llm" | "template" }> {
  const ledger = buildMatchLedger(m);
  const cached = await getDb()
    .content.get(contentKey(m.matchId, teamId, "summary", lang))
    .catch(() => null);
  const content = cached?.content as Content | undefined;
  if (content && Array.isArray(content.sentences) && content.sentences.length && verify(content, ledger.facts).blockedCount === 0) {
    return { content, ledger, source: "llm" };
  }
  return { content: summaryContent(m, ledger, teamId, lang), ledger, source: "template" };
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
  return spokenFrom(lang, text, rec, m.matchId);
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
