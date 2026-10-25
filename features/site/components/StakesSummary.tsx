import type { StakesChipData } from "@/shared/types";
import { ChangeTag, lowerIsBetter } from "./StakesChip";

/** both teams' playoff chance next to the score */
export function StakesSummary({ chips }: { chips: StakesChipData[] }) {
  return (
    <section
      aria-label="Playoff chances"
      className="grid grid-cols-2 divide-x divide-line rounded-card border border-line bg-surface p-5 shadow-card"
    >
      {chips.map((c, i) => (
        <div key={c.team.id} className={i === 0 ? "pr-4" : "pl-4 text-right"}>
          <p className="text-sm font-semibold">{c.team.name}</p>
          <p className="text-xs text-muted">{c.label}</p>
          <p className="mt-2 text-[28px] leading-none font-semibold tabular-nums">
            {c.chance}% <ChangeTag change={c.change} invert={lowerIsBetter(c.label)} className="text-sm" />
          </p>
        </div>
      ))}
    </section>
  );
}
