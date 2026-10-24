// the kaleva media header and footer (kalevamedia.fi, rebuilt with our own markup): the beige top
// bar with the social links, the white header with the wordmark and the menu (hover dropdowns on
// desktop, a side panel on phones), and the footer with "Mediat", "Etsitkö näitä?" and the
// bottom bar. the sports pages use the same footer, with a demo note
import { type ReactNode, useEffect, useState } from "react";
import { MEDIA_LOOKING_FOR, MEDIA_NAV, MEDIA_SOCIAL, MEDIA_SOCKET, MEDIA_TITLES, type MediaNavItem, mediaHref } from "../../media";

/** "KALEVAMEDIA" as styled text (never their logo file) */
export function MediaWordmark({ className = "text-[26px]" }: { className?: string }) {
  return (
    <span className={`font-km-logo leading-none tracking-[0.12em] text-black ${className}`} aria-label="Kaleva Media">
      <span className="font-extrabold">KALEVA</span>
      <span className="font-normal">MEDIA</span>
    </span>
  );
}

const SOCIAL_PATH: Record<(typeof MEDIA_SOCIAL)[number]["icon"], ReactNode> = {
  linkedin: (
    <>
      <rect x="3" y="9" width="4" height="12" />
      <circle cx="5" cy="4.5" r="2.2" />
      <path d="M10 9h3.8v1.8c.6-1.1 2-2.1 4-2.1 3.3 0 4.2 2.1 4.2 5.1V21h-4v-6.3c0-1.5-.4-2.6-1.9-2.6-1.6 0-2.1 1.2-2.1 2.7V21h-4z" />
    </>
  ),
  facebook: <path d="M14 8.5V6.8c0-.8.5-1.3 1.4-1.3H17V2.2h-2.6C11.6 2.2 10 3.9 10 6.5v2H7.5v3.4H10V22h4V11.9h2.7l.4-3.4z" />,
  instagram: (
    <path
      fillRule="evenodd"
      d="M7 2.5h10A4.5 4.5 0 0 1 21.5 7v10a4.5 4.5 0 0 1-4.5 4.5H7A4.5 4.5 0 0 1 2.5 17V7A4.5 4.5 0 0 1 7 2.5zm0 2A2.5 2.5 0 0 0 4.5 7v10A2.5 2.5 0 0 0 7 19.5h10a2.5 2.5 0 0 0 2.5-2.5V7A2.5 2.5 0 0 0 17 4.5zm5 3.5a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm5-3.2a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"
    />
  ),
  youtube: <path fillRule="evenodd" d="M2.5 7.5C2.7 5.6 3.9 4.6 5.8 4.5 8 4.3 10 4.3 12 4.3s4 0 6.2.2c1.9.1 3.1 1.1 3.3 3 .2 1.5.2 3 .2 4.5s0 3-.2 4.5c-.2 1.9-1.4 2.9-3.3 3-2.2.2-4.2.2-6.2.2s-4 0-6.2-.2c-1.9-.1-3.1-1.1-3.3-3C2.3 15 2.3 13.5 2.3 12s0-3 .2-4.5zM10 8.8v6.4l5.5-3.2z" />,
};

export function SocialLinks({ size = 18 }: { size?: number }) {
  return (
    <ul className="flex items-center" aria-label="Kaleva Media somessa">
      {MEDIA_SOCIAL.map((s) => (
        <li key={s.slug}>
          <a href={mediaHref(s)} aria-label={s.label} className="grid size-[30px] place-items-center border-l border-black/10 text-black hover:bg-black/10">
            <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
              {SOCIAL_PATH[s.icon]}
            </svg>
          </a>
        </li>
      ))}
    </ul>
  );
}

function NewTag() {
  return <span className="ml-1.5 rounded-sm bg-[#d80016] px-1.5 py-[1px] text-[10px] leading-4 font-bold tracking-wide text-white uppercase">New</span>;
}

function Chevron({ open = false }: { open?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`size-4 transition-transform ${open ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth={1.4} aria-hidden>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

/** desktop: hover (or focus) opens an item's dropdown */
function DesktopItem({ item, active, alignRight = false }: { item: MediaNavItem; active: boolean; alignRight?: boolean }) {
  return (
    <li className="group relative flex h-full items-stretch">
      <a
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={`flex items-center px-[13px] text-[13px] font-semibold hover:text-km-gold hover:underline hover:underline-offset-4 ${active ? "text-km-gold" : "text-black"}`}
      >
        {item.label}
        {item.isNew && <NewTag />}
      </a>
      {item.sub && (
        <ul className={`invisible absolute top-full z-30 w-[208px] ${alignRight ? "right-0" : "left-0"} border border-[#e1e1e1] bg-white py-1.5 opacity-0 shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100`}>
          {item.sub.map((s) => (
            <li key={s.slug}>
              <a href={mediaHref(s)} className="block px-4 py-2.5 text-[12px] text-black hover:bg-[#f8f8f8] hover:text-km-gold">
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/** phones: a white panel from the right with the same items; a chevron opens the sub pages */
function MobileMenu({ open, onClose, activeHref }: { open: boolean; onClose: () => void; activeHref: string }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      root.style.overflow = before;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button type="button" aria-label="Sulje valikko" className="absolute inset-0 bg-black/30" onClick={onClose} />
      <nav id="km-mobile-menu" aria-label="Valikko" className="absolute inset-y-0 right-0 flex w-[90%] max-w-[420px] flex-col overflow-y-auto bg-white">
        <div className="flex h-[88px] shrink-0 items-center justify-end px-6">
          <button type="button" onClick={onClose} aria-label="Sulje valikko" className="text-km-gold">
            <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
              <path d="M5 5l14 14M19 5L5 19" />
            </svg>
          </button>
        </div>
        <ul className="mt-16 border-t-0">
          {MEDIA_NAV.map((item) => (
            <li key={item.label} className="border-b border-[#dedede]">
              <div className="flex items-center">
                <a href={item.href} aria-current={item.href === activeHref ? "page" : undefined} className="flex flex-1 items-center py-4 pl-12 text-[19px] text-km-gold">
                  {item.label}
                  {item.isNew && <NewTag />}
                </a>
                {item.sub && (
                  <button
                    type="button"
                    aria-expanded={expanded === item.label}
                    aria-label={`${item.label}: alasivut`}
                    onClick={() => setExpanded(expanded === item.label ? null : item.label)}
                    className="px-6 py-4 text-km-gold/70"
                  >
                    <Chevron open={expanded === item.label} />
                  </button>
                )}
              </div>
              {item.sub && expanded === item.label && (
                <ul className="pb-2">
                  {item.sub.map((s) => (
                    <li key={s.slug}>
                      <a href={mediaHref(s)} className="block py-2.5 pl-16 text-[16px] text-km-gold">
                        {s.label}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

/** the kaleva media header. activeHref marks the current item ("/" on the front page) */
export function MediaHeader({ activeHref = "/" }: { activeHref?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="font-km">
      <div className="h-7 bg-km-sand lg:h-[30px]">
        <div className="mx-auto flex h-full max-w-[1224px] justify-end px-6 xl:px-0">
          <div className="hidden lg:block">
            <SocialLinks />
          </div>
        </div>
      </div>
      <div className="border-b border-[#e1e1e1] bg-white">
        <div className="mx-auto flex h-[66px] max-w-[1224px] items-stretch justify-between px-6 lg:h-[88px] xl:px-0">
          <a href="/" className="flex items-center" aria-label="Kaleva Media, etusivu">
            <MediaWordmark className="text-[22px] lg:text-[25px]" />
          </a>
          <nav aria-label="Päävalikko" className="hidden lg:block">
            <ul className="flex h-full items-stretch">
              {MEDIA_NAV.map((item, i) => (
                // the last menus open leftwards, inside the page
                <DesktopItem key={item.label} item={item} active={item.href === activeHref} alignRight={i >= MEDIA_NAV.length - 2} />
              ))}
            </ul>
          </nav>
          <button
            type="button"
            className="flex items-center lg:hidden"
            aria-label="Valikko"
            aria-expanded={open}
            aria-controls="km-mobile-menu"
            onClick={() => setOpen(true)}
          >
            <svg viewBox="0 0 30 24" className="h-6 w-8" fill="none" stroke="currentColor" strokeWidth={2.6} aria-hidden>
              <path d="M1 3h28M1 12h28M1 21h28" />
            </svg>
          </button>
        </div>
      </div>
      <MobileMenu open={open} onClose={() => setOpen(false)} activeHref={activeHref} />
    </header>
  );
}

/** the kaleva media footer. on sports pages a note says it's a demo */
export function MediaFooter({ note }: { note?: ReactNode }) {
  return (
    <footer className="font-km">
      <div className="border-t border-[#e1e1e1] bg-km-paper">
        <div className="mx-auto grid max-w-[1224px] gap-10 px-6 py-12 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr] xl:px-0">
          <section aria-labelledby="km-footer-mediat">
            <h3 id="km-footer-mediat" className="text-[18px] font-bold tracking-[0.02em] text-black uppercase">
              Mediat
            </h3>
            <ul className="mt-5 flex flex-col gap-[3px] text-[13px] text-black">
              {MEDIA_TITLES.map((l) => (
                <li key={l.slug}>
                  <a href={mediaHref(l)} className="hover:underline">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="km-footer-etsitko">
            <h3 id="km-footer-etsitko" className="text-[18px] font-bold tracking-[0.02em] text-black uppercase">
              Etsitkö näitä?
            </h3>
            <div className="mt-5 flex flex-col gap-4 text-[13px] text-black">
              {MEDIA_LOOKING_FOR.map((group, i) => (
                <ul key={i} className="flex flex-col gap-[3px]">
                  {group.map((l) => (
                    <li key={l.slug}>
                      <a href={mediaHref(l)} className="hover:underline">
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              ))}
            </div>
          </section>
          <div className="hidden lg:block" />
          <div className="hidden items-start justify-center lg:flex">
            <a href="/" aria-label="Kaleva Media, etusivu" className="mt-6 flex flex-col items-center gap-3">
              {/* a plain mark in their gold: not their logo */}
              <span aria-hidden className="grid size-20 place-items-center rounded-full border-[5px] border-km-gold font-km-logo text-[36px] font-extrabold text-km-gold">
                K
              </span>
              <MediaWordmark className="text-[20px]" />
            </a>
          </div>
        </div>
      </div>
      <div className="bg-km-socket">
        <div className="mx-auto flex max-w-[1224px] flex-col items-start gap-2 px-6 py-3 sm:flex-row sm:items-center sm:justify-end sm:gap-5 xl:px-0">
          {note && <p className="mr-auto text-[11px] text-black/70">{note}</p>}
          <ul className="flex flex-col gap-2 text-[11px] font-bold text-black uppercase sm:flex-row sm:gap-5">
            {MEDIA_SOCKET.map((l) => (
              <li key={l.slug}>
                <a href={mediaHref(l)} className="hover:underline">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <SocialLinks size={14} />
        </div>
      </div>
    </footer>
  );
}
