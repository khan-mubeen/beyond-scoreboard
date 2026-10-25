import type { StakesChipData } from "@/shared/types";
import { TeamLogo } from "./TeamLogo";

/**
 * a change in a chance, in percentage points: "▲12", "▼9", "±0" (with `label`: "▲6 playoff
 * chance"). never "pts": that word is the fans' own points. the arrow carries the meaning, colour
 * only helps; screen readers hear "up 12 percentage points"
 */
export function ChangeTag({ change, label, className = "" }: { change: number; label?: string; className?: string }) {
  const up = change > 0;
  const down = change < 0;
  const n = Math.abs(change);
  return (
    <span className={`font-semibold whitespace-nowrap tabular-nums ${up ? "text-good" : down ? "text-bad" : "text-muted"} ${className}`}>
      <span aria-hidden>
        {up ? "▲" : down ? "▼" : "±"}
        {n}
        {label && ` ${label}`}
      </span>
      <span className="sr-only">
        {up || down ? `${up ? "up" : "down"} ${n} percentage ${n === 1 ? "point" : "points"}` : "no change"}
        {label && ` ${label}`}
      </span>
    </span>
  );
}

/** a team's playoff chance with its change. dark sits on the live match card */
export function StakesChip({ chip, dark = false }: { chip: StakesChipData; dark?: boolean }) {
  return (
    <div
      className={`flex min-w-0 items-center gap-2.5 rounded-lg px-3 py-2 ${dark ? "bg-dark-ink/10 text-dark-ink" : "bg-surface-2"}`}
    >
      <TeamLogo team={chip.team} size={30} />
      <div className="min-w-0 text-sm">
        <p className="truncate font-semibold">{chip.team.name}</p>
        <p className="whitespace-nowrap">
          <span className={dark ? "opacity-80" : "text-muted"}>{chip.label}</span>{" "}
          <span className="font-bold tabular-nums">{chip.chance}%</span>{" "}
          <ChangeTag change={chip.change} className="text-xs" />
        </p>
      </div>
    </div>
  );
}
