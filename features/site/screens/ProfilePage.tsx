import { useState } from "react";
import { AchievementCard } from "../components/Follow";
import { FavoriteTeams } from "../components/FavoriteTeams";
import { PointsCard } from "../components/PointsCard";
import { ActionLink, SectionCard } from "../components/SectionCard";
import { Breadcrumbs, SiteLayout } from "../components/SiteLayout";
import { DataUnavailable, PageSkeleton } from "../components/Skeleton";
import { PurchaseHistory, SubscriptionCard } from "../components/RewardCards";
import { CheckoutModal } from "../components/Checkout";
import { useMe, useProfile, useRewardsPage } from "../data";
import { NicknameForm } from "./SettingsPage";

/** the fan's running plans (cancel stops renewal; they stay active until they end) and purchases */
function PlansSection() {
  const page = useRewardsPage().data;
  const [checkout, setCheckout] = useState<string | null>(null);
  const active = page?.subscriptions.filter((s) => s.active) ?? [];
  return (
    <SectionCard title="Your subscriptions" action={<ActionLink href="/rewards#plans">See plans</ActionLink>}>
      {!page ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <div className="flex flex-col gap-4">
          {active.length === 0 ? (
            <p className="text-sm text-muted">No subscription yet. Kaleva Sports Pass lets you watch the games live.</p>
          ) : (
            active.map((s) => <SubscriptionCard key={s.id} sub={s} onSubscribe={() => setCheckout(s.id)} />)
          )}
          {page.history && page.history.length > 0 && <PurchaseHistory items={page.history} />}
        </div>
      )}
      <CheckoutModal planId={checkout} open={checkout !== null} onClose={() => setCheckout(null)} />
    </SectionCard>
  );
}

/** /profile: name, level and points, teams, how the calls went, badges */
export function ProfilePage() {
  const me = useMe().data;
  const { data, status, refresh } = useProfile();

  return (
    <SiteLayout sidebar={{ activeLinkId: "profile", docked: true }}>
      <main className="px-4 pb-12 md:px-6">
        <Breadcrumbs items={[{ label: "Sports", href: "/sports" }, { label: "Profile" }]} />
        <h1 className="font-serif text-[36px] leading-tight font-bold">{me?.nickname ?? "Your profile"}</h1>
        {!me || !data ? (
          status === "error" ? (
            <DataUnavailable what="your profile" onRetry={refresh} />
          ) : (
            <PageSkeleton cards={4} />
          )
        ) : (
          <div className="mt-4 grid max-w-5xl gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-4">
              <SectionCard title="Your name">
                <NicknameForm current={me.nickname} />
              </SectionCard>
              <SectionCard title="Friends" action={<ActionLink href="/friends">{me.friendRequests ? `${me.friendRequests} new request${me.friendRequests === 1 ? "" : "s"}` : "Friends page"}</ActionLink>}>
                {me.friendCode ? (
                  <p className="flex flex-wrap items-center gap-3 text-sm text-muted">
                    <span className="rounded-lg bg-surface-2 px-3 py-1.5 font-mono text-xl font-bold tracking-[0.25em] text-ink" data-testid="profile-friend-code">
                      {me.friendCode}
                    </span>
                    Your friend code: friends add you with it.
                  </p>
                ) : (
                  <p className="text-sm text-muted">Pick a nickname and your friend code appears here.</p>
                )}
                <p className="mt-2 text-sm text-muted">
                  {me.friends?.length ? `${me.friends.length} friend${me.friends.length === 1 ? "" : "s"}` : "No friends yet"} · invite one from any match.
                </p>
              </SectionCard>
              <PointsCard user={me.user} />
              <PlansSection />
              <FavoriteTeams teams={me.favorites} />
            </div>
            <div className="flex flex-col gap-4">
              <SectionCard
                title="Your calls"
                action={
                  <ActionLink href="/calls/history">
                    History
                  </ActionLink>
                }
              >
                <dl className="grid grid-cols-3 gap-3 text-center">
                  {[
                    ["Answered", `${data.stats.answered}`],
                    ["Correct", `${data.stats.correctPct}%`],
                    ["Best streak", `${data.stats.bestStreak}`],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg bg-surface-2 p-3">
                      <dt className="text-xs text-muted">{label}</dt>
                      <dd className="mt-1 text-2xl font-bold tabular-nums">{value}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 text-sm text-muted">
                  {data.stats.correct} right across {data.stats.matches} {data.stats.matches === 1 ? "match" : "matches"}.
                </p>
              </SectionCard>
              <SectionCard title="Achievements" action={<ActionLink href="/achievements">See all</ActionLink>}>
                <div className="flex flex-col gap-2">
                  {[...data.achievements]
                    .sort((a, b) => Number(b.unlocked) - Number(a.unlocked))
                    .slice(0, 4)
                    .map((a) => (
                      <AchievementCard key={a.id} a={a} />
                    ))}
                </div>
              </SectionCard>
            </div>
          </div>
        )}
      </main>
    </SiteLayout>
  );
}

/** /achievements: every badge and how close the fan is */
export function AchievementsPage() {
  const { data, status, refresh } = useProfile();
  const unlocked = data?.achievements.filter((a) => a.unlocked).length ?? 0;
  return (
    <SiteLayout sidebar={{ activeLinkId: "achievements", docked: true }}>
      <main className="px-4 pb-12 md:px-6">
        <Breadcrumbs items={[{ label: "Sports", href: "/sports" }, { label: "Achievements" }]} />
        <h1 className="font-serif text-[36px] leading-tight font-bold">Achievements</h1>
        {!data ? (
          status === "error" ? (
            <DataUnavailable what="your achievements" onRetry={refresh} />
          ) : (
            <PageSkeleton cards={4} />
          )
        ) : (
          <>
            <p className="text-sm text-muted">
              {unlocked} of {data.achievements.length} unlocked. Make calls during live games to earn more.
            </p>
            <div className="mt-4 grid max-w-5xl gap-3 md:grid-cols-2">
              {data.achievements.map((a) => (
                <AchievementCard key={a.id} a={a} />
              ))}
            </div>
          </>
        )}
      </main>
    </SiteLayout>
  );
}
