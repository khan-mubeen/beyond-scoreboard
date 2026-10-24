import { AnimatePresence, motion } from "motion/react";
import { CountdownRing } from "./CountdownRing";
import { Icon } from "./Icon";
import { Pill } from "./SectionCard";
import type { CallItView } from "./use-call-it";
import { fmtClock } from "../format";

function optionClass(view: CallItView, id: string): string {
  const { phase, picked, data } = view;
  if (phase === "revealed") {
    if (id === data.result.correctOptionId) return "border-good bg-good-soft text-good";
    if (id === picked) return "border-bad bg-accent-soft text-bad";
    return "border-line opacity-60";
  }
  if (phase === "locked") return id === picked ? "border-ink bg-ink text-surface" : "border-line opacity-50";
  return "border-line hover:border-ink";
}

function resultText(view: CallItView): string {
  const { phase, picked, data } = view;
  const label = (id: string | null) => data.call.options.find((o) => o.id === id)?.label ?? "";
  if (phase === "locked") return `Locked in: ${label(picked)}. The result shows when the timer ends.`;
  if (phase !== "revealed") return "";
  const correct = label(data.result.correctOptionId);
  if (!picked) return `Time's up. The answer was ${correct}.`;
  return picked === data.result.correctOptionId
    ? `You called it! +${data.points} pts`
    : `Not this time. The answer was ${correct}.`;
}

function CallBody({ view }: { view: CallItView }) {
  const { data, phase, picked, secondsLeft } = view;
  const opts = data.call.options;
  return (
    <div className="flex flex-col gap-4 bg-gradient-to-b from-accent-soft/50 to-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-bold">{data.call.question}</p>
          <p className="mt-0.5 text-xs text-muted">{data.subtitle}</p>
        </div>
        <CountdownRing seconds={secondsLeft} total={data.secondsLeft} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {opts.map((o, i) => {
          const share = data.result.split[o.id];
          return (
            <motion.button
              key={o.id}
              type="button"
              layout
              disabled={phase !== "open"}
              aria-pressed={picked === o.id}
              onClick={() => view.pick(o.id)}
              whileTap={{ scale: 0.97 }}
              className={`relative flex min-h-11 items-center justify-center gap-1.5 overflow-hidden rounded-lg border bg-surface px-3 py-2.5 text-sm font-semibold transition-colors ${
                opts.length % 2 === 1 && i === opts.length - 1 ? "col-span-2" : ""
              } ${optionClass(view, o.id)}`}
            >
              {phase === "revealed" && share !== undefined && (
                <motion.span
                  aria-hidden
                  className="absolute inset-y-0 left-0 bg-current opacity-10"
                  initial={{ width: 0 }}
                  animate={{ width: `${share}%` }}
                  transition={{ duration: 0.6 }}
                />
              )}
              {phase === "locked" && picked === o.id && <Icon name="lock" className="size-3.5" />}
              {phase === "revealed" && o.id === data.result.correctOptionId && <Icon name="check" className="size-4" />}
              <span className="relative">{o.label}</span>
              {phase === "revealed" && share !== undefined && (
                <span className="relative font-normal tabular-nums">{share}%</span>
              )}
              {phase === "locked" && picked === o.id && <span className="sr-only">, locked</span>}
            </motion.button>
          );
        })}
      </div>

      <p aria-live="polite" className="min-h-5 text-sm font-semibold">
        <AnimatePresence mode="wait">
          {phase !== "open" && (
            <motion.span
              key={phase}
              className={`block ${phase === "revealed" ? (picked === data.result.correctOptionId ? "text-good" : "text-bad") : ""}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {phase === "locked" && (
                <Pill tone="outline" className="mr-2">
                  Locked
                </Pill>
              )}
              {resultText(view)}
            </motion.span>
          )}
        </AnimatePresence>
      </p>

      {data.call.stakesLine && <p className="-mt-2 text-sm text-muted">{data.call.stakesLine}</p>}
      <p className="rounded-lg border border-line bg-surface px-3 py-2 text-xs text-muted">
        Last call: <span className="font-semibold text-ink">{data.lastCall.text}</span>{" "}
        {data.lastCall.correct && <Icon name="check" className="inline size-3.5 text-good" label="correct" />}
      </p>
    </div>
  );
}

/**
 * call it! card. with sheet on, phones get a sticky bottom sheet:
 * a collapsed bar ("Call It! · 00:42") that expands on tap
 */
export function CallItCard({
  view,
  sheet = false,
  sheetOpen = false,
  onSheetOpenChange,
  id,
}: {
  view: CallItView;
  sheet?: boolean;
  sheetOpen?: boolean;
  onSheetOpenChange?: (open: boolean) => void;
  id?: string;
}) {
  const header = (
    <header className="flex items-center justify-between border-b border-line px-5 py-4">
      <h2 className="flex items-center gap-1.5 text-[17px] font-semibold">
        <Icon name="sparkle" className="size-4" />
        Call It!
      </h2>
      <Pill tone="accent">+{view.data.points} pts</Pill>
    </header>
  );

  if (!sheet) {
    return (
      <section id={id} className="scroll-mt-20 overflow-hidden rounded-card border border-line bg-surface shadow-card">
        {header}
        <CallBody view={view} />
      </section>
    );
  }

  return (
    <section
      id={id}
      className="scroll-mt-20 max-md:fixed max-md:inset-x-0 max-md:bottom-14 max-md:z-30 md:overflow-hidden md:rounded-card md:border md:border-line md:bg-surface md:shadow-card"
    >
      <button
        type="button"
        className="flex w-full items-center justify-between rounded-t-card bg-dark px-4 py-3 text-sm font-semibold text-dark-ink md:hidden"
        aria-expanded={sheetOpen}
        onClick={() => onSheetOpenChange?.(!sheetOpen)}
      >
        <span className="flex items-center gap-2">
          <Icon name="sparkle" className="size-4" />
          Call It! · <span className="tabular-nums">{fmtClock(view.secondsLeft)}</span>
        </span>
        <Icon name="chevronDown" className={`size-4 transition-transform ${sheetOpen ? "" : "rotate-180"}`} />
      </button>
      <div
        className={`max-md:max-h-[70vh] max-md:overflow-y-auto max-md:border-t max-md:border-line max-md:bg-surface ${sheetOpen ? "" : "max-md:hidden"}`}
      >
        <div className="max-md:hidden">{header}</div>
        <CallBody view={view} />
      </div>
    </section>
  );
}
