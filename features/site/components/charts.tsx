// small svg charts, our own (like StepChart): an arc gauge, form strips, a stacked
// bar, and a table whose rows slide into their new places. motion respects reduced motion
// (SiteLayout's MotionConfig); every chart has a text alternative
import { motion } from "motion/react";
import type { FormResult, TeamRef, Zone } from "@/shared/types";
import { ZONE_DOT, ZONE_LINES } from "./LiigaTable";
import { TeamLogo } from "./TeamLogo";

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "±0");

/**
 * a half-circle gauge: the value now (solid, animated from the old one) over the old value
 * (faint). `higherIsBetter` false (relegation) turns a rise red
 */
export function ArcGauge({
  value,
  before,
  label,
  higherIsBetter = true,
  size = 150,
  color = "var(--pp-accent)",
}: {
  value: number;
  before?: number;
  label: string;
  higherIsBetter?: boolean;
  size?: number;
  color?: string;
}) {
  const delta = before === undefined ? 0 : value - before;
  const good = delta === 0 ? null : (delta > 0) === higherIsBetter;
  const arc = "M 12 62 A 50 50 0 0 1 112 62";
  return (
    <figure className="flex w-full min-w-0 flex-col items-center" style={{ maxWidth: size }}>
      <svg viewBox="0 0 124 72" className="w-full overflow-visible" role="img" aria-label={`${label}: ${value}%${before !== undefined ? `, ${signed(delta)} percentage points from ${before}%` : ""}`}>
        <path d={arc} fill="none" className="stroke-surface-2" strokeWidth={11} strokeLinecap="round" />
        {before !== undefined && before !== value && before > 0 && <path d={arc} fill="none" stroke="currentColor" className="text-line" strokeWidth={11} strokeLinecap="round" pathLength={1} strokeDasharray={`${Math.max(0.001, before / 100)} 1`} />}
        <motion.path
          d={arc}
          fill="none"
          stroke={color}
          strokeWidth={11}
          strokeLinecap="round"
          // at 0% the round cap would still draw a dot
          initial={{ pathLength: (before ?? 0) / 100, opacity: value > 0 ? 1 : 0 }}
          animate={{ pathLength: Math.max(0.001, value / 100), opacity: value > 0 ? 1 : 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        />
        <text x={62} y={52} textAnchor="middle" className="fill-ink text-[22px] font-bold tabular-nums">
          {value}%
        </text>
      </svg>
      <figcaption className="-mt-1 text-center">
        <span className="block text-xs font-semibold text-muted">{label}</span>
        {before !== undefined && (
          <span className={`text-xs font-bold tabular-nums ${good === null ? "text-muted" : good ? "text-good" : "text-bad"}`}>
            <span aria-hidden>
              {delta > 0 ? "▲" : delta < 0 ? "▼" : "±"}
              {Math.abs(delta)}
            </span>
            <span className="sr-only">{delta ? `${delta > 0 ? "up" : "down"} ${Math.abs(delta)} percentage points` : "no change"}</span>
          </span>
        )}
      </figcaption>
    </figure>
  );
}

export interface MovingRow {
  team: TeamRef;
  rank: number;
  rankBefore: number;
  points: number;
  pointsBefore: number;
  zone: Zone;
}

/**
 * the table with rows that slide to their new places, the zone lines staying put. `highlight`
 * marks teams (the match's two)
 */
export function MovingTable({ rows, highlight = [], caption }: { rows: MovingRow[]; highlight?: string[]; caption: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <p className="sr-only">{caption}</p>
      <ol className="relative text-sm tabular-nums" aria-label={caption}>
        {rows.flatMap((r, i) => {
          const next = rows[i + 1];
          const line = next && next.zone !== r.zone ? (ZONE_LINES[r.zone] ?? { label: "Top 4", cls: "border-top4 text-top4" }) : null;
          const moved = r.rankBefore - r.rank;
          const mine = highlight.includes(r.team.id);
          const row = (
            <motion.li
              key={r.team.id}
              layout
              transition={{ type: "spring", stiffness: 260, damping: 30 }}
              className={`flex items-center gap-2 border-b border-line px-3 py-1.5 last:border-0 ${mine ? "bg-accent-soft font-semibold" : "bg-surface"}`}
            >
              <span className="w-5 text-right text-xs text-muted">{r.rank}</span>
              <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${ZONE_DOT[r.zone]}`} />
              <TeamLogo team={r.team} size={20} />
              <span className="min-w-0 flex-1 truncate">{r.team.name}</span>
              <span className={`w-8 text-right text-xs font-bold ${moved > 0 ? "text-good" : moved < 0 ? "text-bad" : "text-transparent"}`} aria-label={moved ? `${moved > 0 ? "up" : "down"} ${Math.abs(moved)}` : undefined}>
                {moved > 0 ? `▲${moved}` : moved < 0 ? `▼${-moved}` : "·"}
              </span>
              <span className="w-14 text-right">
                {r.points}
                {r.points !== r.pointsBefore && <span className="ml-1 text-xs text-good">+{r.points - r.pointsBefore}</span>}
              </span>
            </motion.li>
          );
          // the zone lines keep their own keys: they stay put while the teams slide past them
          return line
            ? [
                row,
                <li key={`line-${r.zone}`} aria-hidden className={`border-t-2 border-dashed px-3 py-0.5 text-[10px] font-bold tracking-wider uppercase ${line.cls}`}>
                  {line.label}
                </li>,
              ]
            : [row];
        })}
      </ol>
    </div>
  );
}

const FORM: Record<FormResult, { text: string; cls: string; label: string }> = {
  W: { text: "W", cls: "bg-good text-white", label: "win" },
  OTW: { text: "W", cls: "bg-good/70 text-white", label: "overtime win" },
  OTL: { text: "L", cls: "bg-bad/60 text-white", label: "overtime loss" },
  L: { text: "L", cls: "bg-bad text-white", label: "loss" },
};

/** results as small squares, oldest first ("W W L OT…") */
export function FormStrip({ results, label }: { results: { result: FormResult; title?: string }[]; label: string }) {
  if (!results.length) return <p className="text-xs text-muted">No games yet</p>;
  return (
    <ol className="flex gap-1" aria-label={`${label}: ${results.map((r) => FORM[r.result].label).join(", ")}`}>
      {results.map((r, i) => (
        <li key={i} title={r.title} className={`grid h-6 min-w-6 place-items-center rounded px-1 text-[11px] font-bold ${FORM[r.result].cls}`}>
          {FORM[r.result].text}
          {r.result === "OTW" || r.result === "OTL" ? <span className="sr-only"> (OT)</span> : null}
        </li>
      ))}
    </ol>
  );
}

/** one bar split into coloured parts (points by source) */
export function StackedBar({ parts, total, label }: { parts: { label: string; value: number; color: string }[]; total: number; label: string }) {
  const shown = parts.filter((p) => p.value > 0);
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`${label}: ${shown.map((p) => `${p.label} ${p.value}`).join(", ") || "none"}`}>
        {shown.map((p) => (
          <motion.span key={p.label} style={{ background: p.color }} initial={{ width: 0 }} animate={{ width: `${(100 * p.value) / Math.max(1, total)}%` }} transition={{ duration: 0.5 }} />
        ))}
      </div>
      <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs" aria-hidden>
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-1">
            <span className="size-2 rounded-full" style={{ background: p.color }} />
            {p.label} <span className="font-semibold tabular-nums">{p.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
