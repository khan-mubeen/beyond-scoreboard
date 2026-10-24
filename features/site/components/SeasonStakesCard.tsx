import { Fragment, useEffect, useRef } from "react";
import { zoneLabel } from "@/features/stakes";
import type { GameOutcome, SeasonStakes } from "@/shared/types";
import { Icon } from "./Icon";
import { ZONE_LINES, ZONE_TEXT, ZoneLegend } from "./LiigaTable";
import { Pill, SectionCard } from "./SectionCard";
import { ChangeTag } from "./StakesChip";
import { StepChart } from "./StepChart";
import { WhatIfPanel } from "./WhatIfPanel";

const WORTH: [GameOutcome, string][] = [
  ["regulationWin", "Win"],
  ["overtimeWin", "Overtime win"],
  ["overtimeLoss", "Overtime loss"],
  ["regulationLoss", "Loss"],
];

/**
 * the playoff chance, how each goal moved it, and the whole table if it ends now: all 17 teams
 * in a box about nine rows tall, scrolled so the match team's row sits in the middle
 */
export function SeasonStakesCard({ stakes }: { stakes: SeasonStakes }) {
  const box = useRef<HTMLDivElement>(null);
  const rowsKey = stakes.rows.map((r) => `${r.rank}${r.highlight ? "*" : ""}`).join();
  useEffect(() => {
    const el = box.current;
    const row = el?.querySelector<HTMLElement>("[data-highlight]");
    // scroll the box only, never the page
    if (el && row) el.scrollTop += row.getBoundingClientRect().top - el.getBoundingClientRect().top - el.clientHeight / 2 + row.offsetHeight / 2;
  }, [rowsKey]);
  return (
    <SectionCard
      id="season-stakes"
      title="Season stakes"
      action={
        <Pill>
          <Icon name="info" className="size-3.5" />
          {stakes.source}
        </Pill>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="rounded-card border border-line bg-gradient-to-br from-surface-2/70 to-surface p-4">
          <p className="text-xs font-semibold tracking-wider text-muted uppercase">
            {stakes.teamName} · Playoff chance
          </p>
          <p className="mt-2 flex items-center gap-3">
            <span className="text-[48px] leading-none font-bold tabular-nums">{stakes.chance}%</span>
            <Pill tone="good">
              <ChangeTag change={stakes.change} />
            </Pill>
          </p>
          <p className="mt-2 text-sm text-muted">
            {stakes.before}% before the game · {stakes.now}% {stakes.nowLabel}
          </p>
          <div className="mt-4">
            <StepChart steps={stakes.steps} />
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{stakes.tableTitle}</h3>
            <Pill tone="good">{stakes.tableBadge}</Pill>
          </div>
          <div
            ref={box}
            tabIndex={0}
            role="region"
            aria-label={`${stakes.tableTitle}, all ${stakes.rows.length} teams`}
            className="mt-3 max-h-[19.5rem] overflow-y-auto rounded-lg border border-line"
          >
            <table className="w-full text-xs tabular-nums">
              <thead className="sticky top-0 z-10 bg-surface">
                <tr className="border-b border-line text-left text-muted">
                  <th scope="col" className="w-8 px-3 py-2 font-medium">
                    #
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    League position
                  </th>
                  <th scope="col" className="w-24 py-2 pr-3 font-medium">
                    Zone
                  </th>
                </tr>
              </thead>
              <tbody>
              {stakes.rows.map((r, i) => {
                const next = stakes.rows[i + 1];
                const line = next && next.zone !== r.zone ? ZONE_LINES[r.zone] : undefined;
                return (
                  <Fragment key={r.rank}>
                    <tr
                      data-highlight={r.highlight ? "true" : undefined}
                      aria-current={r.highlight ? "true" : undefined}
                      className={`${line ? "" : "border-b border-line last:border-0"} ${r.highlight ? "bg-accent-soft font-semibold text-accent" : ""}`}
                    >
                      <td className="px-3 py-2">{r.rank}</td>
                      <td className="py-2">{r.label}</td>
                      <td className={`py-2 pr-3 ${r.highlight ? "" : ZONE_TEXT[r.zone]}`}>{zoneLabel(r.zone)}</td>
                    </tr>
                    {line && (
                      <tr aria-hidden>
                        <td colSpan={3} className={`border-t-2 p-0 ${line.cls}`} />
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              </tbody>
            </table>
          </div>
          <ZoneLegend className="mt-3" />
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2 border-t border-line pt-4 text-sm sm:flex-row sm:items-center sm:justify-between">
        <h3 className="font-semibold">What this game is worth</h3>
        <p className="tabular-nums">
          {WORTH.map(([k, label], i) => (
            <span key={k}>
              {i > 0 && <span className="text-muted"> · </span>}
              {label} <span className="font-semibold">{stakes.worth[k]}%</span>
            </span>
          ))}
        </p>
      </div>
      {stakes.whatIf && <WhatIfPanel options={stakes.whatIf} />}
    </SectionCard>
  );
}
