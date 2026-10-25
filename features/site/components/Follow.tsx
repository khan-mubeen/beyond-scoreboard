import type { ReactNode } from "react";
import type { MyCallRow, MyCallStatus } from "@/shared/types";
import { followTeam, useMe } from "../data";
import { Icon } from "./Icon";
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

const STATUS: Record<MyCallStatus, { label: string; tone: "accent" | "good" | "neutral" | "outline" }> = {
  open: { label: "Open", tone: "accent" },
  locked: { label: "Locked", tone: "outline" },
  won: { label: "Won", tone: "good" },
  missed: { label: "Missed", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

/** a list of the fan's calls, each linking to its match */
export function CallsList({ calls, empty, bare = false }: { calls: MyCallRow[]; empty: ReactNode; bare?: boolean }) {
  // bare: inside a card that has its own frame (and title)
  const frame = bare ? "" : "rounded-card border border-line bg-surface shadow-card";
  if (!calls.length) return <div className={`p-6 text-center text-muted ${frame}`}>{empty}</div>;
  return (
    <ul className={`flex flex-col divide-y divide-line overflow-hidden ${frame}`}>
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
