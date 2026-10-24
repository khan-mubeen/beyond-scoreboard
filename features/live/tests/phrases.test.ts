// call wordings: the built-ins pass, and a stored wording that could read wrong never goes live
import { describe, expect, it } from "vitest";
import { BUILT_IN, fillPhrase, phraseProblem, wordCall } from "../engine/phrases";
import type { CallKind } from "../engine/rules";

const vars = { home: "Kärpät", away: "Tappara", team: "Kärpät", period: "2" };

describe("call wordings", () => {
  it("passes every built-in, in both languages", () => {
    for (const [kind, byLang] of Object.entries(BUILT_IN) as [CallKind, Record<string, string>][]) {
      for (const t of Object.values(byLang)) expect(phraseProblem(kind, t)).toBeNull();
    }
  });

  it.each([
    ["first_goal_period", "Who strikes first in {period}?", "{period} needs its word"],
    ["first_goal_period", "Who scores first in period {quarter}?", "unknown placeholder {quarter}"],
    ["power_play", "Will they score on this power play?", "must name {team}"],
    ["who_wins", "Who wins tonight", "not a question"],
    ["who_wins", "Who is the favourite with the bookies?", "betting language"],
    ["overtime", "Will this go to overtime after 2 more goals?", "types a number"],
    // real llm output that passed the first version of these rules
    ["answer_back", "Will {team} answer within minutes?", "must say 5 minutes"],
    ["answer_back", "Can {team} answer in the next shift?", "must say 5 minutes"],
    ["answer_back", "Will {team} answer within 3 minutes?", "types a number"],
    ["overtime", "Kumpi etenee jatkoajalle: {home} vai {away}?", "not a yes/no question"],
    ["first_goal_period", "Kuka iskee {period}. erän avausmaalin kotijoukkue {home}:lle?", "inflected placeholder"],
    ["answer_back", "Tuleeko {team}:n reaktio viiden minuutin sisällä?", "inflected placeholder"],
    ["power_play", "Will {team} get a tally while they have the extra attacker?", "loses its subject"],
    ["overtime", "Can {home} and {away} force another period?", "loses its subject"],
  ] as const)("%s: rejects %j", (kind, template, problem) => {
    expect(phraseProblem(kind, template)).toBe(problem);
  });

  it.each([
    ["answer_back", "Will {team} strike back within 5 minutes?"],
    ["answer_back", "Pystyykö {team} vastaamaan viiden minuutin kuluessa?"],
    ["overtime", "{home} ja {away}: mennäänkö jatkoajalle?"],
    ["first_goal_period", "Which team opens the scoring in period {period}?"],
  ] as const)("%s: keeps %j", (kind, template) => {
    expect(phraseProblem(kind, template)).toBeNull();
  });

  it("uses an approved wording, filled, and falls back to the built-in", () => {
    expect(wordCall("power_play", vars, ["Can {team} make this power play count?"], "en", () => 0)).toBe("Can Kärpät make this power play count?");
    expect(wordCall("first_goal_period", vars, ["Who strikes first in {period}?"], "en")).toBe(fillPhrase(BUILT_IN.first_goal_period.en, vars));
    expect(wordCall("first_goal_period", vars, [], "fi")).toBe("Kuka tekee 2. erän ensimmäisen maalin?");
  });
});
