import type { SiteLeaderboardEntry } from "@/shared/types";
import { fmtInt } from "../format";
import { Icon } from "./Icon";
import { ActionLink, SectionCard } from "./SectionCard";
import { Avatar } from "./TeamLogo";

const MEDAL = ["bg-highlight text-gold", "bg-surface-2 text-ink", "bg-accent-soft text-accent"];

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
          <li
            key={e.playerId}
            className={`flex items-center gap-3 rounded-lg px-2 py-1.5 ${e.isYou ? "bg-surface-2 font-semibold" : ""}`}
          >
            <span
              className={`grid size-7 place-items-center rounded-full text-sm tabular-nums ${MEDAL[e.rank - 1] ?? "text-muted"}`}
            >
              {e.rank}.
            </span>
            <Avatar src={e.avatar} name="" size={34} />
            <span className="min-w-0 flex-1 truncate text-[15px]">
              {e.nickname}
              {e.isYou && <span className="sr-only"> (you)</span>}
            </span>
            <span className="font-semibold tabular-nums">{fmtInt(e.score)}</span>
          </li>
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
