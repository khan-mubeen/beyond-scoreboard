import type { AchievementItem, MyCallRow, MyCallStatus } from "@/shared/types";
import { followTeam, useMe } from "../data";
import { Icon, type IconName } from "./Icon";
import { Pill } from "./SectionCard";
import { toast } from "./Toast";

/** the follow star: changes at once (optimistic), the server confirms */
export function FollowButton({ teamId, name, compact = false }: { teamId: string; name: string; compact?: boolean }) {
  const me = useMe().data;
  const followed = !!me?.follows.includes(teamId);
  async function flip() {
    const res = await followTeam(teamId, !followed);
    if (!res.ok) toast(res.error, { tone: "bad" });
    else if (!followed) toast(`Following ${name}`);
  }
  return (
    <button
      type="button"
      onClick={() => void flip()}
      aria-pressed={followed}
      aria-label={followed ? `Unfollow ${name}` : `Follow ${name}`}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border font-semibold transition-colors ${
        followed ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:text-ink"
      } ${compact ? "p-2" : "px-3 py-1.5 text-sm"}`}
    >
      <Icon name="star" className="size-4" />
      {!compact && (followed ? "Following" : "Follow")}
    </button>
  );
}

const BADGE_ICON: Record<AchievementItem["icon"], IconName> = { star: "star", bolt: "bolt", rook: "rook" };

export function AchievementCard({ a }: { a: AchievementItem }) {
  return (
    <article className={`flex items-center gap-3 rounded-card border p-4 shadow-card ${a.unlocked ? "border-accent/40 bg-surface" : "border-line bg-surface-2/50"}`}>
      <span className={`grid size-11 shrink-0 place-items-center rounded-full ${a.unlocked ? "bg-accent-soft text-accent" : "bg-surface-2 text-muted"}`}>
        <Icon name={a.unlocked ? BADGE_ICON[a.icon] : "lock"} className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className={`font-semibold ${a.unlocked ? "" : "text-muted"}`}>{a.title}</h3>
        <p className="text-xs text-muted">{a.description}</p>
        {!a.unlocked && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-label={`${a.title} progress`} aria-valuemin={0} aria-valuemax={a.progress.need} aria-valuenow={a.progress.have}>
            <div className="h-full rounded-full bg-accent" style={{ width: `${(100 * a.progress.have) / a.progress.need}%` }} />
          </div>
        )}
      </div>
      <span className="text-xs font-semibold text-muted tabular-nums">{a.unlocked ? "Unlocked" : `${a.progress.have}/${a.progress.need}`}</span>
    </article>
  );
}

const STATUS: Record<MyCallStatus, { label: string; tone: "accent" | "good" | "neutral" | "outline" }> = {
  open: { label: "Open", tone: "accent" },
  locked: { label: "Locked", tone: "outline" },
  won: { label: "Won", tone: "good" },
  missed: { label: "Missed", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

/** a list of the fan's calls, each linking to its match */
export function CallsList({ calls, empty }: { calls: MyCallRow[]; empty: string }) {
  if (!calls.length) return <p className="rounded-card border border-line bg-surface p-6 text-center text-muted shadow-card">{empty}</p>;
  return (
    <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-card border border-line bg-surface shadow-card">
      {calls.map((c) => (
        <li key={c.callId}>
          <a href={`/match/${c.matchId}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-surface-2">
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-muted">{c.matchTitle}</span>
              <span className="block font-semibold">{c.question}</span>
              <span className="block text-sm text-muted">
                Your call: <span className="text-ink">{c.myAnswer ?? "—"}</span>
                {c.answer && c.status !== "won" && <> · The answer: {c.answer}</>}
              </span>
            </span>
            <span className="flex items-center gap-2">
              {c.points > 0 && <span className="font-semibold text-good tabular-nums">+{c.points} pts</span>}
              <Pill tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Pill>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
