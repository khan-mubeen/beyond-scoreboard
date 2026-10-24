import type { FavoriteTeam } from "@/shared/types";
import { teamHref } from "../format";
import { Icon } from "./Icon";
import { Pill } from "./SectionCard";
import { TeamLogo } from "./TeamLogo";

function Title({ compact }: { compact: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 id="fav-title" className="text-[15px] font-semibold">
        My Favorite Teams
      </h2>
      <a href="/teams" className={`text-xs font-semibold text-accent hover:underline ${compact ? "" : "rounded-md px-1.5 py-0.5"}`}>
        Manage
      </a>
    </div>
  );
}

/** the fan's teams, with "Manage" to pick them on /teams. compact is the one-line rewards sidebar version */
export function FavoriteTeams({ teams, compact = false }: { teams: FavoriteTeam[]; compact?: boolean }) {
  const followed = teams.filter((f) => !f.comingSoon);
  if (compact) {
    return (
      <section aria-labelledby="fav-title" className="px-3">
        <Title compact />
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          {followed.length === 0 && <li className="text-muted">No teams yet</li>}
          {followed.map((f) => (
            <li key={f.team.id} className="flex items-center gap-1.5">
              {f.starred && <Icon name="star" className="size-3.5" label="Favourite" />}
              <a href={teamHref(f.team.id)} className="hover:underline">
                {f.team.name}
              </a>
              <span className="text-muted">· {f.league}</span>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <section aria-labelledby="fav-title" className="rounded-card border border-line bg-surface p-4 shadow-card">
      <Title compact={false} />
      <ul className="mt-3 flex flex-col gap-3.5">
        {followed.length === 0 && (
          <li className="text-sm text-muted">
            Follow a team to see its games first. <a href="/teams" className="font-semibold text-accent hover:underline">Pick teams</a>
          </li>
        )}
        {teams.map((f) => (
          <li key={f.team.id} className={`flex items-center gap-3 ${f.comingSoon ? "opacity-60 grayscale" : ""}`}>
            <TeamLogo team={f.team} size={40} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {f.comingSoon ? (
                  <span className="text-[15px] text-muted">{f.team.name}</span>
                ) : (
                  <a href={teamHref(f.team.id)} className="text-[15px] font-semibold hover:underline">
                    {f.team.name}
                  </a>
                )}
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
