import type { MeResponse } from "@/shared/types";
import { NAV, SEARCH_PLACEHOLDER } from "../chrome";
import type { Resource } from "../data";
import { Icon } from "./Icon";
import { NotificationsBell } from "./NotificationsBell";
import { Bone } from "./Skeleton";
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
    <a href="/" className="font-serif text-[30px] leading-none font-black tracking-tight md:text-[34px]" aria-label="Kaleva home">
      KALEVA
    </a>
  );
}

/** the kaleva bar, full width: menu, wordmark, sections, search, the demo clock, bell, avatar. same on every page */
export function TopNav({ me, menu }: { me: Resource<MeResponse>; menu: MenuButtonProps }) {
  const user = me.data?.user;
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface">
      <div className="flex h-16 items-center gap-4 px-4 md:px-6">
        <MenuButton {...menu} />
        <Wordmark />

        <nav aria-label="Sections" className="ml-6 hidden h-full items-stretch gap-7 lg:flex">
          {NAV.map((l) => (
            <a
              key={l.label}
              href={l.href}
              aria-current={l.active ? "page" : undefined}
              className={`flex items-center gap-1 border-b-2 text-[15px] ${l.active ? "border-accent font-semibold" : "border-transparent hover:text-accent"}`}
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {me.data?.demo && (
            <span className="hidden rounded-full border border-line bg-surface-2 px-2.5 py-1 text-xs font-semibold text-muted sm:inline" title="The demo runs on a fixed league date">
              {me.data.demo.label}
            </span>
          )}
          <label className="hidden w-72 items-center gap-2 rounded-lg bg-surface-2 px-3 py-2.5 text-muted xl:flex">
            <Icon name="search" className="size-4.5" />
            <span className="sr-only">Search</span>
            <input type="search" placeholder={SEARCH_PLACEHOLDER} className="w-full bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none" />
          </label>
          <NotificationsBell />
          <a href="/profile" aria-label={user ? `Your profile, ${user.name}` : "Your profile"} className="rounded-full">
            {user ? <Avatar src={user.avatar} name={user.name} size={38} /> : <Bone className="size-[38px] rounded-full" />}
          </a>
        </div>
      </div>
    </header>
  );
}
