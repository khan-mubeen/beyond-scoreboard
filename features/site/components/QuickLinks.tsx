import type { QuickLink } from "@/shared/types";
import { Icon } from "./Icon";

export function QuickLinks({
  links,
  activeId,
  title = "Quick Links",
  boxed = true,
}: {
  links: QuickLink[];
  activeId?: string;
  title?: string | null;
  boxed?: boolean;
}) {
  return (
    <nav
      aria-label={title ?? "Quick links"}
      className={boxed ? "rounded-card border border-line bg-surface p-4 shadow-card" : ""}
    >
      {title && <h2 className="mb-3 text-[15px] font-semibold">{title}</h2>}
      <ul className="flex flex-col gap-1">
        {links.map((l) => {
          const active = l.id === activeId;
          return (
            <li key={l.id}>
              <a
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg border-l-[3px] px-3 py-2.5 text-[15px] transition-colors ${
                  active
                    ? "border-accent bg-accent-soft font-semibold text-accent"
                    : "border-transparent hover:bg-surface-2"
                }`}
              >
                <Icon name={l.icon} className="size-5" />
                {l.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
