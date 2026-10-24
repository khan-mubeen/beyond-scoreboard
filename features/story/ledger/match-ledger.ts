// pure: the fact ledger for one match, from the liiga data and the stakes engine.
// every number or name a match text may use comes from here, cited by id
import type { Fact } from "@/shared/types";

export interface MatchGoalFact {
  scorer: string | null;
  team: string;
  /** 1-3, 4 = overtime */
  period: number;
  /** "11:40" in the period */
  time: string;
  homeScore: number;
  awayScore: number;
  /** "power play" etc, null for even strength */
  kind: string | null;
}

export interface MatchFactsInput {
  matchId: string;
  home: string;
  away: string;
  /** the team the texts are written for */
  team: string;
  score: { home: number; away: number };
  decidedIn: "regulation" | "overtime" | "shootout" | null;
  venue: string | null;
  /** "Saturday 24 October 2026" */
  date: string;
  goals: MatchGoalFact[];
  /** playoff chance in % for `team` */
  chanceBefore: number | null;
  chanceAfter: number | null;
  positionBefore: number | null;
  positionAfter: number | null;
  sourceGameIds: string[];
}

export type MatchFactKey =
  | "home"
  | "away"
  | "team"
  | "homeGoals"
  | "awayGoals"
  | "venue"
  | "date"
  | "chanceBefore"
  | "chanceAfter"
  | "positionBefore"
  | "positionAfter";

export interface MatchLedger {
  facts: Fact[];
  /** fact id per key, missing when the fact isn't known */
  ids: Partial<Record<MatchFactKey, string>>;
  /** fact ids per goal: scorer, team, period, time, score */
  goals: { scorer?: string; team: string; period: string; time: string; homeScore: string; awayScore: string; kind?: string }[];
}

export function buildMatchLedger(m: MatchFactsInput): MatchLedger {
  const facts: Fact[] = [];
  const add = (label: string, value: string | number, unit: string | null = null) => {
    const id = `F${facts.length + 1}`;
    facts.push({ id, label, value, unit, sourceGameIds: m.sourceGameIds });
    return id;
  };
  const ids: MatchLedger["ids"] = {
    home: add("home team", m.home),
    away: add("away team", m.away),
    team: add("team", m.team),
    homeGoals: add(`${m.home} goals`, m.score.home),
    awayGoals: add(`${m.away} goals`, m.score.away),
    date: add("date", m.date),
  };
  if (m.venue) ids.venue = add("venue", m.venue);
  if (m.chanceBefore !== null) ids.chanceBefore = add(`${m.team} playoff chance before the game`, m.chanceBefore, "%");
  if (m.chanceAfter !== null) ids.chanceAfter = add(`${m.team} playoff chance after the game`, m.chanceAfter, "%");
  if (m.positionBefore !== null) ids.positionBefore = add(`${m.team} league position before the game`, m.positionBefore);
  if (m.positionAfter !== null) ids.positionAfter = add(`${m.team} league position after the game`, m.positionAfter);

  const goals = m.goals.map((g, i) => ({
    ...(g.scorer && { scorer: add(`goal ${i + 1} scorer`, g.scorer) }),
    team: add(`goal ${i + 1} team`, g.team),
    period: add(`goal ${i + 1} period`, g.period),
    time: add(`goal ${i + 1} time in the period`, g.time),
    homeScore: add(`${m.home} goals after goal ${i + 1}`, g.homeScore),
    awayScore: add(`${m.away} goals after goal ${i + 1}`, g.awayScore),
    ...(g.kind && { kind: add(`goal ${i + 1} type`, g.kind) }),
  }));
  return { facts, ids, goals };
}
