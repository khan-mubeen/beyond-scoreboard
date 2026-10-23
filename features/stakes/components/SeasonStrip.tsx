import type { FormResult, Game } from "@/shared/types";
import { teamById } from "@/shared/mock";

const RESULT_STYLE: Record<FormResult, string> = {
  W: "bg-good text-bg",
  OTW: "bg-good/60 text-bg",
  OTL: "bg-bad/60 text-bg",
  L: "bg-bad text-bg",
};

function resultFor(teamId: string, g: Game): FormResult | null {
  if (g.status !== "final" || !g.decidedIn) return null;
  const isHome = g.homeTeamId === teamId;
  const won = isHome ? g.score.home > g.score.away : g.score.away > g.score.home;
  const ot = g.decidedIn !== "regulation";
  return won ? (ot ? "OTW" : "W") : ot ? "OTL" : "L";
}

/** a team's season as a row of chips: results so far, then remaining fixtures */
export function SeasonStrip({
  teamId,
  games,
  currentGameId,
}: {
  teamId: string;
  games: Game[];
  currentGameId?: string;
}) {
  const mine = games
    .filter((g) => g.homeTeamId === teamId || g.awayTeamId === teamId)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (mine.length === 0)
    return <p className="text-sm text-muted">No games for {teamById(teamId).name} in the mock data.</p>;

  return (
    <ol className="flex flex-wrap gap-1.5">
      {mine.map((g) => {
        const result = resultFor(teamId, g);
        const opp = teamById(g.homeTeamId === teamId ? g.awayTeamId : g.homeTeamId);
        const current = g.id === currentGameId;
        return (
          <li
            key={g.id}
            title={`${g.date.slice(0, 10)} vs ${opp.name}${result ? ` (${g.score.home}-${g.score.away})` : ""}`}
            className={`flex h-10 w-12 flex-col items-center justify-center rounded-md text-[10px] font-semibold ${
              result ? RESULT_STYLE[result] : "border border-dashed border-line text-muted"
            } ${current ? "ring-2 ring-accent" : ""}`}
          >
            <span>{opp.shortName}</span>
            <span>{result ?? (current ? "now" : "–")}</span>
          </li>
        );
      })}
    </ol>
  );
}
