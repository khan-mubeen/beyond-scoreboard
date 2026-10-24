/** a calm skeleton while a page's data loads */
export function PageLoading({ label = "Loading the latest from Liiga…" }: { label?: string }) {
  return (
    <main className="flex min-w-0 flex-col gap-4 px-4 pt-5 pb-10 lg:px-6" aria-busy="true">
      <p className="sr-only" role="status">
        {label}
      </p>
      <div className="h-40 animate-pulse rounded-card bg-surface-2" />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="h-96 animate-pulse rounded-card bg-surface-2" />
        <div className="h-96 animate-pulse rounded-card bg-surface-2" />
      </div>
    </main>
  );
}
