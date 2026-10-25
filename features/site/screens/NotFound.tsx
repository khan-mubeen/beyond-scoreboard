import { Icon } from "../components/Icon";
import { SiteLayout } from "../components/SiteLayout";

/** any address that isn't a page: say so kindly and offer the two likely ways on */
export function NotFound() {
  return (
    <SiteLayout sidebar={{ docked: false }}>
      <main className="mx-auto flex max-w-xl flex-col items-center px-4 py-16 text-center md:py-24">
        <span className="font-serif text-[88px] leading-none font-bold text-accent">404</span>
        <h1 className="mt-3 font-serif text-[32px] leading-tight font-bold">This page went off the ice</h1>
        <p className="mt-2 text-[17px] text-muted">The address may be old or mistyped. The game is still on, though.</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <a href="/sports" className="inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-5 font-semibold text-accent-ink hover:bg-accent-hover">
            <Icon name="home" className="size-4" /> Kaleva Sports home
          </a>
          <a href="/join" className="inline-flex h-11 items-center gap-2 rounded-lg border border-line bg-surface px-5 font-semibold hover:bg-surface-2">
            <Icon name="tv" className="size-4" /> Watch the live match
          </a>
        </div>
      </main>
    </SiteLayout>
  );
}
