import { AnimatePresence, motion } from "motion/react";
import { createContext, type ReactNode, useCallback, useContext, useRef, useState } from "react";

type Show = (message: string) => void;
const ToastContext = createContext<Show>(() => {});

/** one toast at a time, bottom centre, announced to screen readers */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = useCallback<Show>((message) => {
    clearTimeout(timer.current);
    setToast({ id: Date.now(), message });
    timer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex justify-center px-4 md:bottom-6"
      >
        <AnimatePresence>
          {toast && (
            <motion.div
              key={toast.id}
              role="status"
              className="rounded-full bg-dark px-4 py-2.5 text-sm font-medium text-dark-ink shadow-card"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
            >
              {toast.message}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): Show {
  return useContext(ToastContext);
}
