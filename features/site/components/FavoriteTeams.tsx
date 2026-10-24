import type { FavoriteTeam } from "@/shared/types";
import { Icon } from "./Icon";
import { Pill } from "./SectionCard";
import { TeamLogo } from "./TeamLogo";

/** the fan's teams. compact is the one-line rewards sidebar version */
export function FavoriteTeams({ teams, compact = false }: { teams: FavoriteTeam[]; compact?: boolean }) {
  if (compact) {
    return (
      <section aria-labelledby="fav-title" className="px-3">
        <h2 id="fav-title" className="text-[15px] font-semibold">
          My Favorite Teams
        </h2>
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          {teams
            .filter((f) => !f.comingSoon)
            .map((f) => (
              <li key={f.team.id} className="flex items-center gap-1.5">
                {f.starred && <Icon name="star" className="size-3.5" label="Favourite" />}
                {f.team.name} <span className="text-muted">· {f.league}</span>
              </li>
            ))}
        </ul>
      </section>
    );
  }

  return (
    <section aria-labelledby="fav-title" className="rounded-card border border-line bg-surface p-4 shadow-card">
      <h2 id="fav-title" className="text-[15px] font-semibold">
        My Favorite Teams
      </h2>
      <ul className="mt-3 flex flex-col gap-3.5">
        {teams.map((f) => (
          <li key={f.team.id} className={`flex items-center gap-3 ${f.comingSoon ? "opacity-60 grayscale" : ""}`}>
            <TeamLogo team={f.team} size={40} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className={`text-[15px] ${f.comingSoon ? "text-muted" : "font-semibold"}`}>{f.team.name}</span>
                {f.comingSoon && <Pill className="py-0.5 text-[10px] font-medium">Coming soon</Pill>}
              </div>
              {!f.comingSoon && <p className="text-sm text-muted">{f.league}</p>}
            </div>
            {f.starred && <Icon name="star" className="size-5 text-accent" label="Favourite team" />}
          </li>
        ))}
      </ul>
    </section>
  );
}
