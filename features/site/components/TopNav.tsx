import type { MeResponse } from "@/shared/types";
import { SEARCH_PLACEHOLDER } from "../chrome";
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

export type WordmarkVariant = "a" | "b" | "c";

/**
 * the kaleva sports wordmark, as text. (a), the one we use: KALEVA with "Sports" in kaleva red
 * italic serif, smaller, on the same baseline. (b) a red SPORTS tag. (c) KALEVA | Sports
 */
export function SportsWordmark({ variant = "a", className = "text-[30px] md:text-[34px]" }: { variant?: WordmarkVariant; className?: string }) {
  const kaleva = <span className="font-serif font-black tracking-tight">KALEVA</span>;
  return (
    <span className={`inline-flex items-baseline leading-none whitespace-nowrap text-ink ${className}`}>
      {kaleva}
      {variant === "a" && <span className="ml-[0.16em] font-serif text-[0.62em] font-bold text-live italic">Sports</span>}
      {variant === "b" && (
        <span className="ml-[0.22em] -translate-y-[0.32em] self-center rounded-[3px] bg-live px-[0.28em] py-[0.12em] font-sans text-[0.3em] font-bold tracking-[0.12em] text-live-ink">SPORTS</span>
      )}
      {variant === "c" && (
        <>
          <span aria-hidden className="mx-[0.3em] h-[0.72em] w-px self-center bg-ink/40" />
          <span className="font-sans text-[0.56em] font-semibold tracking-tight">Sports</span>
        </>
      )}
    </span>
  );
}

export function Wordmark() {
  return (
    <a href="/sports" aria-label="Kaleva Sports, home" className="shrink-0">
      <SportsWordmark className="text-[26px] md:text-[32px]" />
    </a>
  );
}

/** the kaleva sports header: menu, wordmark, the demo clock, search, bell, avatar (the sidebar's quick links are the navigation) */
export function TopNav({ me, menu }: { me: Resource<MeResponse>; menu: MenuButtonProps }) {
  const user = me.data?.user;
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface">
      <div className="flex h-16 items-center gap-3 px-4 md:gap-4 md:px-6">
        <MenuButton {...menu} />
        <Wordmark />


        <div className="ml-auto flex items-center gap-3">
          {me.data?.demo && (
            <span className="hidden rounded-full border border-line bg-surface-2 px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-muted sm:inline" title="The demo runs on a fixed league date">
              {me.data.demo.label}
            </span>
          )}
          <label className="hidden w-48 items-center gap-2 rounded-lg bg-surface-2 px-3 py-2.5 text-muted min-[1380px]:flex 2xl:w-64">
            <Icon name="search" className="size-4.5" />
            <span className="sr-only">Search</span>
            <input type="search" placeholder={SEARCH_PLACEHOLDER} className="w-full bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none" />
          </label>
          <NotificationsBell />
          <a href="/profile" aria-label={user ? `Your profile, ${user.name}` : "Your profile"} className="shrink-0 rounded-full">
            {user ? <Avatar src={user.avatar} name={user.name} size={38} /> : <Bone className="size-[38px] rounded-full" />}
          </a>
        </div>
      </div>
    </header>
  );
}
