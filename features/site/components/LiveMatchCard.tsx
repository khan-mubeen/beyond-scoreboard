import type { FeaturedMatch, TeamRef } from "@/shared/types";
import { periodScoresText } from "../format";
import { Icon } from "./Icon";
import { StakesChip } from "./StakesChip";
import { TeamLogo } from "./TeamLogo";
import { WhenLabel } from "./WhenLabel";

export function LiveBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1 text-xs font-bold text-accent-ink ${className}`}
    >
      <span aria-hidden className="size-2 rounded-full bg-accent-ink" />
      LIVE
    </span>
  );
}

function Side({ team }: { team: TeamRef }) {
  return (
    <div className="flex min-w-0 flex-col items-center text-center">
      <TeamLogo team={team} size={76} className="ring-2 ring-dark-ink/80" />
      <p className="mt-2 text-xl font-bold sm:text-2xl">{team.name}</p>
      {team.city && <p className="text-sm opacity-80">{team.city}</p>}
    </div>
  );
}

/** the big dark card for the featured live game */
export function LiveMatchCard({ featured }: { featured: FeaturedMatch }) {
  const { match } = featured;
  const live = match.status === "live";
  return (
    <article
      aria-label={`${live ? "Live" : match.status === "final" ? "Final" : match.whenLabel}: ${match.home.name} against ${match.away.name}`}
      className="relative overflow-hidden rounded-card bg-dark bg-cover bg-center text-dark-ink shadow-card"
      style={{ backgroundImage: `url(${featured.background})` }}
    >
      {/* keeps text readable once a real photo replaces the placeholder */}
      <div aria-hidden className="absolute inset-0 bg-dark/40" />
      <div className="relative p-4">
        <p className="flex items-center gap-3 text-base font-semibold">
          {live ? (
            <>
              <LiveBadge />
              {match.periodLabel} {match.clock}
            </>
          ) : (
            <span className="rounded-md bg-dark-ink/15 px-2.5 py-1 text-xs font-bold">
              {match.status === "final" ? "FINAL" : <WhenLabel match={match} />}
            </span>
          )}
        </p>
        <div className="mx-auto mt-2 grid max-w-[460px] grid-cols-[1fr_auto_1fr] items-center gap-2">
          <Side team={match.home} />
          <div className="text-center">
            <p className="text-[52px] leading-none font-bold tabular-nums sm:text-[60px]">
              {match.score ? `${match.score.home} - ${match.score.away}` : "vs"}
            </p>
            <p className="mt-2 text-sm opacity-80 tabular-nums">{periodScoresText(match.periodScores)}</p>
          </div>
          <Side team={match.away} />
        </div>

        <div className="mt-4 rounded-lg bg-dark/80 p-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
            <div>
              <h3 className="text-lg font-bold">What it means</h3>
              <p className="mt-1 text-sm opacity-90">{featured.whatItMeans}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {featured.stakes.map((s) => (
                <StakesChip key={s.team.id} chip={s} dark />
              ))}
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <a
              href={match.href}
              className="flex h-11 items-center justify-center gap-2 rounded-lg bg-accent font-semibold text-accent-ink hover:brightness-110"
            >
              <Icon name="play" className="size-4" />
              {live ? "Watch live" : "Match centre"}
            </a>
            <a
              href={match.status === "final" ? match.href : `${match.href}#call-it`}
              className="flex h-11 items-center justify-center gap-2 rounded-lg border border-dark-ink/70 font-semibold hover:bg-dark-ink/10"
            >
              <Icon name="chart" className="size-4" />
              {match.status === "final" ? "The match in 60 seconds" : live || featured.openCalls > 0 ? `Call It! · ${featured.openCalls} open` : "Calls open when the game starts"}
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}
