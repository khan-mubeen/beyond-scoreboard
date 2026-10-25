import type { MeResponse } from "@/shared/types";
import { activeLinkFor, QUICK_LINKS } from "../chrome";
import type { Resource } from "../data";
import { FavoriteTeams } from "./FavoriteTeams";
import { Icon } from "./Icon";
import { PointsCard } from "./PointsCard";
import { QuickLinks } from "./QuickLinks";
import { PointsCardSkeleton, ProfileSkeleton } from "./Skeleton";
import { Avatar } from "./TeamLogo";

function ProfileCard({ me, compact }: { me: MeResponse; compact: boolean }) {
  const { user } = me;
  return (
    <a href="/profile" className="flex items-center gap-3 rounded-card border border-line bg-surface p-4 shadow-card hover:border-muted/40">
      <Avatar src={user.avatar} name={user.name} size={compact ? 32 : 48} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{user.name}</p>
        <p className="flex items-center gap-1.5 text-sm text-muted">
          {!compact && <span className={`size-2 rounded-full ${me.joined ? "bg-good" : "bg-muted"}`} aria-hidden />}
          {user.role}
        </p>
      </div>
      {!compact && <Icon name="chevronRight" className="size-5 text-muted" />}
    </a>
  );
}

/**
 * profile, points, favourite teams and quick links, from /api/site/me.
 * skeletons until it answers; the links are static and always there.
 * "home" order matches the home design, "compact" the rewards one
 */
export function Sidebar({ me, activeLinkId, variant = "home" }: { me: Resource<MeResponse>; activeLinkId: string; variant?: "home" | "compact" }) {
  // the address decides which link is active; a page's own id only when no link matches it
  const active = (typeof window === "undefined" ? null : activeLinkFor(window.location.pathname)) ?? activeLinkId;
  const compact = variant === "compact";
  const data = me.data;
  const profile = data ? (
    <>
      <ProfileCard me={data} compact={compact} />
      <PointsCard user={data.user} compact={compact} />
    </>
  ) : me.status === "error" ? (
    <p role="status" className="rounded-card border border-line bg-surface p-4 text-sm text-muted shadow-card">
      Your profile is unavailable right now.
    </p>
  ) : (
    <>
      <ProfileSkeleton compact={compact} />
      <PointsCardSkeleton />
    </>
  );
  const teams = data ? <FavoriteTeams teams={data.favorites} compact={compact} /> : null;
  return (
    <aside aria-label="Your profile" className="flex flex-col gap-4">
      <a href="/" className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-muted hover:text-ink" title="Back to the Kaleva front page">
        <Icon name="arrowRight" className="size-4 rotate-180" /> kaleva.fi
      </a>
      {profile}
      {compact ? (
        <>
          <QuickLinks links={QUICK_LINKS} activeId={active} title={null} boxed={false} />
          {teams && <div className="border-t border-line pt-5">{teams}</div>}
        </>
      ) : (
        <>
          {teams}
          <QuickLinks links={QUICK_LINKS} activeId={active} />
        </>
      )}
    </aside>
  );
}
