// the kaleva.fi chrome, rebuilt with our own markup: the orange top bar (menu, links, Tilaa,
// Kirjaudu), the white header (the wordmark as styled text, the section row, the weather link),
// the drawer menu from the left, and the dark footer. links to kaleva.fi open in a new tab; the
// one link into the app is Kaleva Sports (it replaces "Urheilu" in the drawer). the sports pages
// use the footer, and a thin orange bar with "‹ Kaleva" back to the front page
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";
import { KF_DRAWER, KF_FOOTER, KF_LOGIN, KF_NAV, KF_SUBSCRIBE, KF_TOP, type KalevaLink } from "../../kaleva";
import { Icon } from "../Icon";

const external = (href: string) => /^https?:/.test(href);
/** a link out to kaleva.fi opens in a new tab; one into the app stays */
export const linkProps = (href: string) => (external(href) ? { href, target: "_blank", rel: "noreferrer" } : { href });

/** "KALEVA" as styled text (never their logo file) */
export function KalevaWordmark({ className = "text-[48px]" }: { className?: string }) {
  return (
    <span className={`font-kf-logo leading-none font-bold tracking-[-0.01em] text-black uppercase ${className}`} aria-label="Kaleva">
      Kaleva
    </span>
  );
}

/** our small icon: a puck on kaleva red */
export function SportsIcon({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden className="shrink-0">
      <rect width="24" height="24" rx="6" fill="#d80016" />
      <ellipse cx="12" cy="10.5" rx="6.5" ry="2.6" fill="#fff" />
      <path d="M5.5 10.5v3c0 1.4 2.9 2.6 6.5 2.6s6.5-1.2 6.5-2.6v-3" fill="none" stroke="#fff" strokeWidth="1.6" />
    </svg>
  );
}

export function NewTag() {
  return <span className="rounded-sm bg-[#d80016] px-1.5 py-px text-[10px] leading-4 font-bold tracking-wide text-white uppercase">New</span>;
}

/** a link in the menu: ours with its icon and NEW */
function MenuLink({ l, className }: { l: KalevaLink; className: string }) {
  if (l.sports)
    return (
      <a href={l.href} className={`${className} flex items-center gap-2 font-semibold`} data-testid="kaleva-sports-entry">
        <SportsIcon />
        {l.label}
        <NewTag />
      </a>
    );
  return (
    <a {...linkProps(l.href)} className={className}>
      {l.label}
    </a>
  );
}

/** the drawer menu, from the left over a dark layer */
export function KalevaDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus();
    };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Valikko">
          <motion.button type="button" aria-label="Sulje valikko" onClick={onClose} className="absolute inset-0 bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.nav
            ref={panel}
            id="kaleva-drawer"
            aria-label="Päävalikko"
            className="absolute inset-y-0 left-0 w-[66%] max-w-[256px] overflow-y-auto bg-white font-kf text-black shadow-xl min-[480px]:w-[256px]"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "tween", duration: 0.22 }}
          >
            <div className="flex h-[30px] justify-end">
              <button type="button" onClick={onClose} aria-label="Sulje valikko" className="grid size-[30px] place-items-center">
                <Icon name="close" className="size-4" />
              </button>
            </div>
            {KF_DRAWER.map((g, i) => (
              <div key={g.title.label || `group-${i}`} className={g.title.label ? "" : "pt-4"}>
                {g.title.label && <MenuLink l={g.title} className="block border-y border-[#e1e1e1] bg-kf-grey px-[30px] py-2.5 text-[15px] font-bold uppercase" />}
                {g.items.length > 0 && (
                  <ul className="py-2">
                    {g.items.map((l) => (
                      <li key={l.label + l.href}>
                        <MenuLink l={l} className="block px-[30px] py-[5px] text-[16px] hover:underline" />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </motion.nav>
        </div>
      )}
    </AnimatePresence>
  );
}

/** the orange top bar: menu, the service links (desktop), Tilaa and Kirjaudu */
export function KalevaTopBar({ onMenu, open }: { onMenu: () => void; open: boolean }) {
  return (
    <div className="bg-kf-orange font-kf text-white">
      <div className="mx-auto flex h-[40px] max-w-[1440px] items-center gap-4 px-4 lg:h-[40px] lg:px-[75px]">
        <button type="button" onClick={onMenu} aria-label="Valikko" aria-expanded={open} aria-controls="kaleva-drawer" className="-ml-1 p-1">
          <Icon name="menu" className="size-6" />
        </button>
        <ul className="hidden items-center gap-4 text-[15px] lg:flex">
          {KF_TOP.map((l) => (
            <li key={l.label}>
              <a {...linkProps(l.href)} className="hover:underline">
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <a {...linkProps(KF_SUBSCRIBE.href)} className="ml-auto rounded-full bg-white px-4 py-1 text-[13px] font-bold text-kf-orange-ink uppercase hover:brightness-95">
          {KF_SUBSCRIBE.label}
        </a>
        <a {...linkProps(KF_LOGIN.href)} className="flex items-center gap-1.5 text-[15px] hover:underline">
          <Icon name="profile" className="size-5" />
          {KF_LOGIN.label}
        </a>
      </div>
    </div>
  );
}

/** the white header: the wordmark, the section row (desktop), the weather link */
export function KalevaHeader() {
  return (
    <header className="bg-white font-kf shadow-[0_3px_6px_rgba(0,0,0,0.08)]">
      <div className="mx-auto flex h-[95px] max-w-[1440px] items-center gap-6 px-4 lg:h-[130px] lg:px-[87px]">
        <a href="/" aria-label="Kaleva, etusivu" className="shrink-0">
          <KalevaWordmark className="text-[40px] lg:text-[52px]" />
        </a>
        <nav aria-label="Osastot" className="mx-auto hidden lg:block">
          <ul className="flex items-center text-[15px] font-bold uppercase">
            {KF_NAV.map((l, i) => (
              <li key={l.label} className="flex items-center">
                {i > 0 && <span aria-hidden className="mx-[15px] h-[15px] w-[2px] bg-black" />}
                <a {...linkProps(l.href)} className="hover:underline">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <a {...linkProps("https://www.kaleva.fi/saa")} className="ml-auto flex flex-col items-center text-[15px] font-semibold lg:ml-0" aria-label="Sää Oulussa">
          Oulu
          <svg viewBox="0 0 48 32" width="44" height="30" aria-hidden className="mt-0.5">
            <circle cx="30" cy="11" r="6" fill="#f5c400" />
            <path d="M12 28h22a7 7 0 0 0 0-14 9 9 0 0 0-17-1 7 7 0 0 0-5 15z" fill="#fff" stroke="#9aa0a6" strokeWidth="2.5" />
          </svg>
        </a>
      </div>
    </header>
  );
}

/** the dark footer; the sports pages add a demo note */
export function KalevaFooter({ note }: { note?: string }) {
  return (
    <footer className="bg-kf-footer font-kf text-white">
      <div className="mx-auto grid max-w-[1440px] gap-8 px-4 py-10 lg:grid-cols-[300px_minmax(0,1fr)] lg:px-[75px]">
        <div className="flex flex-col gap-3">
          {KF_FOOTER.buttons.map((b) => (
            <a key={b.label} {...linkProps(b.href)} className="rounded-full bg-kf-orange-ink px-5 py-2.5 text-center text-[15px] font-bold uppercase hover:brightness-110">
              {b.label}
            </a>
          ))}
          <ul className="mt-2 flex flex-col gap-1.5 text-[15px]">
            {KF_FOOTER.links.map((l) => (
              <li key={l.label}>
                <a {...linkProps(l.href)} className="hover:underline">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-[22px] font-bold uppercase">Ota yhteyttä</h2>
          <div className="mt-4 grid gap-6 sm:grid-cols-3">
            {KF_FOOTER.columns.map((c) => (
              <div key={c.title}>
                <h3 className="text-[15px] font-bold uppercase">{c.title}</h3>
                <ul className="mt-2 flex flex-col gap-1 text-[14px] text-white/85">
                  {c.lines.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
      {note && <p className="border-t border-white/15 px-4 py-3 text-center text-xs text-white/70">{note}</p>}
    </footer>
  );
}

/** above the sports header: the way back to the kaleva front page */
export function KalevaBar() {
  return (
    <div className="h-[30px] bg-kf-orange font-kf">
      <div className="flex h-full items-center px-4 md:px-6">
        <a href="/" className="flex items-center gap-1 text-[13px] font-bold text-white hover:underline">
          ‹ Kaleva
        </a>
      </div>
    </div>
  );
}
