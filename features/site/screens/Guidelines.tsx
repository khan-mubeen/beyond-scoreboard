import { Breadcrumbs, SiteLayout } from "../components/SiteLayout";

const RULES = [
  ["Be kind", "Cheer for your team, not against people. No insults, threats or slurs."],
  ["Keep it about the game", "Talk about the match, the players and the season."],
  ["No gambling talk", "This is a place for fans, not for money: no gambling tips and no links to gambling sites."],
  ["One comment every few seconds", "Give everyone room to talk. Comments are 280 characters at most."],
  ["We may hide comments", "Comments that break these rules can be removed without notice."],
];

/** /guidelines: the rules for the live discussion */
export function Guidelines() {
  return (
    <SiteLayout sidebar={{ docked: true }}>
      <div className="px-4 pb-12 md:px-6">
        <Breadcrumbs items={[{ label: "Sports", href: "/sports" }, { label: "Community guidelines" }]} />
        <main className="max-w-2xl">
          <h1 className="font-serif text-[36px] leading-tight font-bold">Community guidelines</h1>
          <p className="mt-2 text-muted">The live discussion is for fans watching together. Five simple rules:</p>
          <ol className="mt-5 flex flex-col gap-3">
            {RULES.map(([title, text], i) => (
              <li key={title} className="rounded-card border border-line bg-surface p-4 shadow-card">
                <p className="font-semibold">
                  {i + 1}. {title}
                </p>
                <p className="mt-1 text-sm text-muted">{text}</p>
              </li>
            ))}
          </ol>
        </main>
      </div>
    </SiteLayout>
  );
}
