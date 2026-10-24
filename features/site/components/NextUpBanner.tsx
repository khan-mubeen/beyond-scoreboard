import { useState } from "react";
import type { FinishedMatchDetail } from "@/shared/types";
import { Icon } from "./Icon";
import { useToast } from "./Toast";

/** the next match with a reminder toggle. with onToggle the reminder is saved on the server */
export function NextUpBanner({
  next,
  onToggle,
}: {
  next: NonNullable<FinishedMatchDetail["nextUp"]>;
  onToggle?: (on: boolean) => Promise<boolean>;
}) {
  const [set, setSet] = useState(false);
  const toast = useToast();

  async function toggle() {
    const on = !set;
    if (onToggle && !(await onToggle(on))) return toast("Couldn't save the reminder, try again");
    setSet(on);
    toast(on ? `We'll remind you before ${next.title}` : "Reminder removed");
  }

  return (
    <section
      aria-labelledby="next-up"
      className="flex flex-col gap-4 rounded-card border border-accent/20 bg-gradient-to-r from-accent-soft to-surface p-5 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <p className="text-xs font-semibold tracking-wider text-muted uppercase">Next up</p>
        <h2 id="next-up" className="mt-1 text-xl font-bold">
          {next.title}
        </h2>
        <p className="text-sm text-muted">
          {next.when} · {next.worth}
        </p>
      </div>
      <button
        type="button"
        aria-pressed={set}
        onClick={toggle}
        className={`flex h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold transition-colors ${
          set ? "border border-good bg-good-soft text-good" : "bg-accent text-accent-ink hover:brightness-110"
        }`}
      >
        {!set && <Icon name="bell" className="size-4" />}
        {set ? "Reminder set ✓" : "Set reminder"}
      </button>
    </section>
  );
}
