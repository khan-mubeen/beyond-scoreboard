// a coachmark: dims the page around one element (a rounded cut-out with a soft white ring) and
// points a small card at it. a click in the cut-out takes the primary action, a click anywhere
// else, "Not now" or Escape closes it. when the element isn't on screen (the phone, where it sits
// in the menu) the same card is a bottom sheet. a 200 ms fade, no motion with reduced motion
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

const PAD = 8;
const GAP = 14;
const CARD_W = 320;

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** the target's box on screen, or null when it's hidden; follows resizes and scrolling */
function useTargetBox(selector: string): Box | null {
  const [box, setBox] = useState<Box | null>(null);
  useLayoutEffect(() => {
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const el = document.querySelector<HTMLElement>(selector);
        const r = el?.getBoundingClientRect();
        setBox(r && r.width > 0 && r.height > 0 ? { top: r.top, left: r.left, width: r.width, height: r.height } : null);
      });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [selector]);
  return box;
}

export function Spotlight({
  target,
  title,
  text,
  action,
  dismissLabel = "Not now",
  onClose,
}: {
  /** a css selector for the element to point at */
  target: string;
  title: string;
  text: string;
  action: { label: string; href: string };
  dismissLabel?: string;
  onClose: () => void;
}) {
  const box = useTargetBox(target);
  const reduce = useReducedMotion();
  const card = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const textId = useId();

  // focus moves to the card (again when it turns from sheet to card once the target is measured),
  // and back to where it was on close
  const sheet = !box;
  useEffect(() => card.current?.focus(), [sheet]);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    return () => before?.focus?.();
  }, []);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close.current();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const fade = { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: reduce ? 0 : 0.2 } };
  const rise = { initial: { opacity: 0, y: reduce ? 0 : 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: reduce ? 0 : 0.2 } };
  const body = (
    <>
      <h2 id={titleId} className="text-lg leading-snug font-bold">
        {title}
      </h2>
      <p id={textId} className="mt-1.5 text-[15px] leading-snug text-[#444]">
        {text}
      </p>
      <div className="mt-4 flex items-center gap-2">
        <a href={action.href} className="inline-flex h-10 items-center rounded-lg bg-[#d80016] px-4 text-sm font-semibold text-white hover:bg-[#b00012]">
          {action.label}
        </a>
        <button type="button" onClick={onClose} className="h-10 rounded-lg px-3 text-sm font-semibold text-[#444] hover:bg-black/5">
          {dismissLabel}
        </button>
      </div>
    </>
  );
  const dialog = { ref: card, role: "dialog", "aria-modal": true, "aria-labelledby": titleId, "aria-describedby": textId, tabIndex: -1, onClick: (e: React.MouseEvent) => e.stopPropagation() } as const;

  // the phone: no cut-out, the card as a bottom sheet
  if (!box) {
    return (
      <motion.div {...fade} className="fixed inset-0 z-[70] bg-black/45" onClick={onClose} data-testid="spotlight">
        <motion.div {...dialog} {...rise} className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] font-kf text-black shadow-[0_-8px_24px_rgba(0,0,0,.18)] outline-none" data-testid="spotlight-sheet">
          {body}
        </motion.div>
      </motion.div>
    );
  }

  const hole = { top: box.top - PAD, left: box.left - PAD, width: box.width + 2 * PAD, height: box.height + 2 * PAD };
  const left = Math.min(Math.max(16, hole.left + hole.width / 2 - CARD_W / 2), window.innerWidth - CARD_W - 16);
  const arrow = Math.min(Math.max(20, hole.left + hole.width / 2 - left), CARD_W - 20);
  return (
    <motion.div {...fade} className="fixed inset-0 z-[70]" onClick={onClose} data-testid="spotlight">
      {/* the cut-out: its shadow is the dim layer; a click inside takes the action */}
      <a
        href={action.href}
        aria-label={action.label}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="absolute rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,.45)] ring-2 ring-white/80"
        style={hole}
        data-testid="spotlight-hole"
      />
      <motion.div {...dialog} {...rise} className="absolute rounded-xl bg-white p-5 font-kf text-black shadow-[0_8px_24px_rgba(0,0,0,.2)] outline-none" style={{ top: hole.top + hole.height + GAP, left, width: CARD_W }}>
        <span aria-hidden className="absolute -top-1.5 size-3 rotate-45 bg-white" style={{ left: arrow - 6 }} />
        {body}
      </motion.div>
    </motion.div>
  );
}
