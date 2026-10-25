// one layout for the sports pages that aren't match pages: breadcrumbs, the title, then the main
// column with an optional aside (sticky beside it from 1280 px, under it below). the same max width
// and gutters everywhere. a toolbar (tabs, filters) sits above the main column only, so the aside's
// top lines up with the first main card, not with the title or the tabs
import type { ReactNode } from "react";
import type { Breadcrumb, DataSource } from "@/shared/types";
import { Breadcrumbs, SiteLayout } from "./SiteLayout";

export function SitePage({
  activeLinkId,
  crumbs,
  title,
  intro,
  actions,
  toolbar,
  aside,
  asideFirst = false,
  asideLabel = "More",
  source,
  children,
}: {
  activeLinkId: string;
  crumbs: Breadcrumb[];
  title: ReactNode;
  /** a line under the title */
  intro?: ReactNode;
  /** beside the title (a button, a link) */
  actions?: ReactNode;
  /** above the main column only: tabs, filters */
  toolbar?: ReactNode;
  aside?: ReactNode;
  /** on narrow screens show the aside before the main column (the friends invite) */
  asideFirst?: boolean;
  asideLabel?: string;
  source?: DataSource | null;
  children: ReactNode;
}) {
  return (
    <SiteLayout sidebar={{ activeLinkId, docked: true }} source={source}>
      <main className="mx-auto w-full max-w-[1360px] px-4 pb-12 md:px-6">
        <Breadcrumbs items={crumbs} />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-serif text-[36px] leading-tight font-bold">{title}</h1>
            {intro && <p className="mt-1 text-sm text-muted">{intro}</p>}
          </div>
          {actions}
        </div>
        <div className={`mt-5 grid gap-x-6 gap-y-4 ${aside ? "xl:grid-cols-[minmax(0,1fr)_360px]" : ""}`}>
          {toolbar && <div className="min-w-0 xl:col-start-1">{toolbar}</div>}
          <div
            className={`flex min-w-0 flex-col gap-4 xl:col-start-1 ${toolbar ? "xl:row-start-2" : "xl:row-start-1"}`}
          >
            {children}
          </div>
          {aside && (
            <aside
              aria-label={asideLabel}
              className={`flex min-w-0 flex-col gap-4 xl:sticky xl:top-20 xl:col-start-2 xl:self-start ${toolbar ? "xl:row-start-2" : "xl:row-start-1"} ${asideFirst ? "max-xl:order-first" : ""}`}
            >
              {aside}
            </aside>
          )}
        </div>
      </main>
    </SiteLayout>
  );
}
