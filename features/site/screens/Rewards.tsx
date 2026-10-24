import type { ReactNode } from "react";
import type { RewardsPage, UserSummary } from "@/shared/types";
import { Icon } from "../components/Icon";
import { PointsBalanceCard } from "../components/PointsCard";
import { AchievementBadge, OfferCard, SubscriptionCard } from "../components/RewardCards";
import { ActionLink } from "../components/SectionCard";
import { Breadcrumbs, SiteLayout } from "../components/SiteLayout";
import { Bone, DataUnavailable, PageSkeleton } from "../components/Skeleton";
import { useToast } from "../components/Toast";
import { useMe, useRewardsPage } from "../data";

function Section({ title, link, children }: { title: string; link?: { label: string; href: string }; children: ReactNode }) {
  return (
    <section aria-label={title} className="mt-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-serif text-2xl font-bold">{title}</h2>
        {link && (
          <ActionLink href={link.href}>
            {link.label} <Icon name="arrowRight" className="size-4" />
          </ActionLink>
        )}
      </div>
      {children}
    </section>
  );
}

const EARN = [
  ["Call It!", "20 points for every call you get right during a live match."],
  ["Watch Together", "Join a room from the match page or its QR code and climb the room leaderboard."],
  ["Every week", "The Weekly Leaderboard runs Monday to Sunday; season points never reset."],
];

function RewardsBody({ page, user }: { page: RewardsPage; user: UserSummary | null }) {
  const toast = useToast();
  const soon = () => toast("Coming soon");

  return (
    <div className="px-4 pb-12 md:px-6">
      <Breadcrumbs items={[{ label: "Sports", href: "/" }, { label: `${page.titleLead} ${page.titleAccent}` }]} />
      <main className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-serif text-[40px] leading-tight font-bold">
              {page.titleLead} <span className="text-accent">{page.titleAccent}</span>
            </h1>
            <p className="mt-1 text-[15px] text-muted">{page.subtitle}</p>
          </div>
          <span className="mt-4">
            <ActionLink href="#how-to-earn">
              How to earn points <Icon name="arrowRight" className="size-4" />
            </ActionLink>
          </span>
        </div>

        <div className="mt-5">{user ? <PointsBalanceCard user={user} earnChips={page.earnChips} /> : <Bone className="h-36 rounded-card" />}</div>

        <Section title="Subscriptions">
          <div className="grid gap-4 md:grid-cols-3">
            {page.subscriptions.map((s) => (
              <SubscriptionCard key={s.id} sub={s} onSubscribe={soon} />
            ))}
          </div>
        </Section>

        <Section title="Partner offers">
          <div className="grid gap-4 md:grid-cols-3">
            {page.offers.map((o) => (
              <OfferCard key={o.id} offer={o} onAction={soon} />
            ))}
          </div>
        </Section>

        <Section title="Your achievements" link={{ label: "View all", href: "/achievements" }}>
          <div className="grid gap-4 md:grid-cols-3">
            {page.achievements.map((a) => (
              <AchievementBadge key={a.id} achievement={a} />
            ))}
          </div>
        </Section>

        <section id="how-to-earn" aria-label="How to earn points" className="mt-8 scroll-mt-20 rounded-card border border-line bg-surface p-5 shadow-card">
          <h2 className="font-serif text-2xl font-bold">How to earn points</h2>
          <ul className="mt-3 grid gap-3 md:grid-cols-3">
            {EARN.map(([title, text]) => (
              <li key={title} className="rounded-lg bg-surface-2 p-4 text-sm">
                <p className="font-semibold">{title}</p>
                <p className="mt-1 text-muted">{text}</p>
              </li>
            ))}
          </ul>
        </section>

        <p className="mt-8 text-xs text-muted">{page.footnote}</p>
      </main>
    </div>
  );
}

/** kaleva rewards (docs/design/04-rewards.png). the balance comes from /me, like the sidebar */
export function Rewards() {
  const { data: page, status, source, refresh } = useRewardsPage();
  const me = useMe();
  return (
    <SiteLayout sidebar={{ activeLinkId: "rewards", variant: "compact", docked: true }} source={source === "mock" ? source : null}>
      {page ? (
        <RewardsBody page={page} user={me.data?.user ?? null} />
      ) : status === "error" ? (
        <DataUnavailable what="your rewards" onRetry={refresh} />
      ) : (
        <PageSkeleton />
      )}
    </SiteLayout>
  );
}
