// the kaleva.fi front page, rebuilt: its top bar, header navigation, drawer menu, footer, and the
// headlines as the live site showed them when it was studied (kaleva-front.json: headline text
// only, each linking to the real article in a new tab; no invented news). the one change to the
// original: the drawer's "Urheilu" is "Kaleva Sports" with a NEW tag, linking to /sports
import front from "./kaleva-front.json";

export const KF = "https://www.kaleva.fi";
const kf = (path: string) => (path.startsWith("http") ? path : `${KF}${path}`);

export interface KalevaLink {
  label: string;
  href: string;
  /** ours: Kaleva Sports with its icon and a red NEW tag */
  sports?: boolean;
}

const L = (label: string, path: string): KalevaLink => ({ label, href: kf(path) });

/** the orange top bar */
export const KF_TOP: KalevaLink[] = [L("Asiakaspalvelu", "https://asiakaspalvelu.kaleva.fi/kaleva/"), L("Jätä ilmoitus", "https://asiakaspalvelu.kaleva.fi/kaleva/lukijailmoitukset/"), L("Palvelumme yrityksille", "https://www.kalevamedia.fi/yrityksille"), L("Haku", "/haku")];
export const KF_SUBSCRIBE = L("Tilaa", "https://asiakaspalvelu.kaleva.fi/kaleva/tilaa-kaleva-3/");
export const KF_LOGIN = L("Kirjaudu", "/");

/** the header row */
export const KF_NAV: KalevaLink[] = [L("Oulun seutu", "/oulun-seutu"), L("Uusimmat", "/uutiset"), L("Livet", "/live"), L("Podcastit", "/podcastit"), L("Radio", "https://www.radiokaleva.fi/"), L("Näköislehdet", "/nakoislehdet")];

export const SPORTS_ENTRY: KalevaLink = { label: "Kaleva Sports", href: "/sports", sports: true };

/** the drawer, group by group, as on the site; "Urheilu" is our Kaleva Sports */
export const KF_DRAWER: { title: KalevaLink; items: KalevaLink[] }[] = [
  {
    title: L("Uutiset", "/uutiset"),
    items: [
      L("Etusivu", "/"),
      L("Oulun seutu", "/oulun-seutu"),
      L("Pohjois-Suomi", "/pohjois-suomi"),
      L("Forum24", "/forum24"),
      L("Kotimaa", "/kotimaa"),
      SPORTS_ENTRY,
      L("Kiekko-Kaleva", "/kiekko-kaleva"),
      L("Ulkomaat", "/ulkomaat"),
      L("Kulttuuri", "/kulttuuri"),
      L("Historia", "/historia"),
      L("Luonto", "/luonto"),
      L("Hyvä elämä", "/hyva-elama"),
      L("Ruoka", "/ruoka"),
      L("Koti-Kaleva", "/koti"),
      L("Oikaisut", "/oikaisut"),
      L("Uusimmat", "/uutiset"),
      L("Haku", "/haku"),
    ],
  },
  { title: L("Podcastit", "/podcastit"), items: [] },
  { title: L("Livet", "/live"), items: [] },
  { title: L("Radio Kaleva", "https://www.radiokaleva.fi/"), items: [] },
  {
    title: { label: "", href: "" },
    items: [
      L("Galleriat", "/galleriat"),
      L("Videot", "/videot"),
      L("Kuolleita", "/kuolleita"),
      L("Lukijakuvat ja -videot", "/lukijalta"),
      L("Lähetä kuva tai video", "/lukijalta/laheta"),
      L("Sarjakuvat", "/sarjakuvat"),
      L("Pelit ja visat", "/pelit"),
      L("Sää", "/saa"),
      L("Tapahtumat", "https://tapahtumat.kaleva.fi/fi-FI"),
      L("Ura", "/ura"),
    ],
  },
  { title: L("Mielipiteet", "/mielipiteet"), items: [L("Pääkirjoitukset", "/paakirjoitukset"), L("Esseet", "/esseet"), L("Kolumnit", "/kolumnit"), L("Lukijan mielipide", "/mielipiteet")] },
  {
    title: L("Näköislehdet", "/nakoislehdet"),
    items: [L("Kaleva", "/nakoislehdet/kaleva"), L("Rantalakeus", "/nakoislehdet/rantalakeus"), L("Siikajokilaakso", "/nakoislehdet/siikajokilaakso"), L("Iijokiseutu", "/nakoislehdet/iijokiseutu"), L("Pyhäjokiseutu", "/nakoislehdet/pyhajokiseutu")],
  },
  { title: L("Kaupallinen yhteistyö", "/kaupallinen-yhteistyo"), items: [L("Oulu2026", "/oulu2026"), L("Pohjois-Pohjanmaan Yrittäjät", "/ppy"), L("Koulutukset", "/koulutus"), L("Asianajo- ja lakiasiaintoimistot", "https://sivustot.kaleva.fi/asianajajat/")] },
  { title: L("Lähetä uutisvinkki", "/lukijalta/laheta"), items: [] },
  {
    title: L("Tilaa Kaleva", "https://asiakaspalvelu.kaleva.fi/kaleva/tilaa-kaleva-3/"),
    items: [
      L("Asiakaspalvelu", "https://asiakaspalvelu.kaleva.fi/kaleva/"),
      L("Hallitse tilauksiasi", "https://itsepalvelu.kalevamedia.fi/"),
      L("Tilaajaedut", "/kumppaniedut"),
      L("Yhteystiedot", "https://asiakaspalvelu.kaleva.fi/kaleva/yhteystiedot/"),
      L("Palvelumme yrityksille", "https://www.kalevamedia.fi/yrityksille"),
      L("Jätä lukijailmoitus", "https://asiakaspalvelu.kaleva.fi/kaleva/lukijailmoitukset/"),
      L("Palaute", "https://asiakaspalvelu.kaleva.fi/kaleva/yhteystiedot/ota-yhteytta/"),
    ],
  },
];

/** the footer: its two buttons, its links, its three contact columns */
export const KF_FOOTER = {
  buttons: [L("Tilaa Kaleva", "https://asiakaspalvelu.kaleva.fi/kaleva/tilaa-kaleva-3/"), L("Lähetä vinkki, kuva tai video", "/lukijalta/laheta")],
  links: [L("Asiakaspalvelu", "https://asiakaspalvelu.kaleva.fi/kaleva/"), L("Jätä lukijailmoitus", "https://asiakaspalvelu.kaleva.fi/kaleva/lukijailmoitukset/"), L("Palvelumme yrityksille", "https://www.kalevamedia.fi/yrityksille"), L("Kaleva Media", "https://www.kalevamedia.fi/"), L("Tietosuoja", "https://www.kalevamedia.fi/tietosuoja/")],
  columns: [
    { title: "Toimitus", lines: ["toimitus@kaleva.fi", "08 5377 111", "Postiosoite: Kaleva/toimitus PL 170, 90101 OULU", "Käyntiosoite: Kirkkokatu 31, 90100 OULU", "Julkaisija: Kaleva Media Oy"] },
    { title: "Asiakaspalvelu", lines: ["08 5377 610", "ma–pe 9–19, la 9–15"] },
    { title: "Palvelumme yrityksille", lines: ["yrityksille@kalevamedia.fi", "Kaleva Media PL 170, 90101 Oulu", "08 5377 180", "ma–pe 8–16"] },
  ],
};

export interface KfArticle {
  title: string;
  href: string;
  topic?: string;
  date?: string;
  comments?: number;
  byline?: string;
  opinion?: string;
  related?: { title: string; href: string }[];
}

export type KfBlock =
  | { kind: "lead"; item: KfArticle }
  | { kind: "pair"; items: KfArticle[]; tip?: boolean }
  | { kind: "lift"; band: string; lead: KfArticle; items: KfArticle[] }
  | { kind: "videos"; title: string }
  | { kind: "podcasts"; title: string; items: { show: string; title: string; href: string; date: string }[] }
  | { kind: "games" }
  | { kind: "mostRead" };

export const KF_FRONT = front as unknown as {
  studied: string;
  rightNow: { label: string; title: string; href: string }[];
  blocks: KfBlock[];
  latest: { title: string; href: string; topic: string | null; date: string | null }[];
  mostRead: { title: string; href: string }[];
  games: { title: string; href: string }[];
};

/** the events block (tapahtumat.kaleva.fi), as listed when studied */
export const KF_EVENTS = [
  { title: "Kuuttaren puutarha", when: "su 25.10.2026 klo 11:00", where: "Kivisydän Parkkihalli, Hallituskatu 20, 90100 Oulu", href: "https://tapahtumat.kaleva.fi/fi-FI/page/6a855b89cb28875de8823db6" },
  { title: "Herrasmiehet lavalla (Madetojan sali)", when: "su 25.10.2026 klo 17:00", where: "Madetojan sali, Leevi Madetojan katu 3, 90100 Oulu", href: "https://tapahtumat.kaleva.fi/fi-FI/page/69f4583ae233c09779ee6022" },
  { title: "Berlin Berlin", when: "su 25.10.2026 klo 14:00", where: "Oulun Työväen Näyttämö, Upseerinkatu 4, 90130 Oulu", href: "https://tapahtumat.kaleva.fi/fi-FI/page/6a0272b5faedccb9e95a89e1" },
  { title: "Tuure Kilpeläinen - Suomalaisii unelmii -konserttisalikiertue 2026 (Pohjankartanon sali)", when: "su 25.10.2026 klo 19:00", where: "Pohjankartanon sali, Oulu", href: "https://tapahtumat.kaleva.fi/fi-FI/page/6a227d4f0ff26f93fb9637b5" },
  { title: "Faravidin maa", when: "ke 28.10.2026 klo 19:00", where: "Raksilan marketti, Tehtaankatu 1, 90130 Oulu", href: "https://tapahtumat.kaleva.fi/fi-FI/page/68fb2eed3e2661c3a9236556" },
  { title: "YK = YhteisKeikka", when: "la 24.10.2026 - su 25.10.2026", where: "Tukikohta, Sorvarintie 5, 90530 Oulu", href: "https://tapahtumat.kaleva.fi/fi-FI/page/6a944ba65362fa2e879b5274" },
];

/** placeholder tones for the photos we don't copy: greys and muted colours like the site's pictures */
export const KF_TONES = ["from-[#3b4552] to-[#8a96a3]", "from-[#46403a] to-[#a39586]", "from-[#2f3e46] to-[#84a98c]", "from-[#3a3042] to-[#9d8ca8]", "from-[#2b3a55] to-[#8fa3c1]", "from-[#4a3b2f] to-[#c2a27e]"];
export const toneOf = (key: string) => KF_TONES[[...key].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % KF_TONES.length];
