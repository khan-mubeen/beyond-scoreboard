import type { MatchSummary, TeamRef } from "@/shared/types";
import { fmtInt, periodScoresText } from "../format";
import { LiveBadge } from "./LiveMatchCard";
import { TeamLogo } from "./TeamLogo";

function Team({ team, align }: { team: TeamRef; align: "left" | "right" }) {
  return (
    <div
      className={`flex min-w-0 flex-col items-center gap-2 text-center md:gap-3 ${
        align === "right" ? "md:flex-row-reverse md:text-right" : "md:flex-row md:text-left"
      }`}
    >
      <TeamLogo team={team} size={60} />
      <div className="min-w-0">
        <p className="truncate text-lg font-bold md:text-xl">{team.name}</p>
        {team.city && <p className="text-xs text-muted">{team.city}</p>}
      </div>
    </div>
  );
}

/** teams, score, period scores and match facts at the top of a match page */
export function ScoreHeader({
  match,
  venue,
  dateLabel,
  spectators,
}: {
  match: MatchSummary;
  venue: string;
  dateLabel: string;
  spectators: number;
}) {
  const live = match.status === "live";
  return (
    <section
      aria-label="Score"
      className="rounded-card border border-line bg-gradient-to-r from-surface from-60% to-accent-soft p-5 shadow-card md:px-6"
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <Team team={match.home} align="left" />
        <div className="text-center">
          <p className="flex items-center justify-center gap-2 text-sm font-semibold">
            {live ? (
              <LiveBadge />
            ) : (
              <span className="rounded-md bg-surface-2 px-2.5 py-1 text-xs font-bold">FINAL</span>
            )}
            {live && (
              <span>
                {match.periodLabel} {match.clock}
              </span>
            )}
          </p>
          <p className="mt-1 text-[44px] leading-tight font-bold tabular-nums md:text-[56px]">
            {match.score?.home} – {match.score?.away}
          </p>
          <p className="text-xs text-muted tabular-nums">{periodScoresText(match.periodScores)}</p>
        </div>
        <Team team={match.away} align="right" />
      </div>
      <p className="mt-4 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-muted">
        <span>{match.league}</span>
        <span aria-hidden>·</span>
        <span>{dateLabel}</span>
        <span aria-hidden>·</span>
        <span>{venue}</span>
        <span aria-hidden>·</span>
        <span>{fmtInt(spectators)} spectators</span>
      </p>
    </section>
  );
}
