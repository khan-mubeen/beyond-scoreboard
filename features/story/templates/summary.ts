// pure: the ~60-second spoken match summary, in english and finnish, from ledger facts only.
// five parts: what was at stake before the game, how it unfolded (every goal), the turning point,
// what it meant (chance and position before -> after), and what's next. every value is a {F#}
// placeholder, so the validator passes it by construction. optional lines keep it near 900-1,000
// characters (about a minute of speech); a per-match choice of wordings keeps matches apart.
// finnish uses the team case table ({F2:ade}) and keeps player names in the nominative
import type { Content, Language } from "@/shared/types";
import type { MatchFactsInput, MatchLedger } from "../ledger/match-ledger";
import { fill } from "../writer/fill";

export const SUMMARY_LENGTH = { min: 900, max: 1050 };

const ph = (id: string | undefined, f?: string) => (id ? `{${id}${f ? `:${f}` : ""}}` : "");

/** a stable pick among wordings, so the same match always reads the same */
function pick<T>(seed: string, options: T[]): T {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return options[h % options.length];
}

/** the opener and the turning point are parts of the summary: they outlast the other goal lines */
const OPENER = 8.6;
const TURNING_POINT = 8.5;

interface Line {
  text: string;
  /** lower goes first when the summary is too long */
  keep: number;
}

type Goal = MatchLedger["goals"][number];

function leadState(m: MatchFactsInput, i: number) {
  const g = m.goals[i];
  const prev = i > 0 ? m.goals[i - 1] : { homeScore: 0, awayScore: 0 };
  const lead = (h: number, a: number) => Math.sign(h - a);
  return { tied: g.homeScore === g.awayScore, change: lead(g.homeScore, g.awayScore) !== 0 && lead(g.homeScore, g.awayScore) !== lead(prev.homeScore, prev.awayScore) };
}

// ---------- english ----------

function kindEn(g: Goal, kind: string | null): string {
  if (!g.kind || !kind) return "";
  if (kind === "power play" || kind === "5-on-3 power play") return ` on the ${ph(g.kind)}`;
  if (kind === "empty net") return ` into an ${ph(g.kind)}`;
  if (kind === "extra attacker") return ` with an ${ph(g.kind)}`;
  if (kind === "penalty shot") return ` on a ${ph(g.kind)}`;
  if (kind === "shootout goal") return " in the shootout";
  return ` (${ph(g.kind)})`;
}

/** the shootout's winning shot: the feed doesn't move the score for it, so it gets its own line */
const isShootout = (m: MatchFactsInput, i: number) => m.goals[i].period >= 5 || m.goals[i].kind === "shootout goal";

function linesEn(m: MatchFactsInput, l: MatchLedger): Line[] {
  const { ids } = l;
  const out: Line[] = [];
  const at = (g: Goal, i?: number) => (i !== undefined && m.goals[i].period === 4 ? `at ${ph(g.time)} of overtime` : `at ${ph(g.time)} of period ${ph(g.period)}`);
  const venue = ids.venue ? ` at ${ph(ids.venue)}` : "";
  out.push({ text: pick(m.matchId, [`${ph(ids.home)} hosted ${ph(ids.away)}${venue} on ${ph(ids.date)}.`, `${ph(ids.home)} met ${ph(ids.away)}${venue} on ${ph(ids.date)}.`]), keep: 1 });
  // 1. what was at stake
  if (ids.positionBefore && ids.chanceBefore) out.push({ text: `${ph(ids.team)} came in ${ph(ids.positionBefore, "ord")} in the Liiga table with a ${ph(ids.chanceBefore)}% playoff chance.`, keep: 9 });
  if (ids.worthWin && ids.worthLoss) out.push({ text: `A regulation win was worth a ${ph(ids.worthWin)}% playoff chance, while a regulation loss would leave it at ${ph(ids.worthLoss)}%.`, keep: 6 });
  // 2. how it unfolded
  m.goals.forEach((goal, i) => {
    const g = l.goals[i];
    const who = g.scorer ? ph(g.scorer) : ph(g.team);
    const score = `${ph(g.homeScore)}–${ph(g.awayScore)}`;
    const kind = kindEn(g, goal.kind);
    const { tied, change } = leadState(m, i);
    if (isShootout(m, i)) return out.push({ text: `${who} scored the shootout winner for ${ph(g.team)}.`, keep: 8 });
    const text =
      i === 0
        ? `${who} opened the scoring for ${ph(g.team)}${kind} ${at(g, i)}.`
        : tied
          ? `${who} tied it ${score} for ${ph(g.team)}${kind} ${at(g, i)}.`
          : change
            ? `${who} put ${ph(g.team)} ahead ${score}${kind} ${at(g, i)}.`
            : pick(`${m.matchId}${i}`, [`${who} made it ${score} for ${ph(g.team)}${kind} ${at(g, i)}.`, `${ph(g.team)} added a goal ${at(g, i)} through ${who}${kind}: ${score}.`]);
    out.push({ text, keep: i === 0 ? OPENER : change || tied ? 8 : 3 });
  });
  const homeWon = m.score.home > m.score.away;
  const extra = m.decidedIn === "overtime" ? " in overtime" : m.decidedIn === "shootout" ? " in a shootout" : "";
  const [w, x, y] = homeWon ? [ids.home, ids.homeGoals, ids.awayGoals] : [ids.away, ids.awayGoals, ids.homeGoals];
  out.push({ text: `${ph(w)} won the game ${ph(x)}–${ph(y)}${extra}.`, keep: 10 });
  // 3. the turning point
  const tp = m.turningPoint;
  if (tp && tp.before !== tp.after && ids.turnBefore && ids.turnAfter && l.goals[tp.goal]) {
    const g = l.goals[tp.goal];
    const who = g.scorer ? `${ph(g.scorer)}'s goal` : `the ${ph(g.team)} goal`;
    const when = isShootout(m, tp.goal) ? "in the shootout" : at(g, tp.goal);
    out.push({ text: `The turning point was ${who} ${when}: it moved ${ph(ids.team)}'s playoff chance from ${ph(ids.turnBefore)}% to ${ph(ids.turnAfter)}%.`, keep: TURNING_POINT });
  }
  // 4. what it meant
  if (ids.positionBefore && ids.positionAfter && ids.chanceBefore && ids.chanceAfter) {
    out.push({
      text:
        m.positionBefore === m.positionAfter
          ? `${ph(ids.team)} stays ${ph(ids.positionAfter, "ord")}, with a playoff chance of ${ph(ids.chanceAfter)}%, from ${ph(ids.chanceBefore)}% before the game.`
          : m.chanceBefore === m.chanceAfter
            ? `That moved ${ph(ids.team)} from ${ph(ids.positionBefore, "ord")} to ${ph(ids.positionAfter, "ord")}, and the playoff chance stayed at ${ph(ids.chanceAfter)}%.`
            : `That moved ${ph(ids.team)} from ${ph(ids.positionBefore, "ord")} to ${ph(ids.positionAfter, "ord")}, and the playoff chance went from ${ph(ids.chanceBefore)}% to ${ph(ids.chanceAfter)}%.`,
      keep: 10,
    });
  }
  // 5. what's next
  if (ids.nextOpponent && ids.nextDate) {
    out.push({ text: `Next up for ${ph(ids.team)}: ${ph(ids.nextOpponent)} on ${ph(ids.nextDate)}.`, keep: 9 });
    if (ids.nextWin && ids.nextLoss) out.push({ text: `A win there would mean a ${ph(ids.nextWin)}% playoff chance, a loss ${ph(ids.nextLoss)}%.`, keep: 7 });
  }
  return out;
}

/** the goal after which the winner led for good (not a shootout), and the margin facts */
function decider(m: MatchFactsInput, l: MatchLedger) {
  const homeWon = m.score.home > m.score.away;
  let at = -1;
  m.goals.forEach((g, i) => {
    const ahead = homeWon ? g.homeScore > g.awayScore : g.awayScore > g.homeScore;
    if (ahead && at < 0) at = i;
    if (!ahead) at = -1;
  });
  const winner = homeWon ? l.ids.home : l.ids.away;
  const shutout = (homeWon ? m.score.away : m.score.home) === 0;
  const oneGoal = Math.abs(m.score.home - m.score.away) === 1 && m.decidedIn === "regulation";
  return { goal: at >= 0 && !isShootout(m, at) ? l.goals[at] : null, winner, shutout, oneGoal };
}

const FILLERS_EN = (m: MatchFactsInput, l: MatchLedger) => {
  const d = decider(m, l);
  return [
    ...(d.goal ? [`${d.goal.scorer ? `${ph(d.goal.scorer)}'s goal` : `The ${ph(d.goal.team)} goal`} at ${ph(d.goal.time)} proved to be the winner.`] : []),
    ...(d.shutout ? [`${ph(d.winner)} did not concede a goal all night.`] : []),
    ...(d.oneGoal ? [`It was a tight game, and ${ph(d.winner)} won it by one goal.`] : []),
    `For ${ph(l.ids.team)}, every point counts in the race for the playoffs.`,
    `${ph(l.ids.home)} and ${ph(l.ids.away)} both had plenty on the line.`,
  ];
};

// ---------- finnish ----------

function linesFi(m: MatchFactsInput, l: MatchLedger): Line[] {
  const { ids } = l;
  const out: Line[] = [];
  const at = (g: Goal, i: number) => (m.goals[i].period === 4 ? `jatkoajalla ajassa ${ph(g.time)}` : `ajassa ${ph(g.time)} ${ph(g.period)}. erässä`);
  const kind = (g: Goal) => (g.kind ? ` ${ph(g.kind, "fi")}` : "");
  out.push({ text: `${ph(ids.home)} ja ${ph(ids.away)} kohtasivat ${ph(ids.dateFi ?? ids.date)}.`, keep: 1 });
  if (ids.venue) out.push({ text: `Pelipaikkana oli ${ph(ids.venue)}.`, keep: 1 });
  // 1. what was at stake
  if (ids.positionBefore && ids.chanceBefore)
    out.push({ text: `Ennen ottelua ${ph(ids.team, "ade")} oli sarjataulukossa ${ph(ids.positionBefore, "ord")} sija, ja pudotuspelipaikan todennäköisyys oli ${ph(ids.chanceBefore)} %.`, keep: 9 });
  if (ids.worthWin && ids.worthLoss)
    out.push({ text: `Voitto varsinaisella peliajalla olisi nostanut todennäköisyyden ${ph(ids.worthWin)} prosenttiin, tappio laskenut sen ${ph(ids.worthLoss)} prosenttiin.`, keep: 6 });
  // 2. how it unfolded
  m.goals.forEach((_goal, i) => {
    const g = l.goals[i];
    const who = g.scorer ? ph(g.scorer) : ph(g.team);
    const score = `${ph(g.homeScore)}–${ph(g.awayScore)}`;
    const { tied, change } = leadState(m, i);
    if (isShootout(m, i)) return out.push({ text: `${who} ratkaisi voittolaukauskilpailun ${ph(g.team, "all")}.`, keep: 8 });
    const text =
      i === 0
        ? `${who} avasi maalitilin ${ph(g.team, "all")}${kind(g)} ${at(g, i)}.`
        : tied
          ? `${who} tasoitti ${ph(g.team, "all")}${kind(g)} ${at(g, i)}, tilanne ${score}.`
          : change
            ? `${who} nosti ${ph(g.team, "all")} johdon${kind(g)} ${at(g, i)}, tilanne ${score}.`
            : `${who} teki maalin ${ph(g.team, "all")}${kind(g)} ${at(g, i)}, tilanne ${score}.`;
    out.push({ text, keep: i === 0 ? OPENER : change || tied ? 8 : 3 });
  });
  const homeWon = m.score.home > m.score.away;
  const extra = m.decidedIn === "overtime" ? " jatkoajalla" : m.decidedIn === "shootout" ? " voittolaukauskilpailun jälkeen" : "";
  const [w, x, y] = homeWon ? [ids.home, ids.homeGoals, ids.awayGoals] : [ids.away, ids.awayGoals, ids.homeGoals];
  out.push({ text: `Ottelu päättyi ${ph(w, "gen")} ${ph(x)}–${ph(y)}-voittoon${extra}.`, keep: 10 });
  // 3. the turning point
  const tp = m.turningPoint;
  if (tp && tp.before !== tp.after && ids.turnBefore && ids.turnAfter && l.goals[tp.goal]) {
    const g = l.goals[tp.goal];
    const who = g.scorer ? ph(g.scorer) : ph(g.team);
    const when = isShootout(m, tp.goal) ? "voittolaukauskilpailussa" : at(g, tp.goal);
    out.push({
      text: `Ottelun käännekohta nähtiin ${when}, kun ${who} teki maalin: ${ph(ids.team, "gen")} pudotuspelipaikan todennäköisyys muuttui ${ph(ids.turnBefore)} prosentista ${ph(ids.turnAfter)} prosenttiin.`,
      keep: TURNING_POINT,
    });
  }
  // 4. what it meant
  if (ids.positionBefore && ids.positionAfter && ids.chanceBefore && ids.chanceAfter) {
    out.push({
      text: `Tuloksen jälkeen ${ph(ids.team, "ade")} on sarjan ${ph(ids.positionAfter, "ord")} sija (ennen ${ph(ids.positionBefore, "ord")}), ja pudotuspelipaikan todennäköisyys on ${ph(ids.chanceAfter)} %, kun se ennen ottelua oli ${ph(ids.chanceBefore)} %.`,
      keep: 10,
    });
  }
  // 5. what's next
  if (ids.nextOpponent && ids.nextDateFi) {
    out.push({ text: `Seuraavaksi ${ph(ids.team, "ade")} on vastassa ${ph(ids.nextOpponent)} ${ph(ids.nextDateFi)}.`, keep: 9 });
    if (ids.nextWin && ids.nextLoss) out.push({ text: `Voitto nostaisi todennäköisyyden ${ph(ids.nextWin)} prosenttiin, tappio laskisi sen ${ph(ids.nextLoss)} prosenttiin.`, keep: 7 });
  }
  return out;
}

const FILLERS_FI = (m: MatchFactsInput, l: MatchLedger) => {
  const d = decider(m, l);
  return [
    ...(d.goal ? [`${d.goal.scorer ? ph(d.goal.scorer) : ph(d.goal.team)} teki ottelun voittomaalin ajassa ${ph(d.goal.time)}.`] : []),
    ...(d.shutout ? [`${ph(d.winner)} ei päästänyt ottelussa ainuttakaan maalia.`] : []),
    ...(d.oneGoal ? [`${ph(d.winner)} voitti tiukan ottelun.`] : []),
    `${ph(l.ids.team, "all")} jokainen piste on tärkeä pudotuspelikilvassa.`,
    `Sekä ${ph(l.ids.home, "all")} että ${ph(l.ids.away, "all")} pelissä oli paljon.`,
  ];
};

/** the summary's sentences, filled: near the target length, the lowest-priority lines dropped first */
export function summarySentences(m: MatchFactsInput, l: MatchLedger, lang: Language) {
  const lines = lang === "fi" ? linesFi(m, l) : linesEn(m, l);
  const len = (xs: Line[]) => xs.reduce((n, x) => n + fill(x.text, l.facts, lang).text.length + 1, 0);
  let chosen = [...lines];
  // too long: drop the least important lines, keeping the order
  while (len(chosen) > SUMMARY_LENGTH.max && chosen.some((x) => x.keep < 10)) {
    const drop = chosen.reduce((a, b) => (b.keep < a.keep ? b : a));
    chosen = chosen.filter((x) => x !== drop);
  }
  // too short: a line or two that only use facts we have
  for (const f of lang === "fi" ? FILLERS_FI(m, l) : FILLERS_EN(m, l)) {
    if (len(chosen) >= SUMMARY_LENGTH.min) break;
    chosen.splice(Math.max(1, chosen.length - 2), 0, { text: f, keep: 0 });
  }
  return chosen.map((x) => fill(x.text, l.facts, lang));
}

export function summaryContent(m: MatchFactsInput, l: MatchLedger, teamId: string, lang: Language): Content {
  return {
    id: `summary.${teamId}.${m.matchId}.${lang}`,
    kind: "story",
    gameId: m.matchId,
    teamId,
    language: lang,
    sentences: summarySentences(m, l, lang),
    status: "fallback",
    generatedAt: new Date().toISOString(),
  };
}
