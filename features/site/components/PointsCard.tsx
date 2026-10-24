import type { RewardsPage, UserSummary } from "@/shared/types";
import { fmtInt } from "../format";
import { Icon, type IconName } from "./Icon";
import { useCountUp } from "./use-count-up";

function LevelBar({ user, className = "" }: { user: UserSummary; className?: string }) {
  return (
    <div
      className={`h-2 overflow-hidden rounded-full bg-surface-2 ${className}`}
      role="progressbar"
      aria-label={`Level ${user.level} progress`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(user.levelProgress * 100)}
    >
      <div className="h-full rounded-full bg-accent" style={{ width: `${user.levelProgress * 100}%` }} />
    </div>
  );
}

const levelText = (u: UserSummary) => `Level ${u.level} · ${fmtInt(u.pointsToNextLevel)} pts to Level ${u.level + 1}`;

/** total points, this week, level bar. the numbers count up when points land. compact is the rewards sidebar version */
export function PointsCard({ user, compact = false }: { user: UserSummary; compact?: boolean }) {
  const points = useCountUp(user.points);
  const week = useCountUp(user.pointsThisWeek);
  return (
    <div className="rounded-card border border-line bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Total Points</p>
          <p className="mt-1 flex items-center gap-2 text-[30px] leading-none font-bold tabular-nums" aria-live="polite">
            {!compact && <Icon name="trophy" className="size-7 text-gold" />}
            {fmtInt(points)}
          </p>
        </div>
        {compact ? (
          <p className="mt-7 text-sm font-semibold text-good tabular-nums">+{fmtInt(week)} this week</p>
        ) : (
          <div className="border-l border-line pl-4">
            <p className="flex items-center gap-1 text-lg font-semibold text-accent tabular-nums">
              <Icon name="chart" className="size-5" />+{fmtInt(week)}
            </p>
            <p className="text-sm text-muted">this week</p>
          </div>
        )}
      </div>
      <p className="mt-4 text-sm">
        <span className="font-semibold">Level {user.level}</span>
        <span className="text-muted">
          {" "}
          · {fmtInt(user.pointsToNextLevel)} pts to Level {user.level + 1}
        </span>
      </p>
      <LevelBar user={user} className="mt-2" />
    </div>
  );
}

const EARN_ICON: Record<RewardsPage["earnChips"][number]["icon"], IconName> = {
  call: "sparkle",
  story: "story",
  watch: "users",
};

/** the big balance card at the top of rewards */
export function PointsBalanceCard({ user, earnChips }: { user: UserSummary; earnChips: RewardsPage["earnChips"] }) {
  const points = useCountUp(user.points);
  return (
    <section
      aria-labelledby="balance-title"
      className="flex flex-col gap-5 rounded-card border border-line bg-gradient-to-r from-surface to-accent-soft p-5 shadow-card md:flex-row md:items-center md:justify-between"
    >
      <div className="min-w-0">
        <h2 id="balance-title" className="text-xs font-semibold tracking-wider text-muted uppercase">
          Your points balance
        </h2>
        <p className="mt-3 flex items-baseline gap-2">
          <span className="text-[40px] leading-none font-bold tabular-nums">{fmtInt(points)}</span>
          <span className="font-semibold text-muted">points</span>
        </p>
        <p className="mt-2 text-sm">{levelText(user)}</p>
        <LevelBar user={user} className="mt-3 w-full max-w-60" />
      </div>
      <ul className="flex flex-wrap gap-2" aria-label="Ways to earn points">
        {earnChips.map((c) => (
          <li
            key={c.label}
            className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold"
          >
            <Icon name={EARN_ICON[c.icon]} className="size-3.5" />
            {c.label}
          </li>
        ))}
      </ul>
    </section>
  );
}
