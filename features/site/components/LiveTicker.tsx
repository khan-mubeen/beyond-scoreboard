// the header's one line: "● LIVE TPS 1–0 Ilves · Your Call! open", "Starting soon", "Final", or
// the next game. it reads the page's live source (live-now.tsx), like the Live now card and the
// home page's Live filter. nothing when nothing is scheduled
import { useLiveNow } from "./live-now";
import { TeamLogo } from "./TeamLogo";

/** the live pill: filled kaleva red with a pulsing dot, so it never reads as a plain red button */
export function LivePill({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full bg-live px-2 py-0.5 text-xs font-bold tracking-wide text-live-ink ${className}`}>
      <span className="size-1.5 animate-pulse rounded-full bg-live-ink motion-reduce:animate-none" aria-hidden />
      LIVE
    </span>
  );
}

export function LiveTicker({ className = "" }: { className?: string }) {
  const now = useLiveNow();
  if (!now) return null;
  const { t, phase, score } = now;
  const open = !!now.question;

  const label =
    phase === "live" ? (
      <LivePill />
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
