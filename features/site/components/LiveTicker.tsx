// the header's one line: "● LIVE TPS 1–0 Ilves · Your Call! open", "Starting soon", "Final", or
// the next game. the server picks the match; the match channel keeps the score and the open
// question fresh while it runs. nothing when nothing is scheduled
import type { TickerData } from "@/shared/types";
import { useQuery, useServerNow, USE_MOCKS } from "../data";
import { featuredQuestion } from "./featured-question";
import { TeamLogo } from "./TeamLogo";
import { useMatchChannel } from "./use-match-channel";

export function LiveTicker({ className = "" }: { className?: string }) {
  const { data } = useQuery<{ ticker: TickerData | null }>(USE_MOCKS ? null : "/api/site/ticker", {
    refreshMs: 15_000,
  });
  const t = data?.ticker ?? null;
  const running = !!t && t.phase !== "next";
  const { state } = useMatchChannel(running ? t.matchId : null);
  const now = useServerNow();
  if (!t) return null;

  // the channel is newer than the ticker poll: its phase and score win
  const fresh = state?.matchId === t.matchId ? state : null;
  const phase = fresh?.rotation?.phase && fresh.rotation.phase !== "idle" ? fresh.rotation.phase : t.phase;
  const score = fresh && phase !== "lobby" ? fresh.score : t.score;
  const open = phase === "live" && featuredQuestion(fresh, now)?.kind === "open";

  const label =
    phase === "live" ? (
      <span className="inline-flex items-center gap-1.5 font-bold text-live">
        <span className="size-2 animate-pulse rounded-full bg-live" aria-hidden />
        LIVE
      </span>
    ) : phase === "lobby" ? (
      <span className="font-semibold text-live">Starting soon</span>
    ) : phase === "summary" ? (
      <span className="font-semibold text-muted">Final</span>
    ) : (
      <span className="font-semibold text-muted">Next:</span>
    );

  return (
    <a
      href={`/match/${t.matchId}`}
      data-testid="live-ticker"
      aria-label={`${phase === "next" ? "Next game" : phase === "live" ? "Live now" : phase === "lobby" ? "Starting soon" : "Final"}: ${t.home.name} ${score ? `${score.home}–${score.away}` : "–"} ${t.away.name}${open ? ", Your Call! open" : ""}`}
      className={`flex min-w-0 items-center gap-2 overflow-hidden rounded-full border border-line bg-surface px-3 py-1.5 text-sm whitespace-nowrap hover:border-ink/30 ${className}`}
    >
      {label}
      <span className="flex min-w-0 items-center gap-1.5 font-semibold">
        <TeamLogo team={t.home} size={18} />
        <span className="truncate">{t.home.name}</span>
        <span className="tabular-nums">{score ? `${score.home}–${score.away}` : "–"}</span>
        <span className="truncate">{t.away.name}</span>
        <TeamLogo team={t.away} size={18} />
      </span>
      {phase === "next" && t.when && <span className="text-muted">· {t.when}</span>}
      {open && <span className="font-semibold text-live">· Your Call! open</span>}
    </a>
  );
}
