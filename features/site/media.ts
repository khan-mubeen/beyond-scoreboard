// the kaleva media front page (kalevamedia.fi, rebuilt): its navigation, footer and news cards.
// labels and headings as on the live site; long texts are short paraphrases. every link that
// isn't sports goes to a "this page is part of kalevamedia.fi" page (/media/<slug>) that links on
// to the real page, so the demo never leaves the app by accident

export interface MediaLink {
  label: string;
  /** /media/<slug>: the placeholder, which knows the real page */
  slug: string;
  real: string;
}

export interface MediaNavItem {
  label: string;
  href: string;
  /** the one addition to the original: Sports, with a "New" tag */
  isNew?: boolean;
  sub?: MediaLink[];
}

const KM = "https://www.kalevamedia.fi";

/** every page the placeholder can stand in for, by slug */
export const MEDIA_PAGES: Record<string, { title: string; real: string }> = {};

function link(label: string, slug: string, real: string): MediaLink {
  MEDIA_PAGES[slug] = { title: label, real };
  return { label, slug, real };
}
const href = (l: MediaLink) => `/media/${l.slug}`;
function item(l: MediaLink, sub?: MediaLink[]): MediaNavItem {
  return { label: l.label, href: href(l), ...(sub && { sub }) };
}

export const MEDIA_NAV: MediaNavItem[] = [
  { label: "Etusivu", href: "/" },
  { label: "Sports", href: "/sports", isNew: true },
  item(link("Tietoa meistä", "tietoa-meista", `${KM}/tietoa-meista/`), [
    link("Ajankohtaista", "ajankohtaista", `${KM}/ajankohtaista/`),
    link("Vastuullisuus", "vastuullisuus", "https://kalevakonserni.fi/kaleva-vire/"),
    link("Tietosuoja", "tietosuoja", `${KM}/tietosuoja/`),
  ]),
  item(link("Kuluttajille", "kuluttajille", `${KM}/kuluttajille/`), [
    link("Asiakaspalvelu", "asiakaspalvelu", "https://asiakaspalvelu.kalevamedia.fi/"),
    link("Ohjeet ja tukipalvelut", "ohjeet-ja-tukipalvelut", "https://asiakaspalvelu.kalevamedia.fi/ohjeet-ja-tuki/"),
    link("Lahjakortit", "lahjakortit", `${KM}/kuluttajille/lahjakortit/`),
    link("Kaleva Median lukijayhteisö", "lukijayhteiso", `${KM}/kuluttajille/kaleva-media-paneeli/`),
    link("Podcastit", "podcastit", `${KM}/kotiseuturakkaudella/`),
  ]),
  item(link("Yrityksille", "yrityksille", `${KM}/yrityksille/`)),
  item(link("Avoimet työpaikat", "avoimet-tyopaikat", "https://rekry.kalevamedia.fi/")),
  item(link("Yhteystiedot", "yhteystiedot", `${KM}/yhteystiedot/`), [link("Kaleva Median ilmoituskanava", "ilmoituskanava", `${KM}/ilmoituskanava/`)]),
  item(link("Tietosuoja", "tietosuoja", `${KM}/tietosuoja/`), [link("Tietosuojaseloste", "tietosuojaseloste", `${KM}/tietosuoja/tietosuojaseloste/`)]),
];

/** footer: "Mediat" */
export const MEDIA_TITLES: MediaLink[] = (
  [
    ["Kaleva", "kaleva", "https://www.kaleva.fi/"],
    ["Lapin Kansa", "lapin-kansa", "https://www.lapinkansa.fi/"],
    ["Ilkka-Pohjalainen", "ilkka-pohjalainen", "https://www.ilkkapohjalainen.fi/"],
    ["Koillissanomat", "koillissanomat", "https://www.koillissanomat.fi/"],
    ["Raahen Seutu", "raahen-seutu", "https://www.raahenseutu.fi/"],
    ["Iijokiseutu", "iijokiseutu", "https://www.iijokiseutu.fi/"],
    ["Järviseutu", "jarviseutu", "https://www.jarviseutu-lehti.fi/"],
    ["Jurvan Sanomat", "jurvan-sanomat", "https://www.jurvansanomat.fi/"],
    ["Komiat", "komiat", "https://www.komiat.fi/"],
    ["Pyhäjokiseutu", "pyhajokiseutu", "https://www.pyhajokiseutu.fi/"],
    ["Rantalakeus", "rantalakeus", "https://www.rantalakeus.fi/"],
    ["Siikajokilaakso", "siikajokilaakso", "https://www.siikajokilaakso.fi/"],
    ["Suupohjan Sanomat", "suupohjan-sanomat", "https://www.suupohjansanomat.fi/"],
    ["Viiskunta", "viiskunta", "https://www.viiskunta.fi/"],
    ["Epari", "epari", "https://www.ilkkapohjalainen.fi/epari"],
    ["Forum24", "forum24", "https://www.kaleva.fi/forum24"],
    ["Lounais-Lappi", "lounais-lappi", "https://www.lapinkansa.fi/nakoislehti/lounais-lappi/"],
    ["Uusi Rovaniemi", "uusi-rovaniemi", "https://www.lapinkansa.fi/nakoislehti/uusi-rovaniemi/"],
    ["Raahelainen", "raahelainen", "https://www.kaleva.fi/ekaleva/#raahelainen"],
    ["Vaasa", "vaasa", "https://www.ilkkapohjalainen.fi/vaasa-lehti"],
    ["Radio Kaleva", "radio-kaleva", "https://www.radiokaleva.fi/"],
  ] as const
).map(([l, s, r]) => link(l, s, r));

/** footer: "Etsitkö näitä?", in its three groups */
export const MEDIA_LOOKING_FOR: MediaLink[][] = [
  [
    link("Avoimet työpaikat", "avoimet-tyopaikat", "https://rekry.kalevamedia.fi/"),
    link("Yhteystiedot", "yhteystiedot", `${KM}/yhteystiedot/`),
    link("Ajankohtaista", "ajankohtaista", `${KM}/ajankohtaista/`),
  ],
  [link("Asiakaspalvelu kuluttajille", "asiakaspalvelu", "https://asiakaspalvelu.kalevamedia.fi/"), link("Palvelumme yrityksille", "yrityksille", `${KM}/yrityksille/`)],
  [link("Kaleva Media in English", "in-english", `${KM}/en`)],
];

/** the bottom bar */
export const MEDIA_SOCKET: MediaLink[] = [
  link("Kaleva Media in English", "in-english", `${KM}/en`),
  link("Tietosuoja", "tietosuoja", `${KM}/tietosuoja/`),
  link("Evästeasetukset", "evasteasetukset", `${KM}/#kaleva-media-consent`),
];

export const MEDIA_SOCIAL: (MediaLink & { icon: "linkedin" | "facebook" | "instagram" | "youtube" })[] = [
  { ...link("LinkedIn", "linkedin", "https://www.linkedin.com/company/kalevamedia"), icon: "linkedin" },
  { ...link("Facebook", "facebook", "https://www.facebook.com/kalevamedia/"), icon: "facebook" },
  { ...link("Instagram", "instagram", "https://www.instagram.com/kalevamedia/"), icon: "instagram" },
  { ...link("Youtube", "youtube", "https://www.youtube.com/channel/UC2rKfWoZNf3q8e-xng3tAPw"), icon: "youtube" },
];

/** "Ajankohtaista": the four latest, headings and dates as on the site, teasers paraphrased */
export const MEDIA_NEWS = [
  {
    ...link("Vinkkejä kulttuurin pariin Suuren journalistipalkintogaalan vieraille", "uutinen-kulttuurivinkit", `${KM}/2026/03/10/vinkkeja-kulttuurin-pariin-suuren-journalistipalkintogaalan-vieraille/`),
    date: "10.3.2026",
    teaser: "Oulu on tänä vuonna Euroopan kulttuuripääkaupunki, ja gaalavieraille…",
    tone: "from-[#2a1b3d] via-[#7a2a6b] to-[#1b2340]",
  },
  {
    ...link("Uusi markkinointialan kokonaisuus Suomeen", "uutinen-markkinointi", `${KM}/2025/09/26/uusi-markkinointialan-kokonaisuus-suomeen/`),
    date: "26.9.2025",
    teaser: "Kolme markkinointitoimistoa yhdistyy yhdeksi kokonaisuudeksi…",
    tone: "from-[#e6e4e1] via-[#d8d5d0] to-[#c9b98a]",
  },
  {
    ...link("Kaleva Media ja Ilkka yhdistävät medialiiketoimintansa", "uutinen-ilkka", `${KM}/2025/04/03/kaleva-media-ja-ilkka-yhdistavat-medialiiketoimintansa/`),
    date: "3.4.2025",
    teaser: "Oululainen ja seinäjokelainen mediatalo yhdistävät voimansa…",
    tone: "from-[#16181c] via-[#3a3d44] to-[#121317]",
  },
  {
    ...link("Rantalakeuden uusi päätoimittaja on Henna Lammi", "uutinen-rantalakeus", `${KM}/2024/01/09/rantalakeuden-uusi-paatoimittaja-on-henna-lammi/`),
    date: "9.1.2024",
    teaser: "Rantalakeuden uudeksi päätoimittajaksi on valittu…",
    tone: "from-[#c9d6e2] via-[#e9eef3] to-[#8a9db0]",
  },
];

export const MEDIA_MORE = link("Katso lisää", "ajankohtaista", `${KM}/ajankohtaista/`);
export const MEDIA_BUSINESS = link("Palvelumme yrityksille", "yrityksille", `${KM}/yrityksille/`);

export const mediaHref = href;
