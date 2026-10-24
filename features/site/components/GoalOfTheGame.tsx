import type { FinishedMatchDetail } from "@/shared/types";
import { WatchButton } from "./EventList";
import { Pill, SectionCard } from "./SectionCard";

export function GoalOfTheGame({ goal, onWatch }: { goal: FinishedMatchDetail["goalOfTheGame"]; onWatch: () => void }) {
  return (
    <SectionCard title="Goal of the game" action={<Pill tone="good">{goal.chip}</Pill>}>
      <div className="flex flex-col gap-4 sm:flex-row">
        <button
          type="button"
          onClick={onWatch}
          className="relative aspect-[3/2] w-full shrink-0 overflow-hidden rounded-lg bg-dark sm:w-44"
          aria-label={`Watch: ${goal.title}`}
        >
          <img src={goal.thumbnail} alt="" className="size-full object-cover" />
        </button>
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wider text-muted uppercase">{goal.meta}</p>
          <h3 className="mt-1 text-xl font-bold">{goal.title}</h3>
          <p className="mt-1 text-sm text-muted">{goal.effectText}</p>
          <WatchButton onClick={onWatch} label="Watch moment" className="mt-3 px-4 py-2 text-sm" />
        </div>
      </div>
    </SectionCard>
  );
}
