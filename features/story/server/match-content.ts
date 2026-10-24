// texts for real matches: content_cache first (llm texts stored by `npm run pregen`), else the
// template. cached text is checked again against today's ledger, so stale numbers never show
import { getDb } from "@/shared/db";
import type { Content, Language } from "@/shared/types";
import { buildMatchLedger, type MatchFactsInput, type MatchLedger } from "../ledger/match-ledger";
import { filled, templateContent, whatItMeansLine } from "../templates/match";
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

/** the live "what it means" line for the latest goal (template; the live loop may swap in an llm line) */
export function whatItMeansText(m: MatchFactsInput): string {
  const ledger = buildMatchLedger(m);
  if (m.goals.length === 0) {
    const s = fill(`Before puck drop: {${ledger.ids.team}}'s playoff chance is {${ledger.ids.chanceBefore}}%.`, ledger.facts);
    return ledger.ids.chanceBefore ? s.text : "";
  }
  return filled([whatItMeansLine(ledger, m.goals.length - 1)], ledger)[0].text;
}

export { buildMatchLedger, type MatchFactsInput, type MatchLedger } from "../ledger/match-ledger";
