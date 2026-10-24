// the 60-second summary on the recorded games, in english and finnish: about a minute long,
// every sentence passes the validator, and finnish team names are inflected from the table
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { describeGoalTypes, normalizeGame, type GameDTO, type LiigaGame } from "@/features/liiga";
import { FI_TEAM_FORMS, surnameGenitive, teamCase } from "../i18n/fi-team-names";
import { buildMatchLedger, type MatchFactsInput } from "../ledger/match-ledger";
import { SUMMARY_LENGTH, summarySentences } from "../templates/summary";
import { checkSentence } from "../validator/validator";
import { fill } from "../writer/fill";

const DIR = new URL("../../liiga/snapshots/", import.meta.url);
const games: LiigaGame[] = readdirSync(DIR)
  .filter((f) => /^games_\d+_\d+\.json$/.test(f))
  .map((f) => normalizeGame((JSON.parse(readFileSync(new URL(f, DIR), "utf8")) as { game: GameDTO }).game))
  .filter((g) => g.status === "final");

const clock = (t: number, p: number) => {
  const s = Math.max(0, t - (Math.min(p, 4) - 1) * 1200);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/** the facts the site would pass, with stand-in chances (the engine's numbers vary by data) */
function factsOf(g: LiigaGame): MatchFactsInput {
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
    goals: g.goals.map((x) => ({
      scorer: x.scorer,
      team: g[x.side].name,
      period: Math.min(x.period, 5),
      time: clock(x.gameTime, x.period),
      homeScore: x.homeScore,
      awayScore: x.awayScore,
      kind: describeGoalTypes(x.types).labels[0] ?? null,
    })),
    chanceBefore: 61,
    chanceAfter: 72,
    positionBefore: 9,
    positionAfter: 7,
    worth: { win: 74, loss: 52 },
    turningPoint: { goal: g.goals.length - 1, before: 58, after: 72 },
    next: { opponent: g.away.name === "Kärpät" ? "Tappara" : "Kärpät", date: "Friday 23 October 2026", dateFi: "23.10.2026", win: 78, loss: 65 },
    sourceGameIds: [g.id],
  };
}

describe("finnish team names", () => {
  it("has all ten cases for all 17 liiga teams", () => {
    expect(Object.keys(FI_TEAM_FORMS)).toHaveLength(17);
    for (const forms of Object.values(FI_TEAM_FORMS)) expect(Object.values(forms).every((f) => f.length > 1)).toBe(true);
  });

  it("inflects in real sentences", () => {
    const ledger = [
      { id: "F1", label: "home team", value: "Kärpät", unit: null, sourceGameIds: [] },
      { id: "F2", label: "away team", value: "HIFK", unit: null, sourceGameIds: [] },
      { id: "F3", label: "home goals", value: 3, unit: null, sourceGameIds: [] },
      { id: "F4", label: "away goals", value: 2, unit: null, sourceGameIds: [] },
      { id: "F5", label: "goal 1 scorer", value: "Mikko Virtanen", unit: null, sourceGameIds: [] },
    ];
    const cases: [string, string][] = [
      ["Ottelu päättyi {F1:gen} {F3}–{F4}-voittoon.", "Ottelu päättyi Kärppien 3–2-voittoon."],
      ["{F5} avasi maalitilin {F2:all}.", "Mikko Virtanen avasi maalitilin HIFK:lle."],
      ["Seuraavaksi {F1:ade} on vastassa {F2}.", "Seuraavaksi Kärpillä on vastassa HIFK."],
      ["Voitto nosti {F1:gen} todennäköisyyttä.", "Voitto nosti Kärppien todennäköisyyttä."],
    ];
    for (const [t, want] of cases) {
      const s = fill(t, ledger, "fi");
      expect(s.text).toBe(want);
      expect(checkSentence(s, ledger), want).toBeNull();
    }
    // a form the model writes itself is accepted when it is a listed form, or a surname's genitive
    for (const text of ["Kärpistä tuli voittaja, HIFK:n tappio.", "Virtasen maali ratkaisi, Kärppien ilta."]) {
      expect(checkSentence({ text, factIds: ["F1", "F2", "F5"] }, ledger)).toBeNull();
    }
    expect(checkSentence({ text: "Maalin teki Selänne, Kärppien ilta.", factIds: ["F1"] }, ledger)?.errorType).toBe("unknown_name");
    expect([teamCase("TPS", "par"), teamCase("JYP", "ill"), teamCase("Ässät", "ine"), surnameGenitive("Granlund"), surnameGenitive("Aaltonen")]).toEqual([
      "TPS:ää",
      "JYP:hen",
      "Ässissä",
      "Granlundin",
      "Aaltosen",
    ]);
  });
});

describe("60-second summary", () => {
  it.each(games.flatMap((g) => (["en", "fi"] as const).map((lang) => [g.id, lang, g] as const)))("%s %s: about a minute long, every sentence verified", (_id, lang, g) => {
    const m = factsOf(g);
    const ledger = buildMatchLedger(m);
    const sentences = summarySentences(m, ledger, lang);
    const text = sentences.map((s) => s.text).join(" ");
    expect(text.length, text).toBeGreaterThanOrEqual(SUMMARY_LENGTH.min - 60);
    expect(text.length, text).toBeLessThanOrEqual(SUMMARY_LENGTH.max + 60);
    for (const s of sentences) expect(checkSentence(s, ledger.facts), s.text).toBeNull();
    // all five parts: stakes, the goals, the turning point, what it meant, what's next
    const parts = lang === "fi" ? ["todennäköisyys oli", "maalitilin", "käännekohta", "Tuloksen jälkeen", "Seuraavaksi"] : ["came in", "opened the scoring", "turning point", "playoff chance", "Next up"];
    for (const p of parts) expect(text, p).toContain(p);
  });
});
