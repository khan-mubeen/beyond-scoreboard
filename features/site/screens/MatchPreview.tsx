import { useEffect, useState } from "react";
import { NAMES } from "@/shared/copy/names";
import type { PreviewMatchDetail } from "@/shared/types";
import { FollowButton } from "../components/Follow";
import { Icon } from "../components/Icon";
import { ScoreHeader } from "../components/ScoreHeader";
import { SeasonStakesCard } from "../components/SeasonStakesCard";
import { SectionCard } from "../components/SectionCard";
import { Breadcrumbs, SiteLayout } from "../components/SiteLayout";
import { StakesChip } from "../components/StakesChip";
import { TeamLogo } from "../components/TeamLogo";
import { toast } from "../components/Toast";
import { serverNowMs, setReminderApi } from "../data";

/**
 * a game that hasn't started: when, what it is worth, the head-to-head, reminder and follow.
 * no video, no your call!, no discussion, no watch together. it reloads itself when the game
 * (or its rotation lobby) starts
 */
export function MatchPreview({ match, onChange }: { match: PreviewMatchDetail; onChange: () => void }) {
  const [reminder, setReminder] = useState(match.reminder);
  const startsAt = match.match.startsAt;

  // the start (or a host restarting the rotation) turns this into the live page
  useEffect(() => {
    const every = setInterval(onChange, 15_000);
    const left = startsAt ? startsAt - serverNowMs() : null;
    const atStart = left !== null && left < 2 ** 31 ? setTimeout(onChange, Math.max(0, left) + 500) : null;
    return () => {
      clearInterval(every);
      if (atStart) clearTimeout(atStart);
    };
  }, [onChange, startsAt]);

  async function toggleReminder() {
    const on = !reminder;
    setReminder(on);
    const res = await setReminderApi(match.id, on);
    if (!res.ok) {
      setReminder(!on);
      return toast("Couldn't save the reminder, try again", { tone: "bad" });
    }
    toast(on ? "Reminder set: we'll tell you when it starts" : "Reminder removed");
  }

  return (
    <SiteLayout sidebar={{ docked: false }}>
      <main className="flex min-w-0 flex-col gap-4 px-4 pb-12 md:px-6">
        <Breadcrumbs items={match.breadcrumbs} />
        <ScoreHeader match={match.match} venue={match.venue} dateLabel={match.dateLabel} spectators={null} />

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void toggleReminder()}
            aria-pressed={reminder}
            className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold ${reminder ? "border border-accent bg-accent-soft text-accent" : "bg-accent text-accent-ink hover:brightness-110"}`}
          >
            <Icon name="bell" className="size-4" />
            {reminder ? "Reminder set ✓" : "Set reminder"}
          </button>
          {[match.match.home, match.match.away].map((t) => (
            <span key={t.id} className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface py-1 pr-1 pl-2 text-sm font-semibold">
              <TeamLogo team={t} size={22} />
              {t.name}
              <FollowButton teamId={t.id} name={t.name} compact />
            </span>
          ))}
        </div>
        <p className="text-sm text-muted">
          {NAMES.call}, {NAMES.watchTogether} and the discussion open when the game starts.
        </p>

        {match.stakesSummary.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {match.stakesSummary.map((c) => (
              <StakesChip key={c.team.id} chip={c} />
            ))}
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <SeasonStakesCard stakes={match.seasonStakes} />
          <SectionCard title="Head-to-head">
            <p className="font-semibold">{match.headToHead.summary}</p>
            {match.headToHead.games.length > 0 && (
              <ul className="mt-3 flex flex-col divide-y divide-line text-sm">
                {match.headToHead.games.map((h) => (
                  <li key={h.matchId}>
                    <a href={`/match/${h.matchId}`} className="flex items-center justify-between gap-3 py-2 hover:underline">
                      <span className="text-muted">{h.date}</span>
                      <span className="font-semibold tabular-nums">
                        {h.home.name} {h.score.home}–{h.score.away} {h.away.name}
                        {h.extra}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </main>
    </SiteLayout>
  );
}
