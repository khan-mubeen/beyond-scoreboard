import type { LineupPlayer, TeamRef } from "@/shared/types";
import { SectionCard } from "./SectionCard";
import { TeamLogo } from "./TeamLogo";

const ROLE: Record<string, string> = {
  GOALIE: "G",
  LEFT_DEFENSEMAN: "D",
  RIGHT_DEFENSEMAN: "D",
  DEFENSEMAN: "D",
  SEVENTH_DEFENSEMAN: "D",
  EIGHTH_DEFENSEMAN: "D",
  LEFT_WING: "LW",
  RIGHT_WING: "RW",
  CENTER: "C",
};
const roleOf = (r: string | null) => (r ? (ROLE[r] ?? "F") : "");

function Side({ team, players }: { team: TeamRef; players: LineupPlayer[] }) {
  return (
    <div className="min-w-0">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <TeamLogo team={team} size={22} />
        {team.name}
      </h3>
      <ol className="grid grid-cols-1 gap-y-1 text-sm sm:grid-cols-2 sm:gap-x-4">
        {players.map((p, i) => (
          <li key={`${p.jersey}-${p.name}-${i}`} className="flex items-center gap-2">
            <span className="w-7 text-right font-semibold tabular-nums text-muted">{p.jersey ?? "–"}</span>
            <span className="min-w-0 flex-1 truncate">{p.name}</span>
            <span className="w-7 text-xs text-muted">{roleOf(p.role)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** both teams' players from the match feed: jersey, name, role */
export function Lineups({ home, away, lineups }: { home: TeamRef; away: TeamRef; lineups: { home: LineupPlayer[]; away: LineupPlayer[] } | null | undefined }) {
  return (
    <SectionCard title="Lineups" action={<span className="text-xs text-muted">Liiga feed</span>}>
      {lineups ? (
        <div className="grid gap-6 md:grid-cols-2">
          <Side team={home} players={lineups.home} />
          <Side team={away} players={lineups.away} />
        </div>
      ) : (
        <p className="text-sm text-muted">Lineups appear here when the match feed supplies them.</p>
      )}
    </SectionCard>
  );
}
