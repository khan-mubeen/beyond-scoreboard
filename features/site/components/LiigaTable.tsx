import { Fragment } from "react";
import { zoneLabel } from "@/features/stakes";
import type { LiigaTableData, Zone } from "@/shared/types";
import { fmtChange } from "../format";
import { Icon } from "./Icon";
import { ActionLink, SectionCard } from "./SectionCard";
import { TeamLogo } from "./TeamLogo";

export const ZONES: Zone[] = ["top4", "playoffs", "safe", "relegated"];

const ROW_BG: Record<Zone, string> = {
  top4: "bg-top4-soft",
  playoffs: "bg-playoffs-soft",
  safe: "bg-surface",
  relegated: "bg-relegated-soft",
};
export const ZONE_TEXT: Record<Zone, string> = {
  top4: "text-top4",
  playoffs: "text-playoffs",
  safe: "text-safe",
  relegated: "text-relegated",
};
export const ZONE_DOT: Record<Zone, string> = {
  top4: "bg-top4",
  playoffs: "bg-playoffs",
  safe: "bg-safe",
  relegated: "bg-relegated",
};

/** a labelled line where one zone ends and the next starts */
export const ZONE_LINES: Partial<Record<Zone, { label: string; cls: string }>> = {
  playoffs: { label: "Playoff line", cls: "border-playoffs text-playoffs" },
  safe: { label: "Relegation line", cls: "border-relegated text-relegated" },
};

export function ZoneLegend({ className = "" }: { className?: string }) {
  return (
    <ul className={`flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted ${className}`} aria-label="Zones">
      {ZONES.map((z) => (
        <li key={z} className="flex items-center gap-1.5">
          <span aria-hidden className={`size-2.5 rounded-full ${ZONE_DOT[z]}`} />
          {zoneLabel(z)}
        </li>
      ))}
    </ul>
  );
}

/** the liiga table with zone bands, the playoff and relegation lines, and the fan's team highlighted */
export function LiigaTable({ table }: { table: LiigaTableData }) {
  const rows = table.rows;
  return (
    <SectionCard
      title="Liiga table"
      id="liiga-table"
      action={
        <ActionLink href={table.fullTableHref}>
          Full table <Icon name="arrowRight" className="size-4" />
        </ActionLink>
      }
      bodyClassName="px-3 pb-4 pt-2"
    >
      <table className="w-full text-[13px] tabular-nums">
        <caption className="sr-only">Liiga standings, zones marked</caption>
        <thead>
          <tr className="text-left text-xs text-muted">
            <th scope="col" className="w-7 py-2 pl-2 font-medium">
              #
            </th>
            <th scope="col" className="py-2 font-medium">
              Team
            </th>
            <th scope="col" className="w-9 py-2 text-right font-medium">
              <abbr title="Games played">GP</abbr>
            </th>
            <th scope="col" className="w-10 py-2 text-right font-medium">
              <abbr title="Goal difference">GD</abbr>
            </th>
            <th scope="col" className="w-10 py-2 pr-2 text-right font-medium">
              <abbr title="Points">Pts</abbr>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const hot = r.teamId === table.highlightTeamId;
            const next = rows[i + 1];
            const line = next && next.zone !== r.zone ? ZONE_LINES[r.zone] : undefined;
            return (
              <Fragment key={r.teamId}>
                <tr className={hot ? "bg-highlight font-semibold" : ROW_BG[r.zone]}>
                  <td className={`py-1.5 pl-2 ${ZONE_TEXT[r.zone]}`}>{r.rank}</td>
                  <td className="py-1.5">
                    <span className="flex items-center gap-2">
                      <TeamLogo team={r.team} size={18} />
                      <span className="min-w-0">
                        {r.team.name}
                        <span className="sr-only">, {zoneLabel(r.zone)}</span>
                        {hot && table.highlightNote && (
                          <span className="block text-[11px] font-medium text-good">
                            <span aria-hidden>▲ </span>
                            {table.highlightNote}
                          </span>
                        )}
                      </span>
                    </span>
                  </td>
                  <td className="py-1.5 text-right text-muted">{r.gamesPlayed}</td>
                  <td className="py-1.5 text-right text-muted">{fmtChange(r.goalDifference).replace("±0", "0")}</td>
                  <td className="py-1.5 pr-2 text-right font-semibold">{r.points}</td>
                </tr>
                {line && (
                  <tr aria-hidden>
                    <td colSpan={5} className="px-0 py-0.5">
                      <div className={`flex items-center gap-2 ${line.cls}`}>
                        <span className="flex-1 border-t-2 border-current" />
                        <span className="text-[11px] leading-none font-semibold">{line.label}</span>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      <ZoneLegend className="mt-4 px-2" />
    </SectionCard>
  );
}
