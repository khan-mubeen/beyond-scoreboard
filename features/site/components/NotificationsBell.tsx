import { useEffect, useRef, useState } from "react";
import { markNotificationsRead, useNotifications } from "../data";
import { Icon } from "./Icon";
import { NAMES } from "@/shared/copy/names";

const ago = (iso: string) => {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86_400)} d ago`;
};

/** the bell: unread badge, and a dropdown of in-app notifications (fetched on load and every 30 s) */
export function NotificationsBell() {
  const { data } = useNotifications();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const unread = data?.unread ?? 0;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        className="relative rounded-md p-2 hover:bg-surface-2"
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen(!open)}
      >
        <Icon name="bell" className="size-6" />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 grid min-w-5 place-items-center rounded-full border-2 border-surface bg-live px-1 text-[10px] leading-4 font-bold text-live-ink tabular-nums">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute top-12 right-0 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-card border border-line bg-surface shadow-card"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="font-semibold">Notifications</h2>
            {unread > 0 && (
              <button type="button" onClick={() => void markNotificationsRead()} className="text-xs font-semibold text-accent hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {!data?.items.length && <li className="px-4 py-6 text-center text-sm text-muted">Nothing yet. Answer a {NAMES.call} question and the result lands here.</li>}
            {data?.items.map((n) => (
              <li key={n.id} className="border-b border-line last:border-0">
                <a
                  href={n.link ?? "/calls"}
                  onClick={() => !n.read && void markNotificationsRead(n.id)}
                  className={`flex gap-3 px-4 py-3 hover:bg-surface-2 ${n.read ? "" : "bg-accent-soft/40"}`}
                >
                  <span aria-hidden className={`mt-1.5 size-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-live"}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{n.title}</span>
                    {n.body && <span className="block text-sm text-muted">{n.body}</span>}
                    <span className="mt-0.5 block text-xs text-muted">{ago(n.createdAt)}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
