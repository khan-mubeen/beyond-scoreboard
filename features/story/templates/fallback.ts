import { teamById } from "@/shared/mock";
import type { Content, Fact } from "@/shared/types";
import { type ContentMeta, contentId } from "../content-id";
import { FACT_LABELS } from "../ledger/build-ledger";
import { fill } from "../writer/fill";

type Key = keyof typeof FACT_LABELS;
type Line = { needs: Key[]; en: string; fi: string };

// {position} etc. become {F1} placeholders, then fill() puts the values in
const BRIEF: Line[] = [
  {
    needs: ["position", "points", "gamesPlayed"],
    en: "{team} sit {position:ord} with {points} points from {gamesPlayed} games.",
    fi: "{team} on sijalla {position}, {points} pistettä {gamesPlayed} ottelusta.",
  },
  {
    needs: ["pointsToPlayoffLine"],
    en: "They are {pointsToPlayoffLine} points from the playoff line.",
    fi: "Pudotuspeliviivalle on matkaa {pointsToPlayoffLine} pistettä.",
  },
  {
    needs: ["playoffChance"],
    en: "Their playoff chance is {playoffChance}% before puck drop.",
    fi: "Mahdollisuus pudotuspeleihin on ennen ottelua {playoffChance} %.",
  },
  {
    needs: ["ifRegulationWin", "ifRegulationLoss"],
    en: "A regulation win would take it to {ifRegulationWin}%, a regulation loss to {ifRegulationLoss}%.",
    fi: "Voitto varsinaisella peliajalla nostaisi sen {ifRegulationWin} prosenttiin, tappio laskisi {ifRegulationLoss} prosenttiin.",
  },
  {
    needs: ["form"],
    en: "Form over the last five, oldest first: {form}.",
    fi: "Viiden viime ottelun vire vanhimmasta alkaen: {form}.",
  },
];

/**
 * the deterministic writer used when the llm is off or its text was blocked.
 * only uses facts from the ledger. todo: a real post-game story template, fi copy review
 */
export function fallbackContent(meta: ContentMeta, ledger: Fact[]): Content {
  const team = teamById(meta.teamId).name;
  const idOf = (key: Key) => ledger.find((f) => f.label === FACT_LABELS[key])?.id;

  const templates =
    meta.kind === "brief"
      ? BRIEF.filter((l) => l.needs.every(idOf)).map((l) =>
          l[meta.language].replace(/\{(\w+)(:ord)?\}/g, (whole, key: string, ord = "") =>
            key === "team" ? team : key in FACT_LABELS ? `{${idOf(key as Key)}${ord}}` : whole,
          ),
        )
      : ledger.map((f) => `${f.label}: {${f.id}}${f.unit === "%" ? "%" : f.unit ? ` ${f.unit}` : ""}.`);

  return {
    id: contentId(meta),
    kind: meta.kind,
    gameId: meta.gameId,
    teamId: meta.teamId,
    language: meta.language,
    sentences: templates.map((t) => fill(t, ledger)),
    status: "fallback",
    generatedAt: new Date().toISOString(),
  };
}
