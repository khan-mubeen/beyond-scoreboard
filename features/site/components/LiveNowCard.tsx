// "Live now / Next up": one card for asides and empty states, from the page's live source (the
// same one as the header ticker and the home Live filter). live: the score, an open question,
// "Join the match". lobby: "Starting soon". just ended: the result and what came next. otherwise
// the next game with a countdown and "Set reminder". nothing when nothing is scheduled
import { useState } from "react";
import type { TeamRef } from "@/shared/types";
import { setReminderApi } from "../data";
import { Icon } from "./Icon";
import { fmtLeft, useLiveNow } from "./live-now";
import { LivePill } from "./LiveTicker";
import { TeamLogo } from "./TeamLogo";
import { useToast } from "./Toast";

function Teams({ home, away, score }: { home: TeamRef; away: TeamRef; score?: { home: number; away: number } | null }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
      <span className="flex min-w-0 items-center gap-2 font-semibold">
        <TeamLogo team={home} size={32} />
        <span className="truncate">{home.name}</span>
      </span>
      <span className="text-xl font-bold tabular-nums">{score ? `${score.home}–${score.away}` : "–"}</span>
      <span className="flex min-w-0 items-center justify-end gap-2 font-semibold">
        <span className="truncate text-right">{away.name}</span>
        <TeamLogo team={away} size={32} />
      </span>
    </div>
  );
}

function ReminderButton({ matchId, title }: { matchId: string; title: string }) {
  const [on, setOn] = useState(false);
  const toast = useToast();
  async function flip() {
    const next = !on;
    setOn(next);
    const r = await setReminderApi(matchId, next);
    if (!r.ok) {
      setOn(!next);
      return toast("Couldn't save the reminder, try again", { tone: "bad" });
    }
    toast(next ? `We'll remind you before ${title}` : "Reminder removed");
  }
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => void flip()}
      className={`inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold ${
        on ? "border border-accent bg-accent-soft text-accent" : "bg-accent text-accent-ink hover:bg-accent-hover"
      }`}
    >
      <Icon name="bell" className="size-4" />
      {on ? "Reminder set ✓" : "Set reminder"}
    </button>
  );
}

const primary =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-ink hover:bg-accent-hover";

/** the next game: its teams, a countdown (or its time) and a reminder */
function NextUp({
  matchId,
  home,
  away,
  startsAt,
  when,
  now,
}: {
  matchId: string;
  home: TeamRef;
  away: TeamRef;
  startsAt: number | null;
  when: string | null;
  now: number;
}) {
  const title = `${home.name} – ${away.name}`;
  return (
    <div className="flex flex-col gap-3">
      <Teams home={home} away={away} />
      <p className="text-sm text-muted" data-testid="live-now-countdown">
        {startsAt && startsAt > now ? (
          <>
            Starts in <span className="font-semibold text-ink tabular-nums">{fmtLeft(startsAt - now)}</span>
          </>
        ) : (
          (when ?? "Coming up")
        )}
      </p>
      <div className="flex gap-2">
        <ReminderButton matchId={matchId} title={title} />
        <a
          href={`/match/${matchId}`}
          className="inline-flex h-10 items-center rounded-lg border border-line px-3 text-sm font-semibold hover:bg-surface-2"
        >
          Preview
        </a>
      </div>
    </div>
  );
}

export function LiveNowCard({ className = "" }: { className?: string }) {
  const now = useLiveNow();
  if (!now) return null;
  const { t, phase, score, question, serverNow } = now;
  const title = phase === "live" ? "Live now" : phase === "lobby" ? "Starting soon" : "Next up";

  return (
    <section
      aria-label={title}
      data-testid="live-now-card"
      data-phase={phase}
      className={`rounded-card border border-line bg-surface p-4 shadow-card ${className}`}
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold tracking-wider text-muted uppercase">{title}</h2>
        {phase === "live" && <LivePill />}
      </header>

      {phase === "live" || phase === "lobby" ? (
        <div className="flex flex-col gap-3">
          <Teams home={t.home} away={t.away} score={score} />
          {phase === "live" && question ? (
            <p
              className="flex items-center gap-2 rounded-lg bg-live-soft px-3 py-2 text-sm font-semibold text-live"
              data-testid="live-now-question"
            >
              <span className="size-2 animate-pulse rounded-full bg-live motion-reduce:animate-none" aria-hidden />
              Questions open · <span className="tabular-nums">0:{String(question.secondsLeft).padStart(2, "0")}</span>
            </p>
          ) : (
            <p className="text-sm text-muted">
              {phase === "lobby" ? (
                t.startsAt && t.startsAt > serverNow ? (
                  <>
                    Starts in{" "}
                    <span className="font-semibold text-ink tabular-nums">{fmtLeft(t.startsAt - serverNow)}</span>. The
                    first question opens with the puck drop.
                  </>
                ) : (
                  "The puck drops in a moment."
                )
              ) : (
                "Next question soon. Answer for +20 points."
              )}
            </p>
          )}
          <a href={`/match/${t.matchId}`} className={primary}>
            Join the match <Icon name="arrowRight" className="size-4" />
          </a>
        </div>
      ) : phase === "summary" ? (
        <div className="flex flex-col gap-3">
          <a
            href={`/match/${t.matchId}`}
            className="rounded-lg bg-surface-2 px-3 py-2 text-sm hover:bg-line/60"
            data-testid="just-finished"
          >
            <span className="text-muted">Just finished: </span>
            <span className="font-semibold">
              {t.home.name} {score ? `${score.home}–${score.away}` : ""} {t.away.name}
            </span>
            <span className="font-semibold text-accent"> · See what it meant →</span>
          </a>
          {t.following && <NextUp {...t.following} now={serverNow} />}
        </div>
      ) : (
        <NextUp matchId={t.matchId} home={t.home} away={t.away} startsAt={t.startsAt} when={t.when} now={serverNow} />
      )}
    </section>
  );
}
