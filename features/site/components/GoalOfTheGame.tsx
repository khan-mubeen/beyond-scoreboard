import type { FinishedMatchDetail } from "@/shared/types";
import { WATCH_CLASS, WatchButton } from "./EventList";
import { Pill, SectionCard } from "./SectionCard";
import { LiigaLink, Poster } from "./VideoPlayer";

/** the goal that moved the chance most. watch: our highlight from that goal, else on liiga.fi */
export function GoalOfTheGame({
  goal,
  onWatch,
}: {
  goal: NonNullable<FinishedMatchDetail["goalOfTheGame"]>;
  onWatch: () => void;
}) {
  const hosted = !!goal.video.src;
  const href = goal.video.href;
  const thumb = <Poster src={goal.thumbnail} fallback="/placeholders/goal-thumb.svg" className="size-full object-cover" />;
  const frame = "relative aspect-[3/2] w-full shrink-0 overflow-hidden rounded-lg bg-dark sm:w-44";
  return (
    <SectionCard title="Goal of the game" action={<Pill tone="good">{goal.chip}</Pill>}>
      <div className="flex flex-col gap-4 sm:flex-row">
        {hosted ? (
          <button type="button" onClick={onWatch} className={frame} aria-label={`Watch: ${goal.title}`}>
            {thumb}
          </button>
        ) : href ? (
          <a href={href} target="_blank" rel="noreferrer" className={frame} aria-label={`Watch on liiga.fi: ${goal.title}`}>
            {thumb}
          </a>
        ) : (
          <div className={frame}>{thumb}</div>
        )}
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wider text-muted uppercase">{goal.meta}</p>
          <h3 className="mt-1 text-xl font-bold">{goal.title}</h3>
          <p className="mt-1 text-sm text-muted">{goal.effectText}</p>
          {hosted ? (
            <WatchButton onClick={onWatch} label="Watch moment" className="mt-3 px-4 py-2 text-sm" />
          ) : (
            href && <LiigaLink href={href} className={`${WATCH_CLASS} mt-3 px-4 py-2 text-sm`} />
          )}
        </div>
      </div>
    </SectionCard>
  );
}
