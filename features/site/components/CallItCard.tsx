import { AnimatePresence, motion } from "motion/react";
import { CountdownRing } from "./CountdownRing";
import { Icon } from "./Icon";
import { AiLabel } from "./AiLabel";
import { Pill } from "./SectionCard";
import type { CallItView } from "./use-call-it";
import { fmtClock } from "../format";
import { NAMES } from "@/shared/copy/names";

/**
 * each state sets its own border, background and text: the button's base has no background, so
 * no two background utilities ever compete (the old base bg-surface beat the state's fill in the
 * built css, and a picked answer turned white on white). contrast is 4.5:1 or more in each state
 */
export function optionClass(view: Pick<CallItView, "phase" | "picked" | "correctOptionId">, id: string): string {
  const { phase, picked, correctOptionId } = view;
  const mine = picked === id;
  if (phase === "revealed") {
    if (id === correctOptionId) return "border-2 border-good bg-good-soft text-ink";
    if (mine) return "border-2 border-bad bg-surface text-bad line-through decoration-2";
    return "border-line bg-surface text-muted";
  }
  if (phase === "cancelled") return "border-line bg-surface text-muted";
  // your answer: kaleva red, white text, until it is revealed
  if (mine) return "border-accent bg-accent text-accent-ink";
  if (phase === "locked" || picked) return "border-line bg-surface text-muted";
  return "border-line bg-surface text-ink hover:border-ink hover:bg-surface-2";
}

/** the icon an option carries: your pick (check while open, lock once locked), right, or wrong */
function optionIcon(view: Pick<CallItView, "phase" | "picked" | "correctOptionId">, id: string): "check" | "lock" | "close" | null {
  const { phase, picked, correctOptionId } = view;
  if (phase === "revealed") return id === correctOptionId ? "check" : id === picked ? "close" : null;
  if (picked !== id || phase === "cancelled") return null;
  return phase === "locked" ? "lock" : "check";
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

/** "8 of 12 have answered": counts only while the question is open, never the split */
function AnswerCount({ answered, display }: { answered: { count: number; of: number }; display: boolean }) {
  const share = answered.of ? Math.min(100, Math.round((100 * answered.count) / answered.of)) : 0;
  return (
    <div className={display ? "text-lg" : "text-xs"} aria-live="polite">
      <p className="flex items-center justify-between font-semibold">
        <span>
          <span className="tabular-nums">{answered.count}</span> of <span className="tabular-nums">{answered.of}</span> {answered.count === 1 ? "has" : "have"} answered
        </span>
        {!display && <span className="text-muted">Split shows when answers lock</span>}
      </p>
      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-surface-2">
        <motion.span className="block h-full rounded-full bg-accent" initial={false} animate={{ width: `${share}%` }} transition={{ duration: 0.4 }} />
      </span>
    </div>
  );
}

/** the question, options, countdown and result. display (tv mode) shows the crowd but no buttons */
function CallBody({ view, display = false, answered = null }: { view: CallItView; display?: boolean; answered?: { count: number; of: number } | null }) {
  const { phase, picked, secondsLeft, options: opts, split } = view;
  const open = phase === "open";
  return (
    <div className={`flex flex-col gap-4 p-5 ${open ? "bg-gradient-to-b from-live-soft to-surface" : "bg-gradient-to-b from-surface-2 to-surface"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`font-bold ${display ? "text-3xl" : "text-lg"}`}>{view.question}</p>
          <p className="mt-0.5 text-xs text-muted">{view.subtitle}</p>
        </div>
        <CountdownRing seconds={secondsLeft} total={view.totalSeconds} size={display ? 112 : open ? 76 : 56} />
      </div>
      {view.stakesLine && <p className={`rounded-lg bg-surface/80 px-3 py-2 font-medium ${display ? "text-lg" : "text-sm"}`}>{view.stakesLine}</p>}
      {!display && view.id && <AiLabel label={{ kind: "call", wording: view.wording }} report={view.wording === "ai" ? { refKind: "call", refKey: view.id } : null} />}

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
              {optionIcon(view, o.id) && <Icon name={optionIcon(view, o.id)!} className={`relative size-4 ${optionIcon(view, o.id) === "check" && phase === "revealed" ? "text-good" : ""}`} />}
              <span className="relative">{o.label}</span>
              {share !== undefined && phase !== "open" && <span className="relative font-normal tabular-nums">{share}%</span>}
            </>
          );
          const cls = `relative flex min-h-11 items-center justify-center gap-1.5 overflow-hidden rounded-lg border px-3 py-2.5 font-semibold transition-colors ${
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
              {picked === o.id && phase !== "revealed" && <span className="sr-only">{phase === "open" ? ", your answer" : ", locked"}</span>}
            </motion.button>
          );
        })}
      </div>

      {answered && answered.of > 0 && phase === "open" && <AnswerCount answered={answered} display={display} />}

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
 * the your call! card. impossible to miss while a question is open: red border, tinted background,
 * a ring and glow that pulse (static with reduced motion), an "OPEN NOW" badge and a big countdown.
 * idle it keeps a red accent bar. with sheet on, phones get a sticky bottom sheet ("Question open ·
 * 00:18") that the page opens when a question arrives. view null = no question
 */
export function CallItCard({
  view,
  sheet = false,
  sheetOpen = false,
  onSheetOpenChange,
  id,
  waitingText = "Next question soon",
  lastCall = null,
  points = 20,
  display = false,
  answered = null,
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
  /** "8 of 12 have answered" while the question is open */
  answered?: { count: number; of: number } | null;
}) {
  const open = view?.phase === "open";
  const header = (
    <header className="flex items-center justify-between border-b border-line px-5 py-4">
      <h2 className={`flex items-center gap-1.5 font-semibold ${display ? "text-2xl" : "text-[17px]"}`}>
        <Icon name="target" className={`size-5 ${open ? "text-live" : "text-accent"}`} />
        {NAMES.call}
        {open && <span className="ml-1 rounded-md bg-live px-2 py-0.5 text-[11px] font-bold tracking-wider text-live-ink">OPEN NOW</span>}
      </h2>
      <Pill tone="accent">+{view?.points ?? points} pts if right</Pill>
    </header>
  );
  const body = view ? <CallBody view={view} display={display} answered={answered} /> : <Waiting text={waitingText} lastCall={lastCall} />;
  const frame = open ? "feature-active" : "feature-idle";

  if (!sheet) {
    return (
      <section id={id} aria-live={display ? "polite" : undefined} className={`scroll-mt-28 overflow-hidden rounded-card ${frame}`}>
        {header}
        {body}
      </section>
    );
  }

  return (
    <section
      id={id}
      className={`scroll-mt-28 max-md:fixed max-md:inset-x-0 max-md:bottom-14 max-md:z-30 md:overflow-hidden md:rounded-card ${open ? "md:feature-active" : "md:feature-idle"}`}
    >
      <button
        type="button"
        className={`flex w-full items-center justify-between rounded-t-card px-4 py-3 text-sm font-semibold md:hidden ${open ? "bg-live text-live-ink" : "bg-dark text-dark-ink"}`}
        aria-expanded={sheetOpen}
        onClick={() => onSheetOpenChange?.(!sheetOpen)}
      >
        <span className="flex items-center gap-2">
          <Icon name="target" className="size-4" />
          {open ? (
            <>
              Question open · <span className="tabular-nums">{fmtClock(view.secondsLeft)}</span>
            </>
          ) : view ? (
            `${NAMES.call} · locked`
          ) : (
            `${NAMES.call} · next question soon`
          )}
        </span>
        <Icon name="chevronDown" className={`size-4 transition-transform ${sheetOpen ? "" : "rotate-180"}`} />
      </button>
      <div className={`max-md:max-h-[70vh] max-md:overflow-y-auto max-md:border-t max-md:border-line ${open ? "max-md:bg-live-soft" : "max-md:bg-surface"} ${sheetOpen ? "" : "max-md:hidden"}`}>
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
      className="sticky top-16 z-30 flex w-full items-center justify-center gap-2 bg-live px-4 py-2 text-sm font-semibold text-live-ink"
    >
      <Icon name="target" className="size-4" />
      <span className="shrink-0 rounded bg-live-ink/15 px-1.5 py-0.5 text-[11px] tracking-wider whitespace-nowrap">NEW QUESTION</span>
      <span className="truncate">{view.question}</span>
      <span className="shrink-0 tabular-nums whitespace-nowrap">· {fmtClock(view.secondsLeft)}</span>
      <span className="hidden underline underline-offset-2 sm:inline">· Answer now</span>
    </button>
  );
}
