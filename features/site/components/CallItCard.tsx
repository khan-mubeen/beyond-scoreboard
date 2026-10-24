import { AnimatePresence, motion } from "motion/react";
import { CountdownRing } from "./CountdownRing";
import { Icon } from "./Icon";
import { Pill } from "./SectionCard";
import type { CallItView } from "./use-call-it";
import { fmtClock } from "../format";

function optionClass(view: CallItView, id: string): string {
  const { phase, picked, correctOptionId } = view;
  if (phase === "revealed") {
    if (id === correctOptionId) return "border-good bg-good-soft text-good";
    if (id === picked) return "border-bad bg-accent-soft text-bad";
    return "border-line opacity-60";
  }
  if (phase === "cancelled") return "border-line opacity-50";
  if (phase === "locked") return id === picked ? "border-ink bg-ink text-surface" : "border-line opacity-50";
  return "border-line hover:border-ink";
}

function resultText(view: CallItView): string {
  const { phase, picked, correctOptionId, options, points } = view;
  const label = (id: string | null) => options.find((o) => o.id === id)?.label ?? "";
  if (phase === "cancelled") return "Call cancelled — no points (the play happened while answers were open).";
  if (phase === "locked") return picked ? `Locked in: ${label(picked)}. Waiting for the result.` : "Answers are locked. Waiting for the result.";
  if (phase !== "revealed") return "";
  const correct = label(correctOptionId);
  if (!picked) return `The answer was ${correct}.`;
  return picked === correctOptionId ? `You got it! +${points} pts` : `Not this time — the answer was ${correct}.`;
}

/** the question, options, countdown and result. display (tv mode) shows the crowd but no buttons */
function CallBody({ view, display = false }: { view: CallItView; display?: boolean }) {
  const { phase, picked, secondsLeft, options: opts, split } = view;
  const open = phase === "open";
  return (
    <div className={`flex flex-col gap-4 p-5 ${open ? "bg-gradient-to-b from-accent-soft to-surface" : "bg-gradient-to-b from-accent-soft/40 to-surface"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`font-bold ${display ? "text-3xl" : "text-lg"}`}>{view.question}</p>
          <p className="mt-0.5 text-xs text-muted">{view.subtitle}</p>
        </div>
        <CountdownRing seconds={secondsLeft} total={view.totalSeconds} size={display ? 112 : open ? 76 : 56} />
      </div>
      {view.stakesLine && <p className={`rounded-lg bg-surface/80 px-3 py-2 font-medium ${display ? "text-lg" : "text-sm"}`}>{view.stakesLine}</p>}

      <div className="grid grid-cols-2 gap-2">
        {opts.map((o, i) => {
          const share = split?.[o.id];
          const wide = opts.length % 2 === 1 && i === opts.length - 1 ? "col-span-2" : "";
          const content = (
            <>
              {share !== undefined && phase !== "open" && (
                <motion.span
                  aria-hidden
                  className="absolute inset-y-0 left-0 bg-current opacity-10"
                  initial={{ width: 0 }}
                  animate={{ width: `${share}%` }}
                  transition={{ duration: 0.6 }}
                />
              )}
              {!display && (phase === "locked" || (phase === "open" && picked)) && picked === o.id && <Icon name="lock" className="size-3.5" />}
              {phase === "revealed" && o.id === view.correctOptionId && <Icon name="check" className="size-4" />}
              <span className="relative">{o.label}</span>
              {share !== undefined && phase !== "open" && <span className="relative font-normal tabular-nums">{share}%</span>}
            </>
          );
          const cls = `relative flex min-h-11 items-center justify-center gap-1.5 overflow-hidden rounded-lg border bg-surface px-3 py-2.5 font-semibold transition-colors ${
            display ? "text-xl" : "text-sm"
          } ${wide} ${optionClass(view, o.id)}`;
          return display ? (
            <div key={o.id} className={cls}>
              {content}
            </div>
          ) : (
            <motion.button
              key={o.id}
              type="button"
              layout
              disabled={phase !== "open" || !!picked}
              aria-pressed={picked === o.id}
              onClick={() => view.pick(o.id)}
              whileTap={{ scale: 0.97 }}
              className={cls}
            >
              {content}
              {picked === o.id && phase !== "revealed" && <span className="sr-only">, locked</span>}
            </motion.button>
          );
        })}
      </div>

      {!display && (
        <p aria-live="polite" className="min-h-5 text-sm font-semibold">
          <AnimatePresence mode="wait">
            {(phase !== "open" || picked || view.error) && (
              <motion.span
                key={`${phase}-${picked}-${view.error}`}
                className={`block ${phase === "revealed" ? (picked === view.correctOptionId ? "text-good" : "text-bad") : view.error ? "text-bad" : ""}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                {(phase === "locked" || (phase === "open" && picked)) && (
                  <Pill tone="outline" className="mr-2">
                    Locked in
                  </Pill>
                )}
                {view.error ?? (phase === "open" && picked ? `Locked in: ${opts.find((o) => o.id === picked)?.label}.` : resultText(view))}
              </motion.span>
            )}
          </AnimatePresence>
        </p>
      )}

      {view.lastCall && (
        <p className="rounded-lg border border-line bg-surface px-3 py-2 text-xs text-muted">
          Last call: <span className="font-semibold text-ink">{view.lastCall.text}</span>{" "}
          {view.lastCall.correct && <Icon name="check" className="inline size-3.5 text-good" label="correct" />}
        </p>
      )}
    </div>
  );
}

/** no open call: one compact line, and the last result */
function Waiting({ text, lastCall }: { text: string; lastCall: CallItView["lastCall"] }) {
  return (
    <div className="flex flex-col gap-2 px-5 py-4 text-sm">
      <p className="flex items-center gap-2 text-muted">
        <span aria-hidden className="size-2 rounded-full bg-muted/50" />
        {text}
      </p>
      {lastCall && (
        <p className="rounded-lg border border-line bg-surface px-3 py-2 text-xs text-muted">
          Last call: <span className="font-semibold text-ink">{lastCall.text}</span>
        </p>
      )}
    </div>
  );
}

/**
 * call it! card. impossible to miss while a call is open: red border, a glow pulse (static with
 * reduced motion), a "LIVE CALL" badge and a big countdown. with sheet on, phones get a sticky
 * bottom sheet ("Call It! · 00:18") that the page opens when a call arrives. view null = no call
 */
export function CallItCard({
  view,
  sheet = false,
  sheetOpen = false,
  onSheetOpenChange,
  id,
  waitingText = "Next call coming soon",
  lastCall = null,
  points = 20,
  display = false,
}: {
  view: CallItView | null;
  sheet?: boolean;
  sheetOpen?: boolean;
  onSheetOpenChange?: (open: boolean) => void;
  id?: string;
  waitingText?: string;
  lastCall?: CallItView["lastCall"];
  points?: number;
  /** tv mode: big, no answer buttons */
  display?: boolean;
}) {
  const open = view?.phase === "open";
  const header = (
    <header className="flex items-center justify-between border-b border-line px-5 py-4">
      <h2 className={`flex items-center gap-1.5 font-semibold ${display ? "text-2xl" : "text-[17px]"}`}>
        <Icon name="sparkle" className="size-4" />
        Call It!
        {open && <span className="ml-1 rounded-md bg-accent px-2 py-0.5 text-[11px] font-bold tracking-wider text-accent-ink">LIVE CALL</span>}
      </h2>
      <Pill tone="accent">+{view?.points ?? points} pts</Pill>
    </header>
  );
  const body = view ? <CallBody view={view} display={display} /> : <Waiting text={waitingText} lastCall={lastCall} />;
  const frame = open ? "border-2 border-accent call-glow" : "border border-line shadow-card";

  if (!sheet) {
    return (
      <section id={id} aria-live={display ? "polite" : undefined} className={`scroll-mt-28 overflow-hidden rounded-card bg-surface ${frame}`}>
        {header}
        {body}
      </section>
    );
  }

  return (
    <section
      id={id}
      className={`scroll-mt-28 max-md:fixed max-md:inset-x-0 max-md:bottom-14 max-md:z-30 md:overflow-hidden md:rounded-card md:bg-surface ${
        open ? "md:border-2 md:border-accent md:call-glow" : "md:border md:border-line md:shadow-card"
      }`}
    >
      <button
        type="button"
        className={`flex w-full items-center justify-between rounded-t-card px-4 py-3 text-sm font-semibold md:hidden ${open ? "bg-accent text-accent-ink" : "bg-dark text-dark-ink"}`}
        aria-expanded={sheetOpen}
        onClick={() => onSheetOpenChange?.(!sheetOpen)}
      >
        <span className="flex items-center gap-2">
          <Icon name="sparkle" className="size-4" />
          {open ? (
            <>
              Live call · <span className="tabular-nums">{fmtClock(view.secondsLeft)}</span>
            </>
          ) : view ? (
            "Call It! · locked"
          ) : (
            "Call It! · next call coming soon"
          )}
        </span>
        <Icon name="chevronDown" className={`size-4 transition-transform ${sheetOpen ? "" : "rotate-180"}`} />
      </button>
      <div className={`max-md:max-h-[70vh] max-md:overflow-y-auto max-md:border-t max-md:border-line max-md:bg-surface ${sheetOpen ? "" : "max-md:hidden"}`}>
        <div className="max-md:hidden">{header}</div>
        {body}
      </div>
    </section>
  );
}

/** a slim bar under the top nav while a call is open and unanswered; tapping it jumps to the card */
export function CallBanner({ view, onGo }: { view: CallItView; onGo: () => void }) {
  return (
    <button
      type="button"
      onClick={onGo}
      className="sticky top-16 z-30 flex w-full items-center justify-center gap-2 bg-accent px-4 py-2 text-sm font-semibold text-accent-ink"
    >
      <span className="rounded bg-accent-ink/15 px-1.5 py-0.5 text-[11px] tracking-wider">NEW CALL</span>
      <span className="truncate">{view.question}</span>
      <span className="tabular-nums">· {fmtClock(view.secondsLeft)}</span>
      <span className="hidden underline underline-offset-2 sm:inline">· Answer now</span>
    </button>
  );
}
