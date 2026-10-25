import type { PreviewMatchDetail } from "@/shared/types";

/** this season's head-to-head in one line under the match header: the summary and a chip per game */
export function HeadToHeadStrip({ h2h }: { h2h: PreviewMatchDetail["headToHead"] }) {
  return (
    <section aria-label="Head-to-head" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-card border border-line bg-surface px-4 py-3 shadow-card" data-testid="head-to-head">
      <span className="text-xs font-semibold tracking-wider text-muted uppercase">Head-to-head</span>
      <span className="text-sm font-semibold">{h2h.summary}</span>
      {h2h.games.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {h2h.games.map((h) => (
            <li key={h.matchId}>
              <a
                href={`/match/${h.matchId}`}
                title={`${h.home.name} ${h.score.home}–${h.score.away} ${h.away.name}${h.extra}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-xs hover:border-ink"
              >
                <span className="text-muted">{h.date}</span>
                <span className="font-semibold tabular-nums">
                  {h.home.abbr ?? h.home.name} {h.score.home}–{h.score.away} {h.away.abbr ?? h.away.name}
                  {h.extra}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
