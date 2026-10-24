import { PageSkeleton } from "./Skeleton";

/** a calm skeleton while a page's data loads */
export function PageLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <>
      <p className="sr-only" role="status">
        {label}
      </p>
      <PageSkeleton />
    </>
  );
}
