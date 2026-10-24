import type { SiteChrome } from "@/shared/types";
import { Icon } from "./Icon";
import { Avatar } from "./TeamLogo";

export interface MenuButtonProps {
  onMenu: () => void;
  expanded: boolean;
  label: string;
  controls: string;
}

export function MenuButton({ onMenu, expanded, label, controls }: MenuButtonProps) {
  return (
    <button
      type="button"
      className="rounded-md p-1.5 hover:bg-surface-2"
      aria-label={label}
      aria-expanded={expanded}
      aria-controls={controls}
      onClick={onMenu}
    >
      <Icon name="menu" className="size-7" />
    </button>
  );
}

export function Wordmark() {
  return (
    <a
      href="/"
      className="font-serif text-[30px] leading-none font-black tracking-tight md:text-[34px]"
      aria-label="Kaleva home"
    >
      KALEVA
    </a>
  );
}

/** the kaleva bar, full width: menu, wordmark, sections, search, bell, avatar. same on every page */
export function TopNav({ chrome, menu }: { chrome: SiteChrome; menu: MenuButtonProps }) {
  const { nav, user } = chrome;
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface">
      <div className="flex h-16 items-center gap-4 px-4 md:px-6">
        <MenuButton {...menu} />
        <Wordmark />

        <nav aria-label="Sections" className="ml-6 hidden h-full items-stretch gap-7 lg:flex">
          {nav.map((l) => (
            <a
              key={l.label}
              href={l.href}
              aria-current={l.active ? "page" : undefined}
              className={`flex items-center gap-1 border-b-2 text-[15px] ${
                l.active ? "border-accent font-semibold" : "border-transparent hover:text-accent"
              }`}
            >
              {l.label}
              {l.hasMenu && <Icon name="chevronDown" className="size-4" />}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <label className="hidden w-72 items-center gap-2 rounded-lg bg-surface-2 px-3 py-2.5 text-muted md:flex">
            <Icon name="search" className="size-4.5" />
            <span className="sr-only">Search</span>
            <input
              type="search"
              placeholder={chrome.searchPlaceholder}
              className="w-full bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
            />
          </label>
          <button type="button" className="rounded-md p-2 hover:bg-surface-2 md:hidden" aria-label="Search">
            <Icon name="search" />
          </button>
          <button type="button" className="relative rounded-md p-2 hover:bg-surface-2" aria-label="Notifications">
            <Icon name="bell" className="size-6" />
            {chrome.hasNotifications && (
              <span className="absolute top-1.5 right-1.5 size-2.5 rounded-full border-2 border-surface bg-accent" />
            )}
          </button>
          <Avatar src={user.avatar} name={user.name} size={38} />
        </div>
      </div>
    </header>
  );
}
