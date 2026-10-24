import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, useSyncExternalStore } from "react";

interface ToastItem {
  id: number;
  message: string;
  tone: "neutral" | "good" | "bad";
  action?: { label: string; href: string };
}

type ToastOptions = { tone?: ToastItem["tone"]; action?: ToastItem["action"]; ms?: number };

// one toast at a time, in a module store so anything (the live match hook too) can raise one
let current: ToastItem | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(message: string, opts: ToastOptions = {}) {
  clearTimeout(timer);
  current = { id: Date.now(), message, tone: opts.tone ?? "neutral", action: opts.action };
  emit();
  timer = setTimeout(() => {
    current = null;
    emit();
  }, opts.ms ?? 2600);
}

// good is a green ring on dark: white text on the green itself is under 4.5:1
const TONE = { neutral: "bg-dark text-dark-ink", good: "bg-dark text-dark-ink ring-2 ring-good", bad: "bg-dark text-dark-ink ring-2 ring-accent" };

/** renders the toast, bottom centre, announced to screen readers */
export function ToastProvider({ children }: { children: ReactNode }) {
  const item = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => null,
  );
  return (
    <>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex justify-center px-4 md:bottom-6">
        <AnimatePresence>
          {item && (
            <motion.div
              key={item.id}
              role="status"
              className={`pointer-events-auto flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium shadow-card ${TONE[item.tone]}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
            >
              {item.message}
              {item.action && (
                <a href={item.action.href} className="font-semibold underline underline-offset-2">
                  {item.action.label}
                </a>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

/** the same toast, for components */
export function useToast() {
  return toast;
}
