import { motion } from "motion/react";
import { teamById } from "@/shared/mock";
import type { GameOutcome, StakesCard, Zone } from "@/shared/types";
import { RULES } from "../engine/rules.config";
import { playoffChance, zoneChancesFromPositions } from "../engine/zones";

const ZONE_BG: Record<Zone, string> = {
  top4: "bg-top4",
  playoffs: "bg-playoffs",
  safe: "bg-safe",
  relegated: "bg-relegated",
};

const OUTCOME_LABEL: Record<GameOutcome, string> = {
  regulationWin: "Win in regulation",
  overtimeWin: "Win in OT / shootout",
  overtimeLoss: "Lose in OT / shootout",
  regulationLoss: "Lose in regulation",
};

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** a team's playoff chance right now, the zone split, and what each result would do */
export function StakesMeter({ card, compact = false }: { card: StakesCard; compact?: boolean }) {
  const zones = zoneChancesFromPositions(card.positionOdds);
  const team = teamById(card.teamId);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-sm uppercase tracking-wide text-muted">{team.name} playoff chance</span>
        <motion.span
          key={pct(playoffChance(zones))}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className={`font-bold tabular-nums ${compact ? "text-3xl" : "text-5xl"}`}
        >
          {pct(playoffChance(zones))}
        </motion.span>
      </div>

      <div className="flex h-3 overflow-hidden rounded-full bg-surface-2">
        {RULES.zones.map(({ zone }) => (
          <motion.div
            key={zone}
            className={ZONE_BG[zone]}
            animate={{ width: pct(zones[zone]) }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {RULES.zones.map(({ zone, label }) => (
          <span key={zone} className="flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${ZONE_BG[zone]}`} />
            {label} {pct(zones[zone])}
          </span>
        ))}
      </div>

      <p className="text-sm">{card.headline}</p>

      {!compact && (
        <ul className="grid grid-cols-2 gap-2 text-sm">
          {(Object.keys(OUTCOME_LABEL) as GameOutcome[]).map((o) => (
            <li key={o} className="rounded-card bg-surface-2 px-3 py-2">
              <div className="text-muted">{OUTCOME_LABEL[o]}</div>
              <div className="font-semibold tabular-nums">
                {pct(playoffChance(card.zoneOddsByOutcome[o]))} playoff chance
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
