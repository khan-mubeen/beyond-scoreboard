import type { MatchStat } from "@/shared/types";
import { SectionCard } from "./SectionCard";

const pending = (s: MatchStat) => s.home === null || s.away === null;

function StatValue({ stat }: { stat: MatchStat }) {
  if (pending(stat)) return <p className="mt-1 text-xs text-muted">Data pending</p>;
  const unit = stat.unit ?? "";
  if (stat.display) {
    return (
      <p className="mt-1 text-lg font-bold tabular-nums">
        {stat.display[0]} <span className="font-normal text-muted">–</span> {stat.display[1]}
      </p>
    );
  }
  return (
    <p className="mt-1 text-lg font-bold tabular-nums">
      {stat.home}
      {unit} <span className="font-normal text-muted">–</span> {stat.away}
      {unit}
    </p>
  );
}

/** match statistics from the feed. a missing value shows "Data pending", never a guess */
export function MatchStats({ stats, source, note }: { stats: MatchStat[]; source: string; note: string }) {
  const anyPending = stats.some(pending);
  return (
    <SectionCard title="Match statistics" action={<span className="text-xs text-muted">{source}</span>}>
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {stats.map((s) => (
          <li key={s.id} className="rounded-lg border border-line bg-surface-2/60 px-3 py-3">
            <p className="text-xs font-semibold">{s.label}</p>
            <StatValue stat={s} />
          </li>
        ))}
      </ul>
      {anyPending && (
        <p className="mt-3 rounded-lg border border-dashed border-line px-3 py-2.5 text-xs text-muted">{note}</p>
      )}
    </SectionCard>
  );
}
