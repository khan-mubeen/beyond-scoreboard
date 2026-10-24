import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, useEffect, useId, useRef } from "react";
import { Icon } from "./Icon";

/** a centred dialog. esc and the backdrop close it, focus moves to the close button */
export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  // parents re-render every second (call it! timer), so keep the latest onClose without re-running the effect
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const back = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      back?.focus();
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-dark/60 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={`w-full ${wide ? "max-w-3xl" : "max-w-md"} rounded-card bg-surface shadow-card`}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 id={titleId} className="text-lg font-semibold">
                {title}
              </h2>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                className="rounded-full p-1.5 text-muted hover:bg-surface-2 hover:text-ink"
                aria-label="Close"
              >
                <Icon name="close" />
              </button>
            </header>
            <div className="p-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
