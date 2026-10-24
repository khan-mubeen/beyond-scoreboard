import type { StakesStripItem } from "@/shared/types";
import { Icon } from "./Icon";
import { TeamLogo } from "./TeamLogo";

/** today's games that matter most for the table */
export function SeasonStakesStrip({ title, items }: { title: string; items: StakesStripItem[] }) {
  return (
    <section aria-labelledby="stakes-strip" className="rounded-card border border-line bg-surface p-4 shadow-card">
      <h2 id="stakes-strip" className="text-[17px] font-semibold">
        {title}
      </h2>
      <ul className="mt-3 grid gap-3 md:grid-cols-3">
        {items.map((it) => (
          <li key={it.id}>
            <a
              href={it.href}
              className="flex h-full items-center gap-3 rounded-lg border border-line p-3 transition-colors hover:border-muted/40"
            >
              <span className="flex shrink-0 -space-x-1.5">
                <TeamLogo team={it.home} size={30} className="ring-2 ring-surface" />
                <TeamLogo team={it.away} size={30} className="ring-2 ring-surface" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">
                  {it.home.name} – {it.away.name}
                </span>
                <span className="block text-xs text-muted">{it.line}</span>
              </span>
              <Icon name="chevronRight" className="size-4 text-muted" />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
