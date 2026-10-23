import { motion } from "motion/react";
import { teamById } from "@/shared/mock";
import type { ProjectedRow, Zone } from "@/shared/types";
import { RULES } from "../engine/rules.config";

const ZONE_TEXT: Record<Zone, string> = {
  top4: "text-top4",
  playoffs: "text-playoffs",
  safe: "text-safe",
  relegated: "text-relegated",
};

// last rank of each zone gets a divider under it
const ZONE_ENDS = new Set<number>(RULES.zones.slice(0, -1).map((z) => z.to));

/** the table if the game ended now. rows slide when a goal re-sorts it */
export function ProjectedTable({ rows, highlightTeamIds = [] }: { rows: ProjectedRow[]; highlightTeamIds?: string[] }) {
  return (
    <ol className="flex flex-col text-sm">
      {rows.map((row) => {
        const team = teamById(row.teamId);
        const hot = highlightTeamIds.includes(row.teamId);
        return (
          <motion.li
            key={row.teamId}
            layout
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className={`grid grid-cols-[2rem_1fr_3rem] items-center px-2 py-1 ${hot ? "rounded-md bg-surface-2 font-semibold" : ""} ${
              ZONE_ENDS.has(row.rank) ? "border-b border-dashed border-line" : ""
            }`}
          >
            <span className={`tabular-nums ${ZONE_TEXT[row.zone]}`}>{row.rank}</span>
            <span>{team.name}</span>
            <span className="text-right tabular-nums">{row.points}</span>
          </motion.li>
        );
      })}
    </ol>
  );
}
