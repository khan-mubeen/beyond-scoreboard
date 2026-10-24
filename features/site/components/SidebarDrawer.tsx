import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, useEffect, useRef } from "react";
import type { NavLink } from "@/shared/types";
import { MenuButton, Wordmark } from "./TopNav";

/**
 * the sidebar as a drawer from the left over a 50% black layer (match pages, small screens).
 * esc, the layer and the menu button close it; the page behind doesn't scroll
 */
export function SidebarDrawer({
  open,
  onClose,
  id,
  nav,
  children,
}: {
  open: boolean;
  onClose: () => void;
  id: string;
  nav: NavLink[];
  children: ReactNode;
}) {
  const closeRef = useRef<HTMLDivElement>(null);
  // the screen re-renders often (call it! timer), keep the latest onClose without re-running the effect
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const back = document.activeElement as HTMLElement | null;
    closeRef.current?.querySelector("button")?.focus();
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      root.style.overflow = overflow;
      back?.focus();
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div
            aria-hidden
            data-testid="drawer-scrim"
            className="absolute inset-0 bg-scrim/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            id={id}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="absolute inset-y-0 left-0 flex w-[300px] max-w-[85vw] flex-col bg-surface shadow-card"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "tween", duration: 0.22 }}
          >
            <div ref={closeRef} className="flex h-16 shrink-0 items-center gap-4 border-b border-line px-4">
              <MenuButton onMenu={onClose} expanded label="Close menu" controls={id} />
              <Wordmark />
            </div>
            <div className="flex-1 overflow-y-auto bg-surface-2/60 px-4 py-5">
              {children}
              <nav aria-label="Sections" className="mt-5 border-t border-line pt-4 lg:hidden">
                <ul className="flex flex-col gap-1">
                  {nav.map((l) => (
                    <li key={l.label}>
                      <a
                        href={l.href}
                        aria-current={l.active ? "page" : undefined}
                        className={`block rounded-md px-3 py-2 hover:bg-surface ${l.active ? "font-semibold text-accent" : ""}`}
                      >
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
