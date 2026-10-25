import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import type { LeaderboardScope, SiteLeaderboardEntry } from "@/shared/types";
import { fmtInt } from "../format";
import { useBreakdown } from "../data";
import { StackedBar } from "./charts";
import { Icon } from "./Icon";
import { ActionLink, SectionCard } from "./SectionCard";
import { Avatar } from "./TeamLogo";

// gold, silver, bronze: never the accent red, which means "selected" or "you"
const MEDAL = ["bg-highlight text-gold", "bg-surface-2 text-ink", "bg-[#f6e7d8] text-[#8a5a2b]"];
const SOURCE_COLORS = { call: "var(--pp-accent)", prediction: "var(--pp-zone-top4)", trivia: "var(--pp-gold)" };

/** one fan's points on this board: by source, by match, the correct-answer rate and the best call */
export function Breakdown({ scope, userId, wide = true }: { scope: LeaderboardScope; userId: string; wide?: boolean }) {
  const { data, status } = useBreakdown(scope, userId);
  if (!data)
    return (
      <p className="px-3 py-3 text-sm text-muted">
        {status === "error" || status === "notfound" ? "No breakdown for this fan." : "Loading…"}
      </p>
    );
  const maxMatch = Math.max(1, ...data.perMatch.map((m) => m.points));
  return (
    <div className={`grid gap-4 px-3 pt-1 pb-3 text-sm ${wide ? "sm:grid-cols-2" : ""}`} data-testid="breakdown">
      <div className="flex flex-col gap-3">
        <div>
          <p className="mb-1.5 text-xs font-semibold tracking-wider text-muted uppercase">
            Where the {fmtInt(data.total)} points came from
          </p>
          <StackedBar
            total={data.total}
            label="Points by source"
            parts={[
              { label: "Your Call!", value: data.bySource.call, color: SOURCE_COLORS.call },
              { label: "Predictions", value: data.bySource.prediction, color: SOURCE_COLORS.prediction },
              { label: "Trivia", value: data.bySource.trivia, color: SOURCE_COLORS.trivia },
            ]}
          />
        </div>
        {/* only what the data has: no "0 of 0" next to points from history without answers */}
        {(data.answered > 0 || data.bestCall) && (
          <div className="flex gap-3">
            {data.answered > 0 && (
              <div className="flex-1 rounded-lg bg-surface-2 p-2.5">
                <p className="text-xs text-muted">Right answers</p>
                <p className="text-lg font-bold tabular-nums">
                  {data.correctPct}%{" "}
                  <span className="text-xs font-normal text-muted">
                    {data.correct} of {data.answered}
                  </span>
                </p>
              </div>
            )}
            {data.bestCall && (
              <div className="min-w-0 flex-[2] rounded-lg bg-surface-2 p-2.5">
                <p className="text-xs text-muted">Best call · +{data.bestCall.points}</p>
                <p className="truncate font-semibold" title={`${data.bestCall.question} ${data.bestCall.answer}`}>
                  {data.bestCall.question} {data.bestCall.answer}
                </p>
                <p className="truncate text-xs text-muted">{data.bestCall.matchTitle}</p>
              </div>
            )}
          </div>
        )}
      </div>
      {data.perMatch.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold tracking-wider text-muted uppercase">Points per match</p>
          <ul className="flex flex-col gap-1">
            {data.perMatch.slice(0, 6).map((m) => (
              <li
                key={m.matchId ?? m.title}
                className="grid grid-cols-[minmax(0,1fr)_5rem_2.5rem] items-center gap-2 text-xs"
              >
                <a href={`/match/${m.matchId}`} className="truncate hover:underline">
                  {m.title}
                </a>
                <span className="h-2 overflow-hidden rounded-full bg-surface-2">
                  <motion.span
                    className="block h-full rounded-full bg-accent"
                    initial={{ width: 0 }}
                    animate={{ width: `${(100 * m.points) / maxMatch}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </span>
                <span className="text-right font-semibold tabular-nums">{fmtInt(m.points)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * a board row as a bar (its length is the points against the leader's). tapping it, or Enter,
 * opens the fan's breakdown inline; with onSelect (a wide page) it selects the fan instead and
 * the page shows the breakdown beside the list
 */
export function BoardRow({
  e,
  max,
  scope,
  pinned = false,
  compact = false,
  onSelect,
  selected = false,
}: {
  e: SiteLeaderboardEntry;
  max: number;
  scope: LeaderboardScope;
  pinned?: boolean;
  compact?: boolean;
  onSelect?: (e: SiteLeaderboardEntry) => void;
  selected?: boolean;
}) {
  const [inline, setOpen] = useState(false);
  const open = onSelect ? selected : inline;
  const id = `breakdown-${scope}-${e.playerId}`;
  return (
    <li className={`${pinned ? "sticky bottom-0 border-t-2 border-accent bg-surface shadow-card" : ""}`}>
      <button
        type="button"
        aria-expanded={onSelect ? undefined : open}
        aria-pressed={onSelect ? selected : undefined}
        aria-controls={onSelect ? "board-breakdown" : id}
        onClick={() => (onSelect ? onSelect(e) : setOpen((o) => !o))}
        className={`relative flex w-full items-center gap-3 overflow-hidden text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent ${compact ? "rounded-lg px-2 py-1.5" : "px-4 py-2.5"} ${e.isYou ? "font-semibold text-accent" : ""} ${selected ? "bg-accent-soft" : "hover:bg-surface-2/70"}`}
        aria-label={`${e.rank}. ${e.nickname}${e.isYou ? " (you)" : ""}, ${fmtInt(e.score)} points. ${open ? "Hide" : "Show"} the breakdown`}
      >
        {/* the selected fan (wide pages): a red accent bar at the left edge on the soft tint */}
        {selected && (
          <span aria-hidden data-testid="selected-bar" className="absolute inset-y-0 left-0 z-10 w-1 bg-accent" />
        )}
        {/* the bar: points against the leader's */}
        <motion.span
          aria-hidden
          className={`absolute inset-y-1 left-0 rounded-r-lg ${selected ? "bg-surface/60" : e.isYou ? "bg-accent-soft" : "bg-surface-2"}`}
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(4, (100 * e.score) / Math.max(1, max))}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
        <span
          className={`relative grid shrink-0 place-items-center rounded-full tabular-nums ${compact ? "size-7 text-sm" : "size-8 text-sm"} ${MEDAL[e.rank - 1] ?? "text-muted"}`}
        >
          {e.rank}
        </span>
        <span className="relative">
          <Avatar src={e.avatar} name="" size={compact ? 30 : 34} />
        </span>
        <span className="relative min-w-0 flex-1 truncate">
          {e.nickname}
          {e.isYou && <span className="ml-2 text-xs font-bold">YOU</span>}
        </span>
        <span className="relative font-semibold tabular-nums">
          {fmtInt(e.score)}
          {!compact && " pts"}
        </span>
        {/* inline expand only (phones, the home widget): the panel beside the list shows it on wide pages */}
        {!onSelect && (
          <Icon
            name="chevronDown"
            className={`relative size-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
          />
        )}
      </button>
      <AnimatePresence initial={false}>
        {open && !onSelect && (
          <motion.div
            id={id}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <Breakdown scope={scope} userId={e.playerId} />
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

export function Leaderboard({
  title,
  sponsor,
  entries,
  href,
}: {
  title: string;
  sponsor?: string;
  entries: SiteLeaderboardEntry[];
  href: string;
}) {
  const max = Math.max(1, ...entries.map((e) => e.score));
  return (
    <SectionCard
      title={title}
      action={
        sponsor && (
          <span className="flex items-center gap-1.5 text-[11px] text-muted">
            Sponsored by <span className="font-bold tracking-wide text-top4 uppercase">{sponsor}</span>
          </span>
        )
      }
      bodyClassName="p-3"
    >
      <ol className="flex flex-col gap-1">
        {entries.map((e) => (
          <BoardRow key={e.playerId} e={e} max={max} scope="weekly" compact />
        ))}
      </ol>
      <p className="mt-2 px-2 text-right">
        <ActionLink href={href}>
          View full leaderboard <Icon name="arrowRight" className="size-4" />
        </ActionLink>
      </p>
    </SectionCard>
  );
}
