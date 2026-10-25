import type { MeResponse } from "@/shared/types";
import { SEARCH_PLACEHOLDER } from "../chrome";
import type { Resource } from "../data";
import { Icon } from "./Icon";
import { LiveTicker } from "./LiveTicker";
import { NotificationsBell } from "./NotificationsBell";
import { Bone } from "./Skeleton";
import { Avatar } from "./TeamLogo";
import { useMedia } from "./use-media";

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
export function SportsWordmark({
  variant = "a",
  className = "text-[30px] md:text-[34px]",
}: {
  variant?: WordmarkVariant;
  className?: string;
}) {
  const kaleva = <span className="font-serif font-black tracking-tight">KALEVA</span>;
  return (
    <span className={`inline-flex items-baseline leading-none whitespace-nowrap text-ink ${className}`}>
      {kaleva}
      {variant === "a" && (
        <span className="ml-[0.16em] font-serif text-[0.62em] font-bold text-live italic">Sports</span>
      )}
      {variant === "b" && (
        <span className="ml-[0.22em] -translate-y-[0.32em] self-center rounded-[3px] bg-live px-[0.28em] py-[0.12em] font-sans text-[0.3em] font-bold tracking-[0.12em] text-live-ink">
          SPORTS
        </span>
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

/** the header logo as two links: KALEVA to the kaleva front page (/), Sports to the sports home */
export function Wordmark() {
  return (
    <span className="inline-flex shrink-0 items-baseline leading-none whitespace-nowrap text-[26px] md:text-[32px]">
      <a
        href="/"
        aria-label="Kaleva, the front page"
        title="Kaleva front page"
        className="font-serif font-black tracking-tight text-ink hover:opacity-80"
      >
        KALEVA
      </a>
      <a
        href="/sports"
        aria-label="Kaleva Sports, home"
        title="Kaleva Sports home"
        className="ml-[0.16em] font-serif text-[0.62em] font-bold text-live italic hover:opacity-80"
      >
        Sports
      </a>
    </span>
  );
}

/** the kaleva sports header: menu, wordmark, the demo clock, search, bell, avatar (the sidebar's quick links are the navigation) */
export function TopNav({ me, menu }: { me: Resource<MeResponse>; menu: MenuButtonProps }) {
  const user = me.data?.user;
  // one ticker (one match channel): in the header's middle from md, under the header on phones
  const wide = useMedia("(min-width: 768px)");
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-surface">
        <div className="flex h-16 items-center gap-3 px-4 md:gap-4 md:px-6">
          <MenuButton {...menu} />
          <Wordmark />

          <div className="mx-2 hidden min-w-0 flex-1 items-center justify-center gap-3 md:flex lg:mx-6">
            {wide && <LiveTicker className="max-w-[26rem] shrink" />}
            <label className="hidden w-full max-w-xs shrink-[2] items-center gap-2 rounded-lg bg-surface-2 px-3 py-2.5 text-muted xl:flex 2xl:max-w-sm">
              <Icon name="search" className="size-4.5 shrink-0" />
              <span className="sr-only">Search</span>
              <input
                type="search"
                placeholder={SEARCH_PLACEHOLDER}
                className="w-full min-w-0 bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
              />
            </label>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-3">
            {me.data?.demo && (
              <span
                className="hidden rounded-full border border-line bg-surface-2 px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-muted sm:inline"
                title="The demo runs on a fixed league date"
              >
                {me.data.demo.label}
              </span>
            )}
            <NotificationsBell />
            <a
              href="/profile"
              aria-label={user ? `Your profile, ${user.name}` : "Your profile"}
              className="shrink-0 rounded-full"
            >
              {user ? (
                <Avatar src={user.avatar} name={user.name} size={38} />
              ) : (
                <Bone className="size-[38px] rounded-full" />
              )}
            </a>
          </div>
        </div>
      </header>
      {/* phones: a slim row under the header that scrolls away, so the sticky bars keep top-16 */}
      {!wide && (
        <div className="flex justify-center border-b border-line bg-surface px-4 py-1.5 empty:hidden">
          <LiveTicker className="w-full max-w-full justify-center border-0 px-0 py-0.5" />
        </div>
      )}
    </>
  );
}
