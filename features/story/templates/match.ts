// pure: template texts for a match. every value is a {F#} placeholder from the match ledger,
// so the validator passes them by construction. english now; the shapes are ready for finnish
import type { Content, ContentSentence, Language } from "@/shared/types";
import type { MatchFactsInput, MatchLedger } from "../ledger/match-ledger";
import { fill } from "../writer/fill";

const ph = (id: string | undefined) => (id ? `{${id}}` : "");
const ord = (id: string | undefined) => (id ? `{${id}:ord}` : "");

/** the match story for a finished game: result, the key goals, what it did to the table */
export function matchStorySentences(m: MatchFactsInput, l: MatchLedger): string[] {
  const { ids } = l;
  const homeWon = m.score.home > m.score.away;
  const extra = m.decidedIn === "overtime" ? " in overtime" : m.decidedIn === "shootout" ? " in a shootout" : "";
  const where = ids.venue ? ` at ${ph(ids.venue)}` : "";
  const out = [
    homeWon
      ? `${ph(ids.home)} beat ${ph(ids.away)} ${ph(ids.homeGoals)}–${ph(ids.awayGoals)}${extra}${where} on ${ph(ids.date)}.`
      : `${ph(ids.away)} won ${ph(ids.awayGoals)}–${ph(ids.homeGoals)}${extra}${where} on ${ph(ids.date)}.`,
  ];
  const first = l.goals[0];
  if (first?.scorer) out.push(`${ph(first.scorer)} opened the scoring for ${ph(first.team)} at ${ph(first.time)} of period ${ph(first.period)}.`);
  const winnerIdx = m.goals.findIndex((g, i) => i > 0 && i === lastLeadChange(m));
  const winner = winnerIdx > 0 ? l.goals[winnerIdx] : null;
  if (winner?.scorer) {
    out.push(`${ph(winner.scorer)} put ${ph(winner.team)} ahead for good at ${ph(winner.time)} of period ${ph(winner.period)}.`);
  }
  if (ids.positionBefore && ids.positionAfter && ids.chanceBefore && ids.chanceAfter && m.chanceBefore !== null && m.chanceAfter !== null) {
    const moved = m.positionBefore === m.positionAfter ? `kept ${ph(ids.team)} ${ord(ids.positionAfter)}` : `moved ${ph(ids.team)} from ${ord(ids.positionBefore)} to ${ord(ids.positionAfter)}`;
    const dir = m.chanceAfter >= m.chanceBefore ? "raised" : "lowered";
    out.push(`The result ${moved} and ${dir} their playoff chance from ${ph(ids.chanceBefore)}% to ${ph(ids.chanceAfter)}%.`);
  }
  return out;
}

/** index of the goal after which the eventual winner led for the rest of the game */
function lastLeadChange(m: MatchFactsInput): number {
  const homeWon = m.score.home > m.score.away;
  let idx = -1;
  m.goals.forEach((g, i) => {
    const prev = i > 0 ? m.goals[i - 1] : { homeScore: 0, awayScore: 0 };
    const leadsNow = homeWon ? g.homeScore > g.awayScore : g.awayScore > g.homeScore;
    const ledBefore = homeWon ? prev.homeScore > prev.awayScore : prev.awayScore > prev.homeScore;
    if (leadsNow && !ledBefore) idx = i;
  });
  return idx;
}

/** one live line after a goal: who scored and what the chance is if it ends now */
export function whatItMeansLine(l: MatchLedger, goalIndex: number): string {
  const g = l.goals[goalIndex];
  if (!g) return `${ph(l.ids.team)}'s playoff chance is ${ph(l.ids.chanceAfter)}% if it ends like this.`;
  const who = g.scorer ? `${ph(g.scorer)}'s ` : `${ph(g.team)}'s `;
  const kind = g.kind ? `${ph(g.kind)} ` : "";
  return `${who}${kind}goal at ${ph(g.time)} of period ${ph(g.period)} makes it ${ph(g.homeScore)}–${ph(g.awayScore)}: if it ends like this, ${ph(l.ids.team)}'s playoff chance is ${ph(l.ids.chanceAfter)}%.`;
}

export function filled(templates: string[], l: MatchLedger): ContentSentence[] {
  return templates.map((t) => fill(t, l.facts));
}

export function templateContent(
  kind: Content["kind"],
  m: MatchFactsInput,
  l: MatchLedger,
  teamId: string,
  language: Language,
): Content {
  return {
    id: `${kind}.${teamId}.${m.matchId}.${language}`,
    kind,
    gameId: m.matchId,
    teamId,
    language,
    sentences: filled(matchStorySentences(m, l), l),
    status: "fallback",
    generatedAt: new Date().toISOString(),
  };
}
