import { useState } from "react";
import type { MeResponse } from "@/shared/types";
import { BadgeSummary, BadgeTile, Medal, nextUp, nextUpText } from "../components/Badges";
import { FavoriteTeams } from "../components/FavoriteTeams";
import { levelText } from "../components/PointsCard";
import { ActionLink, SectionCard } from "../components/SectionCard";
import { SitePage } from "../components/SitePage";
import { DataUnavailable, PageSkeleton } from "../components/Skeleton";
import { PurchaseHistory, SubscriptionCard } from "../components/RewardCards";
import { CheckoutModal } from "../components/Checkout";
import { Avatar } from "../components/TeamLogo";
import { useCountUp } from "../components/use-count-up";
import { useMe, useProfile, useRewardsPage } from "../data";
import { fmtInt } from "../format";
import { NicknameForm } from "./SettingsPage";

/** the fan's running plans (cancel stops renewal; they stay active until they end) and purchases */
function PlansSection() {
  const page = useRewardsPage().data;
  const balance = useMe().data?.wallet.balance ?? 0;
  const [checkout, setCheckout] = useState<{ planId: string; points: number } | null>(null);
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
            active.map((s) => <SubscriptionCard key={s.id} sub={s} balance={balance} onSubscribe={(points) => setCheckout({ planId: s.id, points })} />)
          )}
          {page.history && page.history.length > 0 && <PurchaseHistory items={page.history} />}
        </div>
      )}
      <CheckoutModal planId={checkout?.planId ?? null} initialPoints={checkout?.points ?? null} open={checkout !== null} onClose={() => setCheckout(null)} />
    </SectionCard>
  );
}

/** the level as a ring around its number: the share of the way to the next level */
function LevelRing({ level, progress }: { level: number; progress: number }) {
  const r = 30;
  const circ = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 72 72" width="72" height="72" role="img" aria-label={`Level ${level}, ${Math.round(progress * 100)}% to the next`}>
      <circle cx="36" cy="36" r={r} fill="none" stroke="var(--pp-surface-2)" strokeWidth="7" />
      <circle cx="36" cy="36" r={r} fill="none" stroke="var(--pp-accent)" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${circ * progress} ${circ}`} transform="rotate(-90 36 36)" />
      <text x="36" y="33" textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--pp-muted)">
        LEVEL
      </text>
      <text x="36" y="47" textAnchor="middle" fontSize="17" fontWeight="800" fill="var(--pp-ink)">
        {level}
      </text>
    </svg>
  );
}

/** one header across the page: who, the level, the balance, this week, the friend code */
function ProfileHeader({ me }: { me: MeResponse }) {
  const u = me.user;
  const points = useCountUp(u.points);
  return (
    <section aria-label="Your profile" className="grid gap-5 rounded-card border border-line bg-surface p-5 shadow-card md:grid-cols-[minmax(0,1fr)_auto] md:items-center" data-testid="profile-header">
      <div className="flex min-w-0 items-center gap-4">
        <Avatar src={u.avatar} name={u.name} size={72} />
        <div className="min-w-0">
          <p className="truncate text-2xl font-bold">{me.nickname ?? u.name}</p>
          <p className="text-sm text-muted">{u.role}</p>
          {me.friendCode && (
            <p className="mt-2 inline-flex items-center gap-2 rounded-lg bg-surface-2 px-2.5 py-1 text-xs text-muted">
              Friend code
              <span className="font-mono text-base font-bold tracking-[0.2em] text-ink" data-testid="profile-friend-code">
                {me.friendCode}
              </span>
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-3">
          <LevelRing level={u.level} progress={u.levelProgress} />
          <p className="max-w-40 text-sm text-muted">{levelText(u)}</p>
        </div>
        <div className="border-line md:border-l md:pl-6">
          <p className="text-xs text-muted">Points balance</p>
          <p className="text-3xl leading-tight font-bold tabular-nums" aria-live="polite">
            {fmtInt(points)}
          </p>
        </div>
        <div className="border-line md:border-l md:pl-6">
          <p className="text-xs text-muted">Earned this week</p>
          <p className="text-3xl leading-tight font-bold text-good tabular-nums">+{fmtInt(u.pointsThisWeek)}</p>
        </div>
      </div>
    </section>
  );
}

/** /profile: the header, then name, friends, plans and teams beside call stats and badges */
export function ProfilePage() {
  const me = useMe().data;
  const { data, status, refresh } = useProfile();
  const next = data ? nextUp(data.achievements) : null;

  return (
    <SitePage activeLinkId="profile" crumbs={[{ label: "Sports", href: "/sports" }, { label: "Profile" }]} title="Your profile">
      {!me || !data ? (
        status === "error" ? (
          <DataUnavailable what="your profile" onRetry={refresh} />
        ) : (
          <PageSkeleton cards={4} />
        )
      ) : (
        <>
          <ProfileHeader me={me} />
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-4">
              <SectionCard title="Your name">
                <NicknameForm current={me.nickname} />
              </SectionCard>
              <SectionCard title="Friends" action={<ActionLink href="/friends">{me.friendRequests ? `${me.friendRequests} new request${me.friendRequests === 1 ? "" : "s"}` : "Friends page"}</ActionLink>}>
                <p className="text-sm text-muted">
                  {me.friends?.length ? `${me.friends.length} friend${me.friends.length === 1 ? "" : "s"}` : "No friends yet"} ·{" "}
                  {me.friendCode ? "friends add you with your code, or invite one from any match." : "pick a nickname to get your friend code."}
                </p>
              </SectionCard>
              <PlansSection />
              <FavoriteTeams teams={me.favorites} />
            </div>
            <div className="flex flex-col gap-4">
              <SectionCard title="Your calls" action={<ActionLink href="/calls/history">History</ActionLink>}>
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
              <SectionCard
                title={`Achievements · ${data.achievements.filter((a) => a.unlocked).length} of ${data.achievements.length}`}
                action={<ActionLink href="/achievements">See all</ActionLink>}
              >
                <ul className="grid grid-cols-4 gap-2" aria-label="Your badges">
                  {data.achievements.map((a) => (
                    <li key={a.id} className="flex flex-col items-center gap-1 text-center" title={`${a.title}: ${a.description}`}>
                      <Medal a={a} size={64} />
                      <span className={`text-xs font-semibold ${a.unlocked ? "" : "text-muted"}`}>{a.title}</span>
                    </li>
                  ))}
                </ul>
                {next && <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-sm">Next up: {nextUpText(next)}</p>}
              </SectionCard>
            </div>
          </div>
        </>
      )}
    </SitePage>
  );
}

/** /achievements: every badge as a medal, with the summary and the next one to get */
export function AchievementsPage() {
  const { data, status, refresh } = useProfile();
  return (
    <SitePage
      activeLinkId="achievements"
      crumbs={[{ label: "Sports", href: "/sports" }, { label: "Achievements" }]}
      title="Achievements"
      intro="Make calls during live games, follow a team and join the party to earn badges."
    >
      {!data ? (
        status === "error" ? (
          <DataUnavailable what="your achievements" onRetry={refresh} />
        ) : (
          <PageSkeleton cards={4} />
        )
      ) : (
        <>
          <BadgeSummary list={data.achievements} />
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label="All badges">
            {data.achievements.map((a) => (
              <BadgeTile key={a.id} a={a} />
            ))}
          </ul>
        </>
      )}
    </SitePage>
  );
}
