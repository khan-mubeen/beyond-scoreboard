import type { ComingSoonCard, MatchSummary, TeamRef } from "@/shared/types";
import { Icon } from "./Icon";
import { ChangeTag } from "./StakesChip";
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
          <span className="flex items-center gap-2 font-medium text-live">
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

/** "88% ▲3": the playoff chance after the game and how far it moved */
function ChanceMove({ team, now, change }: { team: TeamRef; now: number; change: number }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-xs">
      <TeamLogo team={team} size={18} />
      <span className="sr-only">{team.name} playoff chance</span>
      <span className="font-semibold tabular-nums">{now}%</span>
      <ChangeTag change={change} className="font-bold" />
    </span>
  );
}

/** a result: the score, both teams' playoff chance after it (and how far it moved), the winner's next game */
function RecentCard({ match }: { match: MatchSummary }) {
  const homeWon = (match.score?.home ?? 0) > (match.score?.away ?? 0);
  return (
    <article className={`${cardCls} flex flex-col gap-3 p-0`}>
      <a
        href={match.href}
        className="grid items-center gap-3 px-4 pt-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
        aria-label={`Result: ${match.home.name} ${match.score?.home}, ${match.away.name} ${match.score?.away}`}
      >
        <div className="flex flex-col gap-1.5">
          <span className="flex items-center justify-between gap-2 text-sm text-muted">
            <WhenLabel match={match} />
            <Pill>{match.league}</Pill>
          </span>
          <span className="flex items-center gap-2">
            <TeamLogo team={match.home} size={30} />
            <span className={`min-w-0 flex-1 truncate ${homeWon ? "font-bold" : "font-semibold text-muted"}`}>{match.home.name}</span>
            <span className={`text-2xl tabular-nums ${homeWon ? "font-black" : "font-bold text-muted"}`}>{match.score?.home}</span>
          </span>
          <span className="flex items-center gap-2">
            <TeamLogo team={match.away} size={30} />
            <span className={`min-w-0 flex-1 truncate ${!homeWon ? "font-bold" : "font-semibold text-muted"}`}>{match.away.name}</span>
            <span className={`text-2xl tabular-nums ${!homeWon ? "font-black" : "font-bold text-muted"}`}>{match.score?.away}</span>
          </span>
        </div>
        <div className="flex flex-col gap-1.5 sm:border-l sm:border-line sm:pl-4">
          {match.swing ? (
            <>
              <span className="text-[11px] font-semibold tracking-wider text-muted uppercase">Playoff chance after</span>
              <ChanceMove team={match.home} {...match.swing.home} />
              <ChanceMove team={match.away} {...match.swing.away} />
            </>
          ) : (
            match.note && <p className="text-sm text-muted">{match.note}</p>
          )}
        </div>
      </a>
      {match.teaser ? (
        <a href={match.teaser.href} className="flex items-center justify-between gap-2 border-t border-line px-4 py-2.5 text-sm font-semibold text-accent hover:bg-accent-soft">
          <span className="truncate">{match.teaser.text}</span>
          <Icon name="arrowRight" className="size-4 shrink-0" />
        </a>
      ) : (
        <span className="pb-1" />
      )}
    </article>
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
