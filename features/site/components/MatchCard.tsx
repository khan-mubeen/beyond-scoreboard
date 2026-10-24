import type { ComingSoonCard, MatchSummary, TeamRef } from "@/shared/types";
import { Icon } from "./Icon";
import { LiveBadge } from "./LiveMatchCard";
import { Pill } from "./SectionCard";
import { TeamLogo } from "./TeamLogo";
import { WhenLabel } from "./WhenLabel";

const cardCls =
  "block rounded-card border border-line bg-surface p-4 shadow-card transition-colors hover:border-muted/40 focus-visible:border-accent";

function TeamRow({ team, score }: { team: TeamRef; score?: number }) {
  return (
    <div className="flex items-center gap-3">
      <TeamLogo team={team} size={28} />
      <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{team.name}</span>
      {score !== undefined && <span className="text-lg font-bold tabular-nums">{score}</span>}
    </div>
  );
}

/** a match in the home lists. variant follows the match status */
export function MatchCard({ match }: { match: MatchSummary }) {
  if (match.status === "final") return <RecentCard match={match} />;
  const live = match.status === "live";
  return (
    <a
      href={match.href}
      className={cardCls}
      aria-label={`${match.home.name} against ${match.away.name}, ${match.whenLabel}`}
    >
      <div className="flex items-center justify-between gap-2 text-sm">
        {live ? (
          <span className="flex items-center gap-2 font-medium text-accent">
            <LiveBadge className="px-2 py-0.5 text-[11px]" />
            {match.periodLabel} {match.clock}
          </span>
        ) : (
          <span className="text-muted"><WhenLabel match={match} /></span>
        )}
        <Pill>{match.league}</Pill>
      </div>
      <div className={`mt-3 grid gap-4 ${match.note ? "sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]" : ""}`}>
        <div className="flex flex-col gap-2.5">
          <TeamRow team={match.home} score={match.score?.home} />
          <TeamRow team={match.away} score={match.score?.away} />
        </div>
        {match.note && <p className="text-sm text-muted sm:border-l sm:border-line sm:pl-4">{match.note}</p>}
      </div>
    </a>
  );
}

function RecentCard({ match }: { match: MatchSummary }) {
  return (
    <a
      href={match.href}
      className={`${cardCls} grid items-center gap-3 sm:grid-cols-[auto_1fr_auto_1.2fr]`}
      aria-label={`Result: ${match.home.name} ${match.score?.home}, ${match.away.name} ${match.score?.away}`}
    >
      <span className="text-sm text-muted"><WhenLabel match={match} /></span>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <TeamLogo team={match.home} size={30} />
        <span className="font-semibold">{match.home.name}</span>
        <span className="text-lg font-bold tabular-nums">{match.score?.home}</span>
        <span className="text-muted">–</span>
        <span className="text-lg font-bold tabular-nums">{match.score?.away}</span>
        <TeamLogo team={match.away} size={30} />
        <span className="font-semibold">{match.away.name}</span>
      </div>
      <Pill className="justify-self-start">{match.league}</Pill>
      {match.note && <p className="text-sm text-muted">{match.note}</p>}
    </a>
  );
}

/** a sport we don't cover yet */
export function ComingSoonMatchCard({ card }: { card: ComingSoonCard }) {
  return (
    <div className="flex items-start gap-3 rounded-card border border-line bg-surface-2 p-4 text-muted">
      <span className="grid size-10 place-items-center rounded-full border-2 border-muted/60">
        <Icon name="grid" className="size-5" />
      </span>
      <div className="flex-1">
        <p className="font-semibold text-ink">{card.title}</p>
        <Pill className="mt-2 bg-surface">Coming soon</Pill>
      </div>
      <Pill className="bg-surface">{card.league}</Pill>
    </div>
  );
}
