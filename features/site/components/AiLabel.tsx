// the honest label under every generated text: where it came from (the real source, never "ai"
// where no ai was used), "Reviewed by a Kaleva editor" only on a text an editor approved, an info
// popover ("how we use ai", the /sports/ai page) and "report a mistake"
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { TextOrigin } from "@/shared/types";
import { reportMistakeApi } from "../data";
import { Icon } from "./Icon";
import { Modal } from "./Modal";
import { toast } from "./Toast";

export type AiLabelKind =
  | { kind: "text"; origin: TextOrigin | null | undefined }
  | { kind: "call"; wording: "ai" | "auto" | undefined }
  | { kind: "data" }
  | { kind: "audio"; ai: boolean };

/** the label's words, from the real source */
export function aiLabelText(l: AiLabelKind): string {
  switch (l.kind) {
    case "text":
      return l.origin?.source === "ai" ? "AI-written · facts checked against Liiga data" : "Written from match data";
    case "call":
      return l.wording === "ai" ? "Question wording by AI · answers decided by Liiga data" : "Automatic question from live data";
    case "data":
      return "From Liiga data";
    case "audio":
      return l.ai ? "AI voice (Azure)" : "Device voice";
  }
}

export const HOW_WE_USE_AI = [
  "AI writes wording and stories: match stories, summaries and question wordings.",
  "A prediction model calculates the chances (playoffs, top 4, relegation) from the league table and the schedule.",
  "AI never decides answers or points, and never invents numbers: every number comes from Liiga data and passes our validator.",
  "Kaleva editors review AI stories before they are shown.",
  "Fans can report mistakes, and editors read every report.",
];

/** "How we use AI" in a small popover */
function HowWeUseAi() {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  return (
    <span ref={box} className="relative inline-flex">
      <button type="button" aria-expanded={open} aria-label="How we use AI" onClick={() => setOpen((o) => !o)} className="grid size-5 place-items-center rounded-full text-muted hover:text-ink">
        <Icon name="info" className="size-3.5" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.span
            role="dialog"
            aria-label="How we use AI"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-full left-1/2 z-40 mb-2 w-72 -translate-x-1/2 rounded-card border border-line bg-surface p-3 text-left text-xs leading-snug font-normal text-ink shadow-card normal-case"
          >
            <span className="block font-semibold">How we use AI</span>
            <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-4 text-muted">
              {HOW_WE_USE_AI.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <a href="/sports/ai" className="mt-2 inline-block font-semibold text-accent hover:underline">
              More about AI at Kaleva Sports
            </a>
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

/** a short form: what's wrong, sent to the editors */
function ReportMistake({ refKind, refKey, matchId }: { refKind: "text" | "call"; refKey: string; matchId?: string | null }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function send() {
    setBusy(true);
    setError(null);
    const r = await reportMistakeApi({ refKind, refKey, matchId: matchId ?? null, message });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setOpen(false);
    setMessage("");
    toast("Thanks — an editor will check it");
  }
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="font-semibold text-muted underline-offset-2 hover:text-ink hover:underline">
        Report a mistake
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Report a mistake">
        <label htmlFor="report-message" className="text-sm font-semibold">
          What's wrong?
        </label>
        <textarea
          id="report-message"
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 280))}
          rows={4}
          placeholder="For example: the score in the second sentence is wrong."
          className="mt-1 w-full rounded-lg border border-line bg-surface p-3 text-sm focus:border-accent focus:outline-none"
        />
        <p className="mt-1 text-xs text-muted">{280 - message.length} characters left. An editor reads every report.</p>
        {error && <p className="mt-2 text-sm text-bad">{error}</p>}
        <div className="mt-3 flex gap-2">
          <button type="button" disabled={busy || message.trim().length < 3} onClick={() => void send()} className="h-10 flex-1 rounded-lg bg-accent text-sm font-semibold text-accent-ink disabled:opacity-50">
            {busy ? "Sending…" : "Send report"}
          </button>
          <button type="button" onClick={() => setOpen(false)} className="h-10 rounded-lg border border-line px-4 text-sm font-semibold">
            Cancel
          </button>
        </div>
      </Modal>
    </>
  );
}

/** the label line: source · (reviewed) · info · report a mistake */
export function AiLabel({ label, report, className = "" }: { label: AiLabelKind; report?: { refKind: "text" | "call"; refKey: string | null; matchId?: string | null } | null; className?: string }) {
  const reviewed = label.kind === "text" ? label.origin?.reviewed : null;
  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted ${className}`} data-testid="ai-label">
      <span className="inline-flex items-center gap-1">
        <Icon name={label.kind === "audio" ? "volume" : label.kind === "data" ? "chart" : "sparkle"} className="size-3.5" />
        {aiLabelText(label)}
      </span>
      {reviewed && (
        <span className="inline-flex items-center gap-1 font-semibold text-good" title={`Approved by ${reviewed.by}`}>
          <Icon name="check" className="size-3.5" /> Reviewed by a Kaleva editor
        </span>
      )}
      <HowWeUseAi />
      {report?.refKey && (
        <>
          <span aria-hidden>·</span>
          <ReportMistake refKind={report.refKind} refKey={report.refKey} matchId={report.matchId} />
        </>
      )}
    </div>
  );
}
