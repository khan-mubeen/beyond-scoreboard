import type { SiteChrome } from "@/shared/types";
import { FavoriteTeams } from "./FavoriteTeams";
import { Icon } from "./Icon";
import { PointsCard } from "./PointsCard";
import { QuickLinks } from "./QuickLinks";
import { Avatar } from "./TeamLogo";

function ProfileCard({ user, compact }: { user: SiteChrome["user"]; compact: boolean }) {
  return (
    <a
      href="/settings"
      className="flex items-center gap-3 rounded-card border border-line bg-surface p-4 shadow-card hover:border-muted/40"
    >
      <Avatar src={user.avatar} name={user.name} size={compact ? 32 : 48} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{user.name}</p>
        <p className="flex items-center gap-1.5 text-sm text-muted">
          {!compact && <span className="size-2 rounded-full bg-good" aria-hidden />}
          {user.role}
        </p>
      </div>
      {!compact && <Icon name="chevronRight" className="size-5 text-muted" />}
    </a>
  );
}

/**
 * profile, points, favourite teams and quick links.
 * "home" order matches the home design, "compact" the rewards one
 */
export function Sidebar({
  chrome,
  activeLinkId,
  variant = "home",
}: {
  chrome: SiteChrome;
  activeLinkId: string;
  variant?: "home" | "compact";
}) {
  const compact = variant === "compact";
  return (
    <aside aria-label="Your profile" className="flex flex-col gap-4">
      <ProfileCard user={chrome.user} compact={compact} />
      <PointsCard user={chrome.user} compact={compact} />
      {compact ? (
        <>
          <QuickLinks links={chrome.quickLinks} activeId={activeLinkId} title={null} boxed={false} />
          <div className="border-t border-line pt-5">
            <FavoriteTeams teams={chrome.favorites} compact />
          </div>
        </>
      ) : (
        <>
          <FavoriteTeams teams={chrome.favorites} />
          <QuickLinks links={chrome.quickLinks} activeId={activeLinkId} />
        </>
      )}
    </aside>
  );
}
