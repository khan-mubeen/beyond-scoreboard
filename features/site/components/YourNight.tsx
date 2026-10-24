import type { FinishedMatchDetail } from "@/shared/types";
import { fmtInt, ordinal } from "../format";
import { Pill, SectionCard } from "./SectionCard";

/** the fan's own result for the match */
export function YourNight({ night }: { night: FinishedMatchDetail["yourNight"] }) {
  return (
    <SectionCard title="Your night" action={<Pill tone="good">+{night.points} pts</Pill>}>
      <dl className="flex flex-col divide-y divide-line text-sm">
        <div className="flex justify-between py-2.5 first:pt-0">
          <dt className="text-muted">Calls correct</dt>
          <dd className="font-semibold tabular-nums">
            {night.callsCorrect}/{night.callsTotal}
          </dd>
        </div>
        <div className="flex justify-between py-2.5">
          <dt className="text-muted">Watch Together rank</dt>
          <dd className="font-semibold tabular-nums">
            {ordinal(night.rank)} of {fmtInt(night.of)}
          </dd>
        </div>
      </dl>
      <div className="mt-2 rounded-lg bg-accent-soft px-3 py-3">
        <p className="text-xs tracking-wider text-muted uppercase">Best call</p>
        <p className="font-semibold">{night.bestCall}</p>
      </div>
    </SectionCard>
  );
}
