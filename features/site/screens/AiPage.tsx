import { HOW_WE_USE_AI } from "../components/AiLabel";
import { Icon, type IconName } from "../components/Icon";
import { Breadcrumbs, SiteLayout } from "../components/SiteLayout";
import { usePageTitle } from "../components/usePageTitle";

const LABELS: [string, string][] = [
  ["AI-written · facts checked against Liiga data", "An AI model wrote the wording from a list of facts. Every number and name in it was checked against the facts before it could be shown."],
  ["Written from match data", "Our own templates filled in from the match data. No AI was used for the words."],
  ["Reviewed by a Kaleva editor", "An editor read and approved exactly this text. A text no editor approved is never shown; the template version is shown instead."],
  ["Question wording by AI · answers decided by Liiga data", "The question's wording came from wordings an AI suggested and an editor approved. Whether you were right is decided by what happens in the game, never by AI."],
  ["Automatic question from live data", "A built-in question that opens on its own when something happens in the game."],
  ["From Liiga data", "Trivia and answers to your questions come straight from the Liiga data: rosters, goals, the table."],
  ["AI voice (Azure) / Device voice", "The 60-second summary is read by an AI voice when we have one, otherwise by your device's own voice."],
];

const STEPS: { icon: IconName; title: string; text: string }[] = [
  { icon: "chart", title: "The data", text: "Goals, penalties, rosters and the table from the Liiga feed." },
  { icon: "bolt", title: "The model", text: "Thousands of simulated seasons give each team's playoff, top-4 and relegation chance." },
  { icon: "sparkle", title: "The words", text: "AI may write the wording, but only from a list of facts: it can't type a number of its own." },
  { icon: "check", title: "The checks", text: "A validator blocks any sentence with a number, name or claim that isn't in the facts, and anything said twice." },
  { icon: "profile", title: "The editors", text: "A Kaleva editor approves AI stories before they're shown, and reads every reported mistake." },
];

/** /sports/ai: how kaleva sports uses ai, in plain words */
export function AiPage() {
  usePageTitle("How we use AI · Kaleva Sports");
  return (
    <SiteLayout sidebar={{ docked: true }}>
      <main className="mx-auto max-w-3xl px-4 pb-14 md:px-6">
        <Breadcrumbs items={[{ label: "Sports", href: "/sports" }, { label: "How we use AI" }]} />
        <h1 className="font-serif text-[36px] leading-tight font-bold md:text-[44px]">How we use AI</h1>
        <p className="mt-2 text-[17px] text-muted">AI helps us write. It never decides what's true: every number comes from data, and people check the words.</p>

        <section aria-labelledby="ai-rules" className="mt-6 rounded-card border border-line bg-surface p-5 shadow-card">
          <h2 id="ai-rules" className="text-lg font-bold">
            The short version
          </h2>
          <ul className="mt-3 flex flex-col gap-2.5">
            {HOW_WE_USE_AI.map((t) => (
              <li key={t} className="flex gap-2.5 text-[15px]">
                <Icon name="check" className="mt-0.5 size-4 shrink-0 text-good" />
                {t}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="ai-steps" className="mt-5 rounded-card border border-line bg-surface p-5 shadow-card">
          <h2 id="ai-steps" className="text-lg font-bold">
            From the rink to your screen
          </h2>
          <ol className="mt-3 flex flex-col gap-2">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex flex-col gap-1 rounded-lg bg-surface-2 p-3 text-sm sm:flex-row sm:items-center sm:gap-4">
                <span className="flex shrink-0 items-center gap-1.5 font-semibold sm:w-36">
                  <span className="grid size-6 place-items-center rounded-full bg-accent text-xs text-accent-ink">{i + 1}</span>
                  <Icon name={s.icon} className="size-4" /> {s.title}
                </span>
                <p className="text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="ai-labels" className="mt-5 rounded-card border border-line bg-surface p-5 shadow-card">
          <h2 id="ai-labels" className="text-lg font-bold">
            The labels you see
          </h2>
          <dl className="mt-3 flex flex-col divide-y divide-line">
            {LABELS.map(([label, text]) => (
              <div key={label} className="py-3">
                <dt className="font-semibold">{label}</dt>
                <dd className="mt-0.5 text-sm text-muted">{text}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="ai-report" className="mt-5 rounded-card border border-line bg-surface p-5 shadow-card">
          <h2 id="ai-report" className="text-lg font-bold">
            Found a mistake?
          </h2>
          <p className="mt-2 text-[15px]">Under every story, summary and AI-worded question there's a "Report a mistake" link. Tell us what's wrong in a few words: an editor reads every report.</p>
          <a href="/sports" className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-ink">
            Back to Kaleva Sports <Icon name="arrowRight" className="size-4" />
          </a>
        </section>
      </main>
    </SiteLayout>
  );
}
