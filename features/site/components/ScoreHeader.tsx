import type { MatchSummary, TeamRef } from "@/shared/types";
import { fmtInt, periodScoresText } from "../format";
import { LiveBadge } from "./LiveMatchCard";
import { WhenLabel } from "./WhenLabel";

/**
 * a team beside the score: the logo 44 px on phones, 72 on wider screens, and the name big enough
 * to balance the score. a long name ("Kiekko-Espoo") wraps at its hyphen instead of being cut
 */
function Team({ team, align }: { team: TeamRef; align: "left" | "right" }) {
  return (
    <div
      className={`flex min-w-0 flex-col items-center gap-2 text-center md:gap-4 ${
        align === "right" ? "md:flex-row-reverse md:text-right" : "md:flex-row md:text-left"
      }`}
    >
      <img src={team.logo} alt={`${team.name} logo`} className="size-11 shrink-0 rounded-full md:size-[72px]" />
      <div className="min-w-0">
        <p className="text-base leading-tight font-bold [overflow-wrap:anywhere] sm:text-xl md:text-[26px]">{team.name}</p>
        {team.city && <p className="mt-0.5 text-xs text-muted md:text-sm">{team.city}</p>}
      </div>
    </div>
  );
}

/** teams, score, period scores and match facts at the top of every match page (preview, live, final, tv) */
export function ScoreHeader({
  match,
  venue,
  dateLabel,
  spectators,
}: {
  match: MatchSummary;
  venue: string;
  dateLabel: string;
  spectators: number | null;
}) {
  const live = match.status === "live";
  const facts = [match.league, dateLabel, venue, spectators ? `${fmtInt(spectators)} spectators` : null].filter(Boolean);
  return (
    <section
      aria-label="Score"
      className="rounded-card border border-line bg-gradient-to-r from-surface from-60% to-accent-soft p-5 shadow-card md:px-6"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-4">
        <Team team={match.home} align="left" />
        <div className="text-center">
          <p className="flex items-center justify-center gap-2 text-sm font-semibold">
            {live ? (
              <LiveBadge />
            ) : (
              <span className="rounded-md bg-surface-2 px-2.5 py-1 text-xs font-bold">
                {match.status === "final" ? "FINAL" : <WhenLabel match={match} />}
              </span>
            )}
            {live && (
              <span>
                {match.periodLabel} {match.clock}
              </span>
            )}
          </p>
          <p className="mt-1 text-[40px] leading-tight font-bold whitespace-nowrap tabular-nums sm:text-[48px] md:text-[60px]">
            {match.score ? `${match.score.home} – ${match.score.away}` : "vs"}
          </p>
          <p className="text-xs text-muted tabular-nums">{periodScoresText(match.periodScores)}</p>
        </div>
        <Team team={match.away} align="right" />
      </div>
      <p className="mt-4 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-muted">
        {facts.map((f, i) => (
          <span key={f} className="flex gap-3">
            {i > 0 && <span aria-hidden>·</span>}
            <span>{f}</span>
          </span>
        ))}
      </p>
    </section>
  );
}
