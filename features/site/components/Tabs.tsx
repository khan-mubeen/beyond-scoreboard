import { motion } from "motion/react";
import { type KeyboardEvent, useRef } from "react";

export interface TabItem<T extends string> {
  id: T;
  label: string;
}

/** underline tabs. scroll sideways on small screens, arrow keys move between tabs */
export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  label,
  idPrefix,
}: {
  tabs: TabItem<T>[];
  active: T;
  onChange: (id: T) => void;
  label: string;
  idPrefix: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKey(e: KeyboardEvent, i: number) {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + tabs.length) % tabs.length;
    refs.current[next]?.focus();
    onChange(tabs[next].id);
  }

  return (
    <div className="no-scrollbar -mx-4 overflow-x-auto border-b border-line px-4 md:mx-0 md:px-0" id={`${idPrefix}-tabs`}>
      <div role="tablist" aria-label={label} className="flex min-w-max gap-1">
        {tabs.map((t, i) => {
          const on = t.id === active;
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              role="tab"
              type="button"
              id={`${idPrefix}-tab-${t.id}`}
              aria-selected={on}
              aria-controls={`${idPrefix}-panel`}
              tabIndex={on ? 0 : -1}
              onClick={() => onChange(t.id)}
              onKeyDown={(e) => onKey(e, i)}
              className={`relative px-3 py-3.5 text-sm font-medium whitespace-nowrap ${on ? "text-accent" : "text-muted hover:text-ink"}`}
            >
              {t.label}
              {on && (
                <motion.span
                  layoutId={`${idPrefix}-underline`}
                  className="absolute inset-x-1 -bottom-px h-0.5 bg-accent"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
