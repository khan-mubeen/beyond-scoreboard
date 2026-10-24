import type { StakesChipData } from "@/shared/types";
import { fmtChange } from "../format";
import { TeamLogo } from "./TeamLogo";

/** ▲ +12 / ▼ −9. arrow and sign carry the meaning, colour only helps */
export function ChangeTag({
  change,
  unit = "",
  className = "",
}: {
  change: number;
  unit?: string;
  className?: string;
}) {
  const up = change > 0;
  const down = change < 0;
  return (
    <span className={`font-semibold tabular-nums ${up ? "text-good" : down ? "text-bad" : "text-muted"} ${className}`}>
      <span aria-hidden>{up ? "▲" : down ? "▼" : ""}</span>
      <span className="sr-only">{up ? "up" : down ? "down" : "no change"}</span>
      {fmtChange(change)}
      {unit}
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
