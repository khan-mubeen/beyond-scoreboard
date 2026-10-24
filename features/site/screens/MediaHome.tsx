import { MediaFooter, MediaHeader } from "../components/media/MediaChrome";
import { MEDIA_BUSINESS, MEDIA_MORE, MEDIA_NEWS, MEDIA_PAGES, mediaHref } from "../media";

/**
 * "/": the kaleva media front page, rebuilt (layout, order, labels and headings as on
 * kalevamedia.fi; images are placeholder blocks in matching tones, long texts are paraphrased).
 * the one addition is Sports in the menu
 */
export function MediaHome() {
  return (
    <div className="min-h-screen overflow-x-clip bg-white font-km text-km-ink">
      <MediaHeader activeHref="/" />
      <main>
        {/* elämä on paikallista */}
        <section className="mx-auto max-w-[1224px] px-6 pt-14 pb-16 lg:pt-[90px] lg:pb-[180px] xl:px-0">
          <div className="grid gap-8 lg:grid-cols-[359px_minmax(0,1fr)] lg:gap-[73px]">
            <div
              role="img"
              aria-label="Elämä on paikallista"
              className="grid aspect-square w-full place-items-center rounded-[3px] bg-[#252736] lg:mt-[91px] lg:w-[359px]"
            >
              <span className="font-km-logo text-[clamp(15px,4.6vw,18px)] font-extrabold tracking-[0.04em] text-white">ELÄMÄ ON PAIKALLISTA</span>
            </div>
            <div className="max-w-[792px]">
              <h1 className="text-[44px] leading-[1.1] font-bold tracking-[-1.5px] text-km-ink lg:text-[50px] lg:leading-[60px]">Elämä on paikallista</h1>
              <div className="mt-7 flex flex-col gap-[14px] text-[17px] leading-[1.4] lg:mt-[35px] lg:text-[18px]">
                <p>Elämä on tässä ja nyt: kotikulmilla, toreilla ja harrastuksissa. Meitä kiinnostavat oman seudun asiat, sillä tärkeimmät tarinat ovat lähellä.</p>
                <p>Olemme kertoneet ympäröivästä elämästä jo 125 vuotta, ja olemme paikalla, kun jotain tapahtuu.</p>
                <p>Annamme äänen niille, jotka tekevät seudusta ainutlaatuisen ja vievät sen tarinaa maailmalle.</p>
                <p>Vahvistamme paikallista elinvoimaa, jotta jokainen voi olla osa tätä tarinaa.</p>
                <p>Olemme paikallisen elämän mediatalo.</p>
              </div>
              <a
                href={mediaHref(MEDIA_BUSINESS)}
                className="mt-7 inline-flex rounded-full bg-km-blue px-[30px] py-[15px] text-[18px] leading-none font-semibold text-white hover:brightness-110"
              >
                {MEDIA_BUSINESS.label}
              </a>
            </div>
          </div>
        </section>

        {/* phones get the video slideshow here (desktop doesn't show it) */}
        <div aria-hidden className="h-[560px] bg-gradient-to-b from-[#3d4652] via-[#6b6f76] to-[#2b2e33] lg:hidden" />

        {/* ajankohtaista */}
        <section aria-labelledby="km-ajankohtaista" className="mx-auto max-w-[1224px] px-6 pt-12 pb-16 lg:pt-[50px] lg:pb-[80px] xl:px-0">
          <h2 id="km-ajankohtaista" className="text-[24px] font-bold tracking-[1px] text-km-ink uppercase lg:text-[30px] lg:leading-9">
            Ajankohtaista
          </h2>
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 lg:mt-[40px] lg:grid-cols-4 lg:gap-x-[73px]">
            {MEDIA_NEWS.map((n) => (
              <article key={n.slug}>
                <a href={mediaHref(n)} className="block">
                  <div aria-hidden className={`aspect-[251/179] w-full rounded-[3px] bg-gradient-to-br ${n.tone}`} />
                  <h3 className="mt-3 text-[16px] leading-[1.3] font-bold tracking-[-0.54px] text-black hover:underline lg:text-[18px]">{n.label}</h3>
                </a>
                <p className="mt-1 text-[13px] text-[#919191]">{n.date}</p>
                <p className="mt-2 text-[13px] leading-[1.6] text-[#444]">{n.teaser}</p>
              </article>
            ))}
          </div>
          <a href={mediaHref(MEDIA_MORE)} className="mt-14 inline-block text-[18px] font-semibold text-[#1d5ea8] hover:underline lg:mt-[70px]">
            {MEDIA_MORE.label}
          </a>
        </section>
      </main>
      <MediaFooter />
    </div>
  );
}

/** /media/:slug: a kalevamedia.fi page we don't rebuild. same header and footer, a link to the real one */
export function MediaPlaceholder({ slug }: { slug: string }) {
  const page = MEDIA_PAGES[slug];
  return (
    <div className="min-h-screen overflow-x-clip bg-white font-km text-km-ink">
      <MediaHeader activeHref={`/media/${slug}`} />
      <main className="mx-auto max-w-[1224px] px-6 py-20 xl:px-0">
        <h1 className="text-[36px] leading-tight font-bold tracking-[-1px] lg:text-[44px]">{page?.title ?? "Kaleva Media"}</h1>
        <p className="mt-4 max-w-2xl text-[18px] leading-[1.5]">
          Tämä sivu on osa kalevamedia.fi-sivustoa. <span className="text-[#666]">This page is part of kalevamedia.fi.</span>
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          {page && (
            <a href={page.real} target="_blank" rel="noreferrer" className="inline-flex rounded-full bg-km-blue px-[26px] py-[13px] text-[16px] font-semibold text-white hover:brightness-110">
              Avaa sivu kalevamedia.fi:ssä ↗
            </a>
          )}
          <a href="/" className="inline-flex rounded-full border border-km-ink px-[26px] py-[13px] text-[16px] font-semibold hover:bg-km-paper">
            Etusivulle
          </a>
          <a href="/sports" className="inline-flex rounded-full border border-[#d80016] px-[26px] py-[13px] text-[16px] font-semibold text-[#d80016] hover:bg-[#fdeef0]">
            Kaleva Sports
          </a>
        </div>
      </main>
      <MediaFooter />
    </div>
  );
}
