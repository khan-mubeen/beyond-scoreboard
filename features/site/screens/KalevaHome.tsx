import { useState } from "react";
import { KF, KF_EVENTS, KF_FRONT, type KfArticle, type KfBlock, toneOf } from "../kaleva";
import { Icon } from "../components/Icon";
import { KalevaDrawer, KalevaFooter, KalevaHeader, KalevaTopBar, linkProps } from "../components/kaleva/KalevaChrome";

/**
 * "/": the kaleva.fi front page, rebuilt (layout, header, sections, typography, colours and the
 * mobile menu). headlines as the site showed them when studied, each opening the real article in
 * a new tab; photos are placeholder blocks in matching tones. the only change: Kaleva Sports
 * (NEW) leads the section row and takes "Urheilu"'s place in the menu
 */
export function KalevaHome() {
  const [menu, setMenu] = useState(false);
  const blocks = KF_FRONT.blocks;
  return (
    <div className="min-h-screen overflow-x-clip bg-white font-kf text-black">
      <KalevaTopBar onMenu={() => setMenu(true)} open={menu} />
      <KalevaHeader />
      <KalevaDrawer open={menu} onClose={() => setMenu(false)} />

      <main className="mx-auto max-w-[1440px] pt-6 pb-14 lg:px-[75px] lg:pt-[34px]">
        {/* "juuri nyt" */}
        <ul className="flex flex-col gap-[5px] lg:px-0">
          {KF_FRONT.rightNow.map((r) => (
            <li key={r.href}>
              <a {...linkProps(r.href)} className="block bg-kf-grey px-4 py-3 text-[17px] hover:underline lg:px-[15px]">
                <span className="font-bold uppercase">{r.label}:</span> {r.title}
              </a>
            </li>
          ))}
        </ul>

        <div className="mt-6 grid gap-[30px] lg:mt-[124px] lg:grid-cols-[minmax(0,850px)_minmax(0,410px)]">
          <div className="flex min-w-0 flex-col gap-[30px]">
            {blocks.map((b, i) => (
              <div key={i} className="contents">
                <Block block={b} />
                {/* phones: the latest list comes right after the lead story */}
                {i === 0 && (
                  <div className="px-4 lg:hidden">
                    <Latest />
                  </div>
                )}
              </div>
            ))}
            <Events />
          </div>
          <aside aria-label="Uusimmat" className="hidden lg:block">
            <Latest />
          </aside>
        </div>
      </main>
      <KalevaFooter />
    </div>
  );
}

function SectionTitle({ children, line = "bg-kf-orange", big = false }: { children: string; line?: string; big?: boolean }) {
  return (
    <h2 className={`flex items-center gap-3 font-bold uppercase ${big ? "text-[36px] leading-none lg:text-[46px]" : "text-[22px]"}`}>
      {children}
      <span aria-hidden className={`h-[6px] flex-1 ${line}`} />
    </h2>
  );
}

/** a photo we don't copy: a block in a matching tone */
function Photo({ seed, className = "aspect-[3/2]" }: { seed: string; className?: string }) {
  return (
    <div aria-hidden className={`relative w-full overflow-hidden bg-gradient-to-br ${toneOf(seed)} ${className}`}>
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_35%,rgba(255,255,255,0.22),transparent_55%)]" />
    </div>
  );
}

function Label({ text }: { text: string }) {
  return <span className="inline-block bg-kf-label px-2 py-[3px] text-[13px] leading-none font-bold tracking-wide text-white uppercase">{text}</span>;
}

function Meta({ a, topic = false }: { a: KfArticle; topic?: boolean }) {
  return (
    <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] font-semibold text-kf-label">
      {topic && a.topic && <span className="uppercase">{a.topic}</span>}
      {a.date && (
        <span className="flex items-center gap-1">
          <Icon name="history" className="size-3.5" label="Julkaistu" />
          {a.date}
        </span>
      )}
      {a.comments ? (
        <span className="flex items-center gap-1">
          <Icon name="discussion" className="size-3.5" label="Kommentteja" />
          {a.comments}
        </span>
      ) : null}
    </p>
  );
}

function Byline({ a }: { a: KfArticle }) {
  if (!a.opinion) return null;
  return (
    <p className="mb-2 flex flex-wrap items-center gap-2">
      <span className="bg-kf-blue px-2 py-[3px] text-[13px] leading-none font-bold text-white uppercase">{a.opinion}</span>
      {a.topic && <Label text={a.topic} />}
      {a.byline && <span className="w-full text-[15px] font-bold text-kf-blue uppercase">{a.byline}</span>}
    </p>
  );
}

/** a headline linking to the real article (new tab) */
function Headline({ a, className }: { a: KfArticle; className: string }) {
  return (
    <h3 className={className}>
      <a {...linkProps(a.href)} className="hover:underline">
        {a.title}
      </a>
    </h3>
  );
}

function Related({ items }: { items: KfArticle["related"] }) {
  if (!items?.length) return null;
  return (
    <ul className="mt-5">
      {items.map((r) => (
        <li key={r.href} className="border-t border-[#d6d6d6] py-3">
          <a {...linkProps(r.href)} className="font-kf-serif text-[15px] leading-tight font-semibold hover:underline">
            {r.title}
          </a>
        </li>
      ))}
    </ul>
  );
}

function Card({ a }: { a: KfArticle }) {
  return (
    <article className="flex flex-col bg-kf-grey">
      <Photo seed={a.href} />
      <div className="px-4 pt-[18px] pb-[18px]">
        {a.opinion ? <Byline a={a} /> : a.topic && <Label text={a.topic} />}
        <Headline a={a} className={`mt-2 leading-[1.18] ${a.opinion ? "font-kf text-[24px] font-light lg:text-[26px]" : "font-kf-serif text-[24px] font-semibold lg:text-[22px]"}`} />
        <Meta a={a} />
        <Related items={a.related} />
      </div>
    </article>
  );
}

function Block({ block }: { block: KfBlock }) {
  switch (block.kind) {
    case "lead": {
      const a = block.item;
      return (
        <article className="bg-kf-grey">
          <Photo seed={a.href} className="aspect-[850/560]" />
          <div className="px-4 pt-6 pb-4 lg:px-[30px] lg:pt-[34px]">
            {a.topic && <Label text={a.topic} />}
            <Headline a={a} className="mt-3 font-kf-serif text-[30px] leading-[1.17] font-semibold tracking-[-0.01em] lg:text-[36px]" />
            <Meta a={a} />
            <Related items={a.related} />
          </div>
        </article>
      );
    }
    case "pair":
      return (
        <div className="grid gap-[30px] md:grid-cols-2">
          {block.items.map((a) => (
            <Card key={a.href} a={a} />
          ))}
          {block.tip && (
            <aside className="flex flex-col items-center justify-center gap-3 bg-[#f1ece6] px-6 py-10 text-center">
              <p className="text-[22px] font-semibold">Näitkö jotain kiinnostavaa?</p>
              <p className="text-[15px]">Toimitus pyytää lukijoiltaan uutisvihjeitä, -kuvia ja -videoita.</p>
              <a {...linkProps(`${KF}/lukijalta/laheta`)} className="rounded-full bg-kf-orange-ink px-6 py-2.5 text-[15px] font-bold text-white uppercase hover:brightness-110">
                Lähetä vinkkisi
              </a>
            </aside>
          )}
        </div>
      );
    case "lift":
      return (
        <section aria-label={block.band} className="bg-kf-grey">
          <Photo seed={block.lead.href} className="aspect-[850/565]" />
          <p className="bg-kf-orange px-[15px] py-1.5 text-[15px] font-bold text-white uppercase">{block.band}</p>
          <div className="px-4 pt-6 pb-4 lg:px-[30px] lg:pt-[34px]">
            <Headline a={block.lead} className="font-kf-serif text-[30px] leading-[1.17] font-semibold tracking-[-0.01em] lg:text-[36px]" />
            <Meta a={block.lead} topic />
            <ul className="mt-6">
              {block.items.map((a) => (
                <li key={a.href} className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 border-t border-[#d6d6d6] py-[18px] lg:grid-cols-[140px_minmax(0,1fr)]">
                  <Photo seed={a.href} />
                  <div>
                    <Headline a={a} className="font-kf-serif text-[17px] leading-tight font-semibold lg:text-[18px]" />
                    {a.topic && <p className="mt-1 text-[15px] font-semibold text-kf-label uppercase">{a.topic}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      );
    case "videos":
      return (
        <section aria-label={block.title} className="px-4 lg:px-0">
          <SectionTitle>{block.title}</SectionTitle>
          <ul className="mt-6 flex gap-4 overflow-x-auto pb-2">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="w-[180px] shrink-0 lg:w-[230px]">
                <a {...linkProps(`${KF}/videot`)} aria-label="Kalevan lyhytvideot" className="relative block">
                  <Photo seed={`video-${i}`} className="aspect-[9/14] rounded-[6px]" />
                  <span className="absolute inset-0 grid place-items-center">
                    <span className="grid size-12 place-items-center rounded-full bg-black/45 text-white">
                      <Icon name="play" className="size-5" />
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      );
    case "podcasts":
      return (
        <section aria-label={block.title} className="px-4 lg:px-[14px]">
          <h2 className="text-[22px] font-bold uppercase">{block.title}</h2>
          <ul className="mt-6 flex gap-[30px] overflow-x-auto pb-3">
            {block.items.map((p) => (
              <li key={p.href} className="w-[260px] shrink-0 rounded-[4px] bg-kf-grey p-5 shadow-[0_1px_4px_rgba(0,0,0,0.15)] lg:w-[320px]">
                <a {...linkProps(p.href)} className="group block">
                  <div aria-hidden className={`grid aspect-square place-items-center rounded-[22px] bg-gradient-to-br ${toneOf(p.show)}`}>
                    <span className="px-4 text-center font-kf text-[26px] leading-none font-bold text-white uppercase italic">{p.show}</span>
                  </div>
                  <p className="mt-4 flex items-center gap-1 text-[13px] font-bold uppercase">
                    <Icon name="volume" className="size-3.5" /> {p.show}
                  </p>
                  <p className="mt-1 text-[20px] leading-tight font-semibold group-hover:underline lg:text-[22px]">{p.title}</p>
                  <p className="mt-2 text-[15px] text-kf-label">{p.date}</p>
                </a>
              </li>
            ))}
          </ul>
        </section>
      );
    case "games":
      return (
        <section aria-label="Pelit" className="px-4 lg:px-0">
          <h2 className="text-[22px] font-bold uppercase">Pelit</h2>
          <ul className="mt-5 grid grid-cols-2 gap-5 sm:grid-cols-4">
            {KF_FRONT.games.map((g) => (
              <li key={g.href}>
                <a {...linkProps(g.href)} className="group block">
                  <div aria-hidden className="grid aspect-square place-items-center rounded-[8px] bg-gradient-to-br from-[#534ab3] to-[#9b93e6] text-[40px] font-black text-white/90">
                    {g.title[0]}
                  </div>
                  <p className="mt-2 text-[17px] font-semibold group-hover:underline">{g.title}</p>
                  <span className="mt-2 inline-block rounded-full bg-[#534ab3] px-4 py-1 text-[15px] font-bold text-white uppercase">Pelaa</span>
                </a>
              </li>
            ))}
          </ul>
          <a {...linkProps(`${KF}/pelit`)} className="mt-5 inline-block rounded-full border border-kf-label px-5 py-2 text-[16px] font-bold text-kf-label uppercase hover:bg-kf-grey">
            Katso kaikki pelit
          </a>
        </section>
      );
    case "mostRead":
      return (
        <section aria-label="Luetuimmat" className="px-4 lg:px-0">
          <SectionTitle big line="bg-kf-blue">
            Luetuimmat
          </SectionTitle>
          <p className="mt-6 flex gap-1 text-[13px] font-bold uppercase">
            <span className="border border-[#d6d6d6] bg-kf-grey px-2.5 py-1.5">Juuri nyt</span>
            <a {...linkProps(`${KF}/`)} className="border border-[#d6d6d6] px-2.5 py-1.5 text-kf-label hover:bg-kf-grey">
              Tänään
            </a>
            <a {...linkProps(`${KF}/`)} className="border border-[#d6d6d6] px-2.5 py-1.5 text-kf-label hover:bg-kf-grey">
              Tällä viikolla
            </a>
          </p>
          <ol className="mt-4">
            {KF_FRONT.mostRead.map((m, i) => (
              <li key={m.href} className="grid grid-cols-[40px_100px_minmax(0,1fr)] items-start gap-3 border-t border-[#d6d6d6] px-0 py-3 lg:px-[15px]">
                <span className="grid size-10 place-items-center rounded-full bg-kf-blue text-[17px] font-bold text-white">{i + 1}.</span>
                <Photo seed={m.href} className="aspect-[3/2]" />
                <a {...linkProps(m.href)} className="text-[16px] leading-tight font-semibold hover:underline lg:text-[17px]">
                  {m.title}
                </a>
              </li>
            ))}
          </ol>
        </section>
      );
  }
}

/** "Uusimmat": the latest stories, with a thumbnail */
function Latest() {
  return (
    <section aria-labelledby="kf-latest">
      <h2 id="kf-latest" className="flex items-center gap-3 text-[22px] font-bold uppercase">
        Uusimmat
        <span aria-hidden className="h-[6px] flex-1 bg-kf-orange" />
      </h2>
      <ul className="mt-5">
        {KF_FRONT.latest.map((a) => (
          <li key={a.href} className="grid grid-cols-[minmax(0,1fr)_80px] gap-3 border-t border-[#d6d6d6] py-2.5">
            <div>
              {a.href.includes("/podcastit/") && a.topic && (
                <p className="flex items-center gap-1 text-[11px] font-bold uppercase">
                  <Icon name="volume" className="size-3" /> {a.topic}
                </p>
              )}
              <a {...linkProps(a.href)} className="text-[17px] leading-[1.18] font-semibold hover:underline">
                {a.title}
              </a>
              {a.date && (
                <p className="mt-1 flex items-center gap-1 text-[15px] font-semibold text-kf-label">
                  <Icon name="history" className="size-3.5" label="Julkaistu" /> {a.date}
                </p>
              )}
            </div>
            <Photo seed={a.href} className="aspect-square" />
          </li>
        ))}
      </ul>
      <a {...linkProps(`${KF}/uutiset`)} className="mt-4 inline-block rounded-full border border-kf-label px-7 py-2 text-[16px] font-bold text-kf-label uppercase hover:bg-kf-grey">
        Katso lisää
      </a>
    </section>
  );
}

/** "Tapahtumat": events from tapahtumat.kaleva.fi */
function Events() {
  return (
    <section aria-label="Tapahtumat" className="px-4 lg:mt-4 lg:px-0">
      <SectionTitle big line="bg-kf-pink">
        Tapahtumat
      </SectionTitle>
      <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {KF_EVENTS.map((e) => (
          <li key={e.href}>
            <a {...linkProps(e.href)} className="group block">
              <Photo seed={e.title} className="aspect-[16/9]" />
              <p className="mt-3 text-[20px] leading-tight font-bold group-hover:underline">
                {e.title} <Icon name="arrowUpRight" className="inline size-3.5" />
              </p>
              <p className="mt-2 flex items-center gap-1.5 text-[15px] text-kf-pink">
                <Icon name="calendar" className="size-4" /> {e.when}
              </p>
              <p className="mt-1 text-[14px] text-kf-label">{e.where}</p>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
