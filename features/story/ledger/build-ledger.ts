import type { Fact, FactInputs } from "@/shared/types";

/** labels double as stable keys for the template fallback */
export const FACT_LABELS = {
  position: "league position",
  points: "points",
  gamesPlayed: "games played",
  pointsToPlayoffLine: "points to the playoff line",
  playoffChance: "playoff chance",
  top4Chance: "top-4 chance",
  relegationChance: "relegation chance",
  ifRegulationWin: "playoff chance with a regulation win",
  ifRegulationLoss: "playoff chance with a regulation loss",
  form: "form, oldest first",
  headToHeadWins: "head-to-head wins this season",
  headToHeadLosses: "head-to-head losses this season",
} as const;

const pct = (x: number) => Math.round(x * 100);

/** turns raw inputs into numbered facts. same inputs, same ids */
export function buildLedger(inputs: FactInputs): Fact[] {
  const { standings: s, chances: c, form, headToHead: h } = inputs;
  const rows: Omit<Fact, "id">[] = [
    { label: FACT_LABELS.position, value: s.position, unit: null, sourceGameIds: s.sourceGameIds },
    { label: FACT_LABELS.points, value: s.points, unit: "points", sourceGameIds: s.sourceGameIds },
    { label: FACT_LABELS.gamesPlayed, value: s.gamesPlayed, unit: "games", sourceGameIds: s.sourceGameIds },
    {
      label: FACT_LABELS.pointsToPlayoffLine,
      value: s.pointsToPlayoffLine,
      unit: "points",
      sourceGameIds: s.sourceGameIds,
    },
    { label: FACT_LABELS.playoffChance, value: pct(c.playoffs), unit: "%", sourceGameIds: c.sourceGameIds },
    { label: FACT_LABELS.top4Chance, value: pct(c.top4), unit: "%", sourceGameIds: c.sourceGameIds },
    { label: FACT_LABELS.relegationChance, value: pct(c.relegation), unit: "%", sourceGameIds: c.sourceGameIds },
    { label: FACT_LABELS.ifRegulationWin, value: pct(c.ifRegulationWin), unit: "%", sourceGameIds: c.sourceGameIds },
    {
      label: FACT_LABELS.ifRegulationLoss,
      value: pct(c.ifRegulationLoss),
      unit: "%",
      sourceGameIds: c.sourceGameIds,
    },
    { label: FACT_LABELS.form, value: form.results.join("-"), unit: null, sourceGameIds: form.sourceGameIds },
    { label: FACT_LABELS.headToHeadWins, value: h.wins, unit: null, sourceGameIds: h.sourceGameIds },
    { label: FACT_LABELS.headToHeadLosses, value: h.losses, unit: null, sourceGameIds: h.sourceGameIds },
  ];
  return rows.map((r, i) => ({ id: `F${i + 1}`, ...r }));
}
