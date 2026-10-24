import { type WordmarkVariant, SportsWordmark } from "../components/TopNav";

const VARIANTS: { id: WordmarkVariant; name: string; note: string }[] = [
  { id: "a", name: "(a) KALEVA + Sports", note: "Chosen. Reads as the paper's own section; the red italic carries the Kaleva accent without a second logo." },
  { id: "b", name: "(b) KALEVA + SPORTS tag", note: "Clear at small sizes, but the tag looks like a badge or a promotion." },
  { id: "c", name: "(c) KALEVA | Sports", note: "Tidy, but the divider makes Sports feel like a separate product." },
];

/** /dev/brand (not linked): the three kaleva sports wordmarks at header sizes, desktop and phone */
export function BrandPage() {
  return (
    <main className="min-h-screen bg-bg px-6 py-10 text-ink">
      <h1 className="font-serif text-3xl font-bold">Kaleva Sports wordmark</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">Text only, in the site's fonts: no logo files. The header uses (a).</p>
      <div className="mt-8 flex flex-col gap-6">
        {VARIANTS.map((v) => (
          <section key={v.id} className={`rounded-card border bg-surface p-6 shadow-card ${v.id === "a" ? "border-accent" : "border-line"}`}>
            <h2 className="text-sm font-semibold">
              {v.name}
              {v.id === "a" && <span className="ml-2 rounded bg-accent px-1.5 py-0.5 text-[11px] text-accent-ink">in use</span>}
            </h2>
            <p className="mt-1 text-sm text-muted">{v.note}</p>
            <div className="mt-5 grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
              <div>
                <p className="mb-2 text-xs text-muted">Desktop header (32 px)</p>
                <div className="flex h-16 items-center border-y border-line px-4">
                  <SportsWordmark variant={v.id} className="text-[32px]" />
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs text-muted">Phone header (26 px, 390 px wide)</p>
                <div className="flex h-14 w-[390px] max-w-full items-center border-y border-line px-4">
                  <SportsWordmark variant={v.id} className="text-[26px]" />
                </div>
              </div>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
