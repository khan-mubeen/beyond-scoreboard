// loading shapes that match the final cards, so nothing jumps when the data lands, and the
// state for a request that failed. no placeholder numbers or names ever render
import type { ReactNode } from "react";
import { Icon } from "./Icon";

export function Bone({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`block animate-pulse rounded-md bg-surface-2 ${className}`} />;
}

function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-card border border-line bg-surface p-4 shadow-card ${className}`}>{children}</div>;
}

export function ProfileSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <Card className="flex items-center gap-3">
      <Bone className={`${compact ? "size-8" : "size-12"} rounded-full`} />
      <div className="flex flex-1 flex-col gap-2">
        <Bone className="h-4 w-32" />
        <Bone className="h-3 w-20" />
      </div>
    </Card>
  );
}

export function PointsCardSkeleton() {
  return (
    <Card>
      <Bone className="h-3 w-20" />
      <Bone className="mt-2 h-8 w-28" />
      <Bone className="mt-4 h-3 w-40" />
      <Bone className="mt-2 h-2 w-full rounded-full" />
    </Card>
  );
}

export function ListSkeleton({ rows = 4, title = true }: { rows?: number; title?: boolean }) {
  return (
    <Card>
      {title && <Bone className="mb-3 h-4 w-36" />}
      <div className="flex flex-col gap-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Bone className="size-9 rounded-full" />
            <Bone className="h-4 flex-1" />
            <Bone className="h-4 w-10" />
          </div>
        ))}
      </div>
    </Card>
  );
}

export function SidebarSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <ProfileSkeleton compact={compact} />
      <PointsCardSkeleton />
      <ListSkeleton rows={3} />
    </div>
  );
}

/** the home page: hero, featured card, lists and the right column */
export function HomeSkeleton() {
  return (
    <main className="flex min-w-0 flex-col gap-4 px-4 pt-5 pb-10 lg:px-6" aria-busy="true">
      <p className="sr-only" role="status">
        Loading the latest from Liiga…
      </p>
      <Bone className="h-40 rounded-card" />
      <Bone className="h-9 w-80 rounded-full" />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-4">
          <Bone className="h-64 rounded-card" />
          <div className="grid gap-3 sm:grid-cols-3">
            <Bone className="h-32 rounded-card" />
            <Bone className="h-32 rounded-card" />
            <Bone className="h-32 rounded-card" />
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <ListSkeleton rows={5} />
          <ListSkeleton rows={8} />
        </div>
      </div>
    </main>
  );
}

/** a match page: score header, video, tabs, the right column */
export function MatchSkeleton() {
  return (
    <div className="px-4 pb-12 md:px-[30px]" aria-busy="true">
      <p className="sr-only" role="status">
        Loading the match…
      </p>
      <Bone className="my-4 h-3 w-64" />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Bone className="h-36 rounded-card" />
        <Bone className="h-36 rounded-card" />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_343px]">
        <div className="flex flex-col gap-4">
          <Bone className="aspect-video rounded-card md:aspect-[1020/278]" />
          <Bone className="h-10 rounded-lg" />
          <Bone className="h-72 rounded-card" />
        </div>
        <div className="flex flex-col gap-4">
          <Bone className="h-64 rounded-card" />
          <ListSkeleton rows={4} />
        </div>
      </div>
    </div>
  );
}

/** a simple page: a title and a few cards */
export function PageSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <main className="flex flex-col gap-4 px-4 py-6 lg:px-6" aria-busy="true">
      <Bone className="h-9 w-56" />
      {Array.from({ length: cards }, (_, i) => (
        <ListSkeleton key={i} rows={3} />
      ))}
    </main>
  );
}

/** a request that failed: say so, offer a retry, never invent data */
export function DataUnavailable({ what = "this page", onRetry }: { what?: string; onRetry?: () => void }) {
  return (
    <main className="px-4 py-10 lg:px-6">
      <section role="alert" className="mx-auto max-w-xl rounded-card border border-line bg-surface p-8 text-center shadow-card">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-surface-2 text-muted">
          <Icon name="info" className="size-6" />
        </span>
        <h1 className="mt-4 text-xl font-bold">Data unavailable</h1>
        <p className="mt-2 text-muted">We couldn't load {what} right now. Check your connection and try again.</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-5 inline-flex h-11 items-center rounded-lg bg-accent px-5 text-sm font-semibold text-accent-ink hover:brightness-110"
          >
            Try again
          </button>
        )}
      </section>
    </main>
  );
}
