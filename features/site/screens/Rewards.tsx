import type { ReactNode } from "react";
import type { RewardsPage, SiteChrome } from "@/shared/types";
import { Icon } from "../components/Icon";
import { PageLoading } from "../components/PageLoading";
import { PointsBalanceCard } from "../components/PointsCard";
import { AchievementBadge, OfferCard, SubscriptionCard } from "../components/RewardCards";
import { ActionLink } from "../components/SectionCard";
import { Breadcrumbs, SiteLayout } from "../components/SiteLayout";
import { useToast } from "../components/Toast";
import { useRewardsPage, useSiteChrome } from "../data";

function Section({ title, link, children }: { title: string; link: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="mt-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-serif text-2xl font-bold">{title}</h2>
        <ActionLink href="#">
          {link} <Icon name="arrowRight" className="size-4" />
        </ActionLink>
      </div>
      {children}
    </section>
  );
}

function RewardsBody({ page, chrome }: { page: RewardsPage; chrome: SiteChrome }) {
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
            <ActionLink href={page.howToEarnHref}>
              How to earn points <Icon name="arrowRight" className="size-4" />
            </ActionLink>
          </span>
        </div>

        <div className="mt-5">
          <PointsBalanceCard user={chrome.user} earnChips={page.earnChips} />
        </div>

        <Section title="Subscriptions" link="Compare passes">
          <div className="grid gap-4 md:grid-cols-3">
            {page.subscriptions.map((s) => (
              <SubscriptionCard key={s.id} sub={s} onSubscribe={soon} />
            ))}
          </div>
        </Section>

        <Section title="Partner offers" link="View all">
          <div className="grid gap-4 md:grid-cols-3">
            {page.offers.map((o) => (
              <OfferCard key={o.id} offer={o} onAction={soon} />
            ))}
          </div>
        </Section>

        <Section title="Your achievements" link="View all">
          <div className="grid gap-4 md:grid-cols-3">
            {page.achievements.map((a) => (
              <AchievementBadge key={a.id} achievement={a} />
            ))}
          </div>
        </Section>

        <p className="mt-8 text-xs text-muted">{page.footnote}</p>
      </main>
    </div>
  );
}

/** kaleva rewards (docs/design/04-rewards.png) */
export function Rewards() {
  const { data: page, source } = useRewardsPage();
  const chrome = useSiteChrome(page?.user);
  return (
    <SiteLayout
      chrome={chrome}
      sidebar={{ activeLinkId: "rewards", variant: "compact", docked: true }}
      source={source === "mock" ? source : null}
    >
      {page ? <RewardsBody page={page} chrome={chrome} /> : <PageLoading label="Loading your rewards…" />}
    </SiteLayout>
  );
}
