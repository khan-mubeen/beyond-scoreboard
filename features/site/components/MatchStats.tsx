import { motion } from "motion/react";
import { useState } from "react";
import type { FinishedInsights, MatchStat, TeamRef } from "@/shared/types";
import { teamColors } from "../team-colors";
import { SectionCard } from "./SectionCard";

const pending = (s: MatchStat) => s.home === null || s.away === null;

interface Row {
  id: string;
  label: string;
  home: number;
  away: number;
  /** what to print; the numbers when absent */
  text?: [string, string];
}

/** one stat as mirrored bars from the centre, in the team colours; the leader's value in bold */
function MirrorRow({ row, home, away }: { row: Row; home: string; away: string }) {
  const max = Math.max(1, row.home, row.away);
  const [ht, at] = row.text ?? [String(row.home), String(row.away)];
  const lead = row.home === row.away ? null : row.home > row.away ? "home" : "away";
  const value = (side: "home" | "away") => (lead === side ? "font-bold text-ink" : "text-muted");
  // the trailing side keeps its colour, lighter
  const fade = (side: "home" | "away") => (lead !== null && lead !== side ? 0.6 : 1);
  return (
    <li>
      <p className="text-center text-xs font-semibold">{row.label}</p>
      <div className="mt-1 grid grid-cols-[3.75rem_minmax(0,1fr)_minmax(0,1fr)_3.75rem] items-center gap-2 text-sm tabular-nums">
        <span className={`text-left ${value("home")}`}>{ht}</span>
        <span className="flex h-2.5 justify-end overflow-hidden rounded-l-full bg-surface-2">
          <motion.span className="h-full rounded-l-full" style={{ background: home, opacity: fade("home") }} initial={{ width: 0 }} animate={{ width: `${(100 * row.home) / max}%` }} transition={{ duration: 0.6 }} />
        </span>
        <span className="flex h-2.5 overflow-hidden rounded-r-full bg-surface-2">
          <motion.span className="h-full rounded-r-full" style={{ background: away, opacity: fade("away") }} initial={{ width: 0 }} animate={{ width: `${(100 * row.away) / max}%` }} transition={{ duration: 0.6 }} />
        </span>
        <span className={`text-right ${value("away")}`}>{at}</span>
      </div>
    </li>
  );
}

const rowOf = (s: MatchStat): Row => {
  const unit = s.unit ?? "";
  return { id: s.id, label: s.label, home: s.home!, away: s.away!, text: s.display ?? [`${s.home}${unit}`, `${s.away}${unit}`] };
};

/** shots and puck time per period, as the same mirrored rows */
function periodRows(periods: FinishedInsights["periods"]): { title: string; rows: Row[] }[] {
  const shots = periods.filter((p) => p.shots).map((p) => ({ id: `s-${p.label}`, label: p.label, home: p.shots!.home, away: p.shots!.away }));
  const control = periods
    .filter((p) => p.control)
    .map((p) => ({ id: `c-${p.label}`, label: p.label, home: p.control!.home, away: p.control!.away, text: [`${p.control!.home}%`, `${p.control!.away}%`] as [string, string] }));
  return [
    { title: "Shots on goal", rows: shots },
    { title: "Time with the puck", rows: control },
  ].filter((g) => g.rows.length > 0);
}

/**
 * match statistics from the feed: shots, blocked shots, faceoffs, penalty minutes, power-play
 * goals and puck time as mirrored bars in the team colours, plus a "by period" view of shots and
 * puck time when the feed has it. a missing value shows "Data pending", never a guess
 */
export function MatchStats({
  stats,
  source,
  note,
  home,
  away,
  periods = [],
}: {
  stats: MatchStat[];
  source: string;
  note: string;
  home: TeamRef;
  away: TeamRef;
  periods?: FinishedInsights["periods"];
}) {
  const [view, setView] = useState<"game" | "period">("game");
  const byPeriod = periodRows(periods);
  const hc = teamColors(home).bg;
  const ac = teamColors(away).bg;
  const shown = stats.filter((s) => !pending(s));
  const missing = stats.filter(pending);
  const toggle = byPeriod.length > 0 && (
    <div role="group" aria-label="Statistics view" className="flex rounded-full bg-surface-2 p-0.5 text-xs font-semibold">
      {(["game", "period"] as const).map((v) => (
        <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={`rounded-full px-2.5 py-1 ${view === v ? "bg-surface text-ink shadow-card" : "text-muted"}`}>
          {v === "game" ? "Game" : "By period"}
        </button>
      ))}
    </div>
  );
  return (
    <SectionCard title="Match statistics" action={toggle || <span className="text-xs text-muted">{source}</span>}>
      <div className="mb-3 flex justify-between text-sm font-bold">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-full" style={{ background: hc }} />
          {home.name}
        </span>
        <span className="flex items-center gap-1.5">
          {away.name}
          <span aria-hidden className="size-2.5 rounded-full" style={{ background: ac }} />
        </span>
      </div>
      {view === "period" && byPeriod.length > 0 ? (
        <div className="flex flex-col gap-4">
          {byPeriod.map((g) => (
            <section key={g.title}>
              <h3 className="mb-1.5 text-xs font-semibold tracking-wider text-muted uppercase">{g.title}</h3>
              <ul className="flex flex-col gap-2.5">
                {g.rows.map((r) => (
                  <MirrorRow key={r.id} row={r} home={hc} away={ac} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((s) => (
            <MirrorRow key={s.id} row={rowOf(s)} home={hc} away={ac} />
          ))}
          {missing.map((s) => (
            <li key={s.id} className="flex justify-between text-xs">
              <span className="font-semibold">{s.label}</span>
              <span className="text-muted">Data pending</span>
            </li>
          ))}
        </ul>
      )}
      {missing.length > 0 && <p className="mt-3 rounded-lg border border-dashed border-line px-3 py-2.5 text-xs text-muted">{note}</p>}
      {toggle && <p className="mt-3 text-xs text-muted">{source}</p>}
    </SectionCard>
  );
}
