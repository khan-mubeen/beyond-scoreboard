import { Icon } from "../components/Icon";
import { SiteLayout } from "../components/SiteLayout";

/** "coming soon" in the site layout, for pages that aren't built yet */
export function Placeholder({ title, activeLinkId }: { title: string; activeLinkId?: string }) {
  return (
    <SiteLayout sidebar={{ activeLinkId, docked: true }}>
      <main className="px-4 py-10 lg:px-6">
        <section className="mx-auto max-w-xl rounded-card border border-line bg-surface p-10 text-center shadow-card">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-accent-soft text-accent">
            <Icon name="sparkle" className="size-6" />
          </span>
          <h1 className="mt-4 font-serif text-3xl font-bold">{title}</h1>
          <p className="mt-2 text-muted">Coming soon. We're building this page next.</p>
          <a
            href="/sports"
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-5 text-sm font-semibold text-accent-ink hover:bg-accent-hover"
          >
            Back to Sports <Icon name="arrowRight" className="size-4" />
          </a>
        </section>
      </main>
    </SiteLayout>
  );
}
