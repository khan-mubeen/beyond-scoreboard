import type { StakesChipData } from "@/shared/types";
import { ChangeTag, lowerIsBetter } from "./StakesChip";

/** both teams' playoff chance next to the score: two equal, centred halves (team, number, metric) */
export function StakesSummary({ chips }: { chips: StakesChipData[] }) {
  return (
    <section
      aria-label="Playoff chances"
      className="grid grid-cols-2 items-center divide-x divide-line rounded-card border border-line bg-surface p-5 shadow-card"
    >
      {chips.map((c) => (
        <div key={c.team.id} className="flex min-w-0 flex-col items-center px-3 text-center">
          <p className="text-sm font-semibold [overflow-wrap:anywhere]">{c.team.name}</p>
          <p className="mt-1.5 flex items-baseline gap-1.5 text-[36px] leading-none font-bold tabular-nums md:text-[40px]">
            {c.chance}%
            <ChangeTag change={c.change} invert={lowerIsBetter(c.label)} className="text-sm" />
          </p>
          <p className="mt-1.5 text-xs text-muted">{c.label}</p>
        </div>
      ))}
    </section>
  );
}
