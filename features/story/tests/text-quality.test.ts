// text quality: "a"/"an" by sound in every generated english sentence, and no text says the same
// thing twice (a cited claim, a before/after pair, a near copy), in the validator and the templates
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeGame, type GameDTO, type LiigaGame } from "@/features/liiga";
import { aOrAn, fixArticles, takesAn } from "@/shared/copy/articles";
import { mockContent } from "@/shared/mock";
import type { Content, ContentSentence, Fact } from "@/shared/types";
import { buildMatchLedger, type MatchFactsInput } from "../ledger/match-ledger";
import { templateContent } from "../templates/match";
import { summaryContent } from "../templates/summary";
import { verify } from "../validator/validator";
import { fill } from "../writer/fill";

describe("a / an", () => {
  it("goes by the sound, not the letter", () => {
    expect(["overtime", "empty-net", "hour", "honest", "8th", "11th", "18-game", "80%", "NHL", "MVP", "SM-liiga", "eight"].every(takesAn)).toBe(true);
    expect(["power-play", "one-goal", "university", "European", "user", "1st", "7th", "100th", "KHL", "Tappara", "huge", "unit"].some(takesAn)).toBe(false);
    expect(aOrAn("overtime")).toBe("an");
    expect(aOrAn("Overtime", true)).toBe("An");
  });

  it("fixes the article in a sentence, keeps the case and leaves other words alone", () => {
    expect(fixArticles("It was a overtime win and an power-play goal.")).toBe("It was an overtime win and a power-play goal.");
    expect(fixArticles("A empty-net goal sealed an 3–1 win.")).toBe("An empty-net goal sealed a 3–1 win.");
    expect(fixArticles("Tappara took an 8th straight win, a 11-game run.")).toBe("Tappara took an 8th straight win, an 11-game run.");
    expect(fixArticles("Kärpät are a team. Ilves an Ässät")).toBe("Kärpät are a team. Ilves an Ässät");
  });

  it("the writer applies it to english, never to finnish", () => {
    const ledger: Fact[] = [{ id: "F1", label: "goal kind", value: "overtime", unit: null, sourceGameIds: [] }];
    expect(fill("It was a {F1} winner.", ledger, "en").text).toBe("It was an overtime winner.");
    expect(fill("Se oli a {F1}.", ledger, "fi").text).toBe("Se oli a overtime.");
  });
});

const L: Fact[] = [
  { id: "F1", label: "home team", value: "Kärpät", unit: null, sourceGameIds: [] },
  { id: "F2", label: "playoff chance before", value: 85, unit: "%", sourceGameIds: [] },
  { id: "F3", label: "playoff chance after", value: 88, unit: "%", sourceGameIds: [] },
  { id: "F4", label: "league position after", value: 4, unit: null, sourceGameIds: [] },
  { id: "F5", label: "turning point before", value: 85, unit: "%", sourceGameIds: [] },
  { id: "F6", label: "turning point after", value: 88, unit: "%", sourceGameIds: [] },
];
const text = (sentences: ContentSentence[]): Content => ({ ...mockContent.story, sentences });
const errors = (sentences: ContentSentence[]) => verify(text(sentences), L).claims.map((c) => c.errorType ?? null);

describe("no repeated facts", () => {
  it("a cited chance or position is stated once", () => {
    expect(errors([fill("{F1} sit {F4:ord} with a {F3}% playoff chance.", L, "en"), fill("The playoff chance is {F3}% now.", L, "en")])).toEqual([null, "repeated_fact"]);
  });

  it("the same before/after change is stated once, whatever facts carry it", () => {
    expect(errors([fill("{F1} went from {F2}% to {F3}%.", L, "en"), fill("The big goal took it from {F5}% to {F6}%.", L, "en")])).toEqual([null, "repeated_fact"]);
  });

  it("a near copy of an earlier sentence is blocked; different sentences pass", () => {
    const a = fill("{F1} won a tight game at home in front of a loud crowd tonight.", L, "en");
    expect(errors([a, fill("{F1} won a tight game at home in front of a loud crowd.", L, "en")])).toEqual([null, "repeated_fact"]);
    expect(errors([fill("{F1} won at home.", L, "en"), fill("They are {F4:ord} now.", L, "en")])).toEqual([null, null]);
  });
});

// the templates on every recorded game, both languages: the whole text passes, repeats included
const DIR = new URL("../../liiga/snapshots/", import.meta.url);
const games: LiigaGame[] = readdirSync(DIR)
  .filter((f) => /^games_\d+_\d+\.json$/.test(f))
  .map((f) => normalizeGame((JSON.parse(readFileSync(new URL(f, DIR), "utf8")) as { game: GameDTO }).game))
  .filter((g) => g.status === "final" && g.goals.length > 0)
  .slice(0, 12);

function factsOf(g: LiigaGame, whole: boolean): MatchFactsInput {
  return {
    matchId: g.id,
    home: g.home.name,
    away: g.away.name,
    team: g.home.name,
    score: { home: g.home.goals, away: g.away.goals },
    decidedIn: g.decidedIn,
    venue: g.rink,
    date: "Tuesday 20 October 2026",
    dateFi: "20.10.2026",
    goals: g.goals.map((x) => ({ scorer: x.scorer, team: g[x.side].name, period: Math.min(x.period, 5), time: "10:00", homeScore: x.homeScore, awayScore: x.awayScore, kind: null })),
    chanceBefore: 61,
    chanceAfter: 72,
    positionBefore: 9,
    positionAfter: 9,
    worth: { win: 74, loss: 52 },
    // whole: the turning point moved the chance all the way (the repeat the templates must avoid)
    turningPoint: { goal: g.goals.length - 1, before: whole ? 61 : 58, after: 72 },
    next: { opponent: "Tappara", date: "Friday 23 October 2026", dateFi: "23.10.2026", win: 78, loss: 65 },
    sourceGameIds: [g.id],
  };
}

describe("templates never repeat a fact", () => {
  it.each(games.flatMap((g) => [true, false].map((whole) => [g.id, whole, g] as const)))("%s (turning point is the whole change: %s)", (_id, whole, g) => {
    const m = factsOf(g, whole);
    const ledger = buildMatchLedger(m);
    for (const lang of ["en", "fi"] as const) {
      const summary = summaryContent(m, ledger, "team", lang);
      const r = verify(summary, ledger.facts);
      expect(r.blockedCount, summary.sentences.map((s) => s.text).join(" ")).toBe(0);
      if (lang === "en") for (const s of summary.sentences) expect(s.text).toBe(fixArticles(s.text));
    }
    const story = templateContent("story", m, ledger, "team", "en");
    expect(verify(story, ledger.facts).blockedCount, story.sentences.map((s) => s.text).join(" ")).toBe(0);
  });
});
