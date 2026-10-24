import type { HeroData } from "@/shared/types";

/** the editorial header: serif title on white, a photo (placeholder) fading in on the right */
export function HeroBanner({ hero }: { hero: HeroData }) {
  return (
    <section className="relative overflow-hidden rounded-card md:min-h-[190px]">
      <div
        aria-hidden
        className="absolute inset-y-0 right-0 hidden w-[55%] bg-cover bg-center md:block"
        style={{ backgroundImage: `url(${hero.image})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/40 to-transparent" />
      </div>
      <div className="relative max-w-[640px] py-2">
        <p className="font-serif text-xl leading-none font-black">{hero.kicker}</p>
        <h1 className="mt-1 font-serif text-[44px] leading-[1.05] font-black tracking-tight sm:text-[60px]">
          {hero.titleLead} <span className="text-accent">{hero.titleAccent}</span>
        </h1>
        <p className="mt-2 text-lg text-ink sm:text-xl">{hero.subtitle}</p>
        <p className="mt-2 max-w-[460px] text-[15px] text-muted">{hero.body}</p>
      </div>
      <p className="absolute top-1/2 right-8 hidden max-w-[150px] -translate-y-1/2 text-xl leading-tight font-medium text-dark-ink md:block">
        {hero.tagline}
        <span aria-hidden className="mt-2 block h-0.5 w-10 bg-accent" />
      </p>
    </section>
  );
}
