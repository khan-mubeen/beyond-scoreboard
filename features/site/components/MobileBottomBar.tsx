import { Icon, type IconName } from "./Icon";

export interface BottomBarItem<T extends string> {
  id: T;
  label: string;
  icon: IconName;
}

/** sticky bar on phones, each item jumps to its section */
export function MobileBottomBar<T extends string>({
  items,
  onSelect,
}: {
  items: BottomBarItem<T>[];
  onSelect: (id: T) => void;
}) {
  return (
    <nav
      aria-label="Match sections"
      className="fixed inset-x-0 bottom-0 z-40 grid h-14 border-t border-line bg-surface md:hidden"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          onClick={() => onSelect(it.id)}
          className="flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted hover:text-accent"
        >
          <Icon name={it.icon} className="size-5" />
          {it.label}
        </button>
      ))}
    </nav>
  );
}
