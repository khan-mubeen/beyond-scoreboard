import { Fragment } from "react";
import { zoneLabel } from "@/features/stakes";
import type { GameOutcome, SeasonStakes } from "@/shared/types";
import { Icon } from "./Icon";
import { ZONE_LINES, ZONE_TEXT, ZoneLegend } from "./LiigaTable";
import { Pill, SectionCard } from "./SectionCard";
import { ChangeTag } from "./StakesChip";
import { StepChart } from "./StepChart";

const WORTH: [GameOutcome, string][] = [
  ["regulationWin", "Win"],
  ["overtimeWin", "OT win"],
  ["overtimeLoss", "OT loss"],
  ["regulationLoss", "Loss"],
];

/** the playoff chance, how each goal moved it, and the table if it ends now */
export function SeasonStakesCard({ stakes }: { stakes: SeasonStakes }) {
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
          <table className="mt-3 w-full overflow-hidden rounded-lg border border-line text-xs tabular-nums">
            <thead>
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
                      className={`${line ? "" : "border-b border-line last:border-0"} ${
                        r.highlight ? "bg-accent-soft font-semibold text-accent" : ""
                      }`}
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
    </SectionCard>
  );
}
