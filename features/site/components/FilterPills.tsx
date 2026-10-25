import { Icon, type IconName } from "./Icon";

export interface FilterOption<T extends string> {
  id: T;
  label: string;
  icon: IconName | "live";
}

/** single-choice pills that filter what's below them */
export function FilterPills<T extends string>({
  options,
  active,
  onChange,
  label,
}: {
  options: FilterOption<T>[];
  active: T;
  onChange: (id: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = o.id === active;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.id)}
            className={`flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors md:px-5 ${
              on ? "bg-accent text-accent-ink" : "bg-surface-2 text-ink hover:bg-line"
            }`}
          >
            {o.icon === "live" ? (
              <span aria-hidden className="size-2.5 rounded-full bg-live" />
            ) : (
              <Icon name={o.icon} className="size-4.5" />
            )}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** the date button. static until the api supplies other days */
export function DateSelect({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="flex h-10 items-center gap-3 rounded-lg border border-line bg-surface px-4 text-sm font-medium shadow-card"
      aria-label={`Date: ${label}`}
    >
      <Icon name="calendar" className="size-4.5" />
      {label}
      <Icon name="chevronDown" className="size-4" />
    </button>
  );
}
