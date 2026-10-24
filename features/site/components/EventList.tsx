import type { MatchEvent } from "@/shared/types";
import { fmtChange } from "../format";
import { Icon } from "./Icon";
import { ActionLink, SectionCard } from "./SectionCard";

/** effect on the playoff chance: "+6 pts" / "−6 pts" */
export function EffectTag({ effect }: { effect: number | null }) {
  if (effect === null || effect === 0) return null;
  return (
    <span className={`text-xs font-semibold whitespace-nowrap tabular-nums ${effect > 0 ? "text-good" : "text-bad"}`}>
      {fmtChange(effect)} pts
      <span className="sr-only"> playoff chance</span>
    </span>
  );
}

export function WatchButton({
  onClick,
  label = "Watch",
  className = "",
}: {
  onClick: () => void;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-md border border-accent/40 px-2.5 py-1.5 text-xs font-semibold text-accent hover:bg-accent-soft ${className}`}
    >
      <Icon name="play" className="size-3" />
      {label}
    </button>
  );
}

/** goals and other events, newest first, each with its stakes effect and a clip */
export function EventList({
  title,
  events,
  note,
  onWatch,
  onViewAll,
}: {
  title: string;
  events: MatchEvent[];
  note?: string;
  onWatch: (event: MatchEvent) => void;
  /** shown as "View all →" when given */
  onViewAll?: () => void;
}) {
  return (
    <SectionCard
      title={title}
      action={
        onViewAll && (
          <ActionLink onClick={onViewAll}>
            View all <Icon name="arrowRight" className="size-4" />
          </ActionLink>
        )
      }
    >
      <ol className="flex flex-col divide-y divide-line">
        {events.map((e) => (
          <li key={e.id} className="grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-3 py-3.5 first:pt-0">
            <div className="text-xs leading-tight text-muted">
              <p className="text-sm font-bold text-ink tabular-nums">{e.time}</p>
              {e.period.replace(" period", "")}
              <br />
              period
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold">{e.title}</p>
              <p className="truncate text-xs text-muted">{e.detail}</p>
            </div>
            <div className="flex items-center gap-3">
              <EffectTag effect={e.effect} />
              <WatchButton onClick={() => onWatch(e)} />
            </div>
          </li>
        ))}
      </ol>
      {note && (
        <p className="mt-3 rounded-lg border border-dashed border-line px-3 py-2.5 text-xs text-muted">{note}</p>
      )}
    </SectionCard>
  );
}
