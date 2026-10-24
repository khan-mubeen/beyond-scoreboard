// "ask the match": a deterministic parser for a fan's question, in english or simple finnish.
// it finds a player (a name, a surname, or a jersey number) or one of the two teams, and what is
// asked. no llm: features/site/server/ask.ts answers from liiga data, or says it isn't in it.
// pure and browser-safe (tests run it directly)

export type AskIntent =
  | "who"
  | "age"
  | "birthplace"
  | "nationality"
  | "height"
  | "weight"
  | "jersey"
  | "position"
  | "goals"
  | "assists"
  | "points"
  | "goalsTonight"
  | "topScorerTonight"
  | "headToHead"
  | "standing"
  | "form";

export interface AskPlayer {
  id: number;
  firstName: string;
  lastName: string;
  jersey: number | null;
  teamId: string;
}

export interface AskTeam {
  id: string;
  name: string;
}

export type AskLang = "en" | "fi";

export type AskParse =
  | { kind: "player"; intent: AskIntent; players: AskPlayer[]; lang: AskLang }
  | { kind: "team"; intent: AskIntent; team: AskTeam; lang: AskLang }
  | { kind: "match"; intent: AskIntent; lang: AskLang }
  /** not-in-data: a subject but nothing we know about it; no-subject: which player? */
  | { kind: "unknown"; reason: "not-in-data" | "no-subject"; lang: AskLang };

/** lower case, no accents ("Kärpät" and "karpat" match), punctuation as spaces ("#" kept) */
export const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9#\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// on folded text: finnish words match by their start, so "maaleja", "maalia" and "maalit" all hit
const EN: [AskIntent, RegExp][] = [
  ["topScorerTonight", /\b(top ?(goal ?)?scorer|most goals|leading scorer|scored the most|top scorers)\b/],
  ["headToHead", /\b(head ?-? ?to ?-? ?head|h2h|met before|meetings?|each other|previous games?)\b/],
  ["form", /\b(form|last (5|five)|recent (results|games|form)|streak)\b/],
  ["age", /\b(age|how old|old is|years old|birthday|born when|when was .* born)\b/],
  ["birthplace", /\b(born|birth ?place|hometown|home town|where .* from|comes? from)\b/],
  ["nationality", /\b(nationality|national|country|citizen)\b/],
  ["height", /\b(height|tall|how big)\b/],
  ["weight", /\b(weight|weigh|weighs|heavy)\b/],
  ["jersey", /\b(jersey|shirt|what number|which number|his number|number does)\b/],
  ["standing", /\b(standing|standings|rank|ranked|table|place in|league position)\b/],
  ["position", /\b(position|plays? as|what does .* play|role|forward or|defen[cs]eman or)\b/],
  ["assists", /\b(assists?|helpers?)\b/],
  ["points", /\b(points?|pts)\b/],
  ["goals", /\b(goals?|scored|scorer)\b/],
];
const FI: [AskIntent, RegExp][] = [
  ["topScorerTonight", /\b(eniten maale|paras maalintekija|maalikunkku|maalikuningas|maalipors)/],
  ["headToHead", /\b(keskinai|vastakkain|kohtaamis|keskenaan|aiemmat ottelut)/],
  ["form", /\b(vire|vireessa|viime peli|viime ottelu|viimeiset|viimeisimm|putki)/],
  ["age", /\b(ika|ikainen|iassa|kuinka vanha|vanha|vuotias|syntymapaiva|milloin .* syntyi)/],
  ["birthplace", /\b(syntymapaikka|syntyi|syntynyt|kotoisin|kotikaupunki|mista .* on)/],
  ["nationality", /\b(kansalaisuu|kansallisuu|mista maasta)|\bmaa\b/],
  ["height", /\b(pituu|pitka|kuinka pitka)/],
  ["weight", /\b(paino|painaa|kuinka painava)/],
  ["jersey", /\b(pelinumero|numero|nro|paidan numero)/],
  ["standing", /\b(sijoitu|sijalla|monennella|sarjataulukk|taulukossa|sarjasija)/],
  ["position", /\b(pelipaikka|pelipaikalla|pelaa .*(hyokk|puolust|maali)|hyokkaaja vai|puolustaja vai)/],
  ["assists", /\b(syot|syott)/],
  ["points", /\b(piste|tehopiste)/],
  ["goals", /\b(maali|maalej|teki|tehnyt)/],
];
const TONIGHT =
  /\b(tonight|today|this game|this match|in the game|so far|tanaan|tana iltana|illan|illalla|tassa pelissa|tassa ottelussa|nyt)\b/;
const FINNISH =
  /\b(kuka|kuka on|mika|mita|mista|missa|monta|montako|paljonko|kuinka|onko|tanaan|illan|pelaa|joukkue|kaudella|kausi|kerro)\b/;
const WHO = /\b(who|whos|who is|kuka|kukas)\b/;
const JERSEY = /(?:#|\b(?:no|number|nr|nro|numero|numerolla|pelinumero)\s*)(\d{1,2})\b/;
/** words that carry no meaning of their own, left over when a fan types only a name */
const FILLER = new Set(
  "who whos is was the a an of about tell me what whats who's please kuka kukas on oli mika mita kerro pelaaja player number no nro numero # s".split(
    " ",
  ),
);

function teamHit(word: string, team: string): boolean {
  if (team.length < 5) return word === team;
  const stem = team.slice(0, Math.max(4, team.length - 2));
  return word === team || word.startsWith(stem);
}

/** a surname as typed: "salminen", "salminens", finnish "salmisen" / "salmiselta" (-nen -> -se-), "koivun" */
function surnameHit(word: string, last: string): boolean {
  if (!last) return false;
  if (word === last) return true;
  if (last.length >= 4 && word.startsWith(last) && word.length - last.length <= 4) return true;
  if (last.endsWith("nen") && last.length >= 6) {
    const stem = `${last.slice(0, -3)}s`;
    return word.startsWith(stem) && word.length - stem.length <= 5;
  }
  return false;
}

function findPlayers(words: string[], text: string, players: AskPlayer[]): { players: AskPlayer[]; used: Set<string> } {
  const used = new Set<string>();
  let best = 0;
  let hits: AskPlayer[] = [];
  for (const p of players) {
    const first = fold(p.firstName);
    const lasts = fold(p.lastName).split(" ").filter(Boolean);
    const full = `${first} ${lasts.join(" ")}`.trim();
    let score = 0;
    if (full && text.includes(full)) score = 3;
    else if (lasts.length && lasts.every((l) => words.some((w) => surnameHit(w, l)))) score = 2;
    else if (first.length >= 3 && words.includes(first)) score = 1;
    if (!score) continue;
    if (score > best) {
      best = score;
      hits = [];
    }
    if (score === best) hits.push(p);
  }
  for (const p of hits)
    for (const w of words)
      if (
        w === fold(p.firstName) ||
        fold(p.lastName)
          .split(" ")
          .some((l) => surnameHit(w, l))
      )
        used.add(w);
  // a first name alone that several players share says too little
  if (best === 1 && hits.length > 1) return { players: [], used: new Set() };
  return { players: hits, used };
}

export function parseAsk(raw: string, ctx: { players: AskPlayer[]; teams: AskTeam[] }): AskParse {
  const text = fold(raw.replace(/^\s*\?+/, ""));
  const words = text.split(" ").filter(Boolean);
  const fiIntent = FI.find(([, re]) => re.test(text));
  const enIntent = EN.find(([, re]) => re.test(text));
  const lang: AskLang = FINNISH.test(text) || (fiIntent && !enIntent) ? "fi" : "en";
  let intent: AskIntent | null = (lang === "fi" ? (fiIntent ?? enIntent) : (enIntent ?? fiIntent))?.[0] ?? null;
  const tonight = TONIGHT.test(text);
  if (intent === "goals" && tonight) intent = "goalsTonight";

  const team = ctx.teams.find((t) => words.some((w) => teamHit(w, fold(t.name))));
  const number = JERSEY.exec(text);
  let players: AskPlayer[];
  let used = new Set<string>();
  if (number) {
    players = ctx.players.filter((p) => p.jersey === Number(number[1]));
    if (team && players.some((p) => p.teamId === team.id)) players = players.filter((p) => p.teamId === team.id);
    // "who's #19?": a number and nothing else asked is "who is it"
    if (!intent || intent === "jersey") intent = "who";
  } else {
    ({ players, used } = findPlayers(words, text, ctx.players));
    if (team && players.length > 1 && players.some((p) => p.teamId === team.id))
      players = players.filter((p) => p.teamId === team.id);
  }

  // a name and nothing else ("Salminen?", "who is Salminen"): who they are
  if (players.length && !intent) {
    const rest = words.filter((w) => !used.has(w) && !FILLER.has(w) && !(team && teamHit(w, fold(team.name))));
    if (rest.length === 0 || WHO.test(text)) intent = "who";
  }

  const PLAYER: AskIntent[] = [
    "who",
    "age",
    "birthplace",
    "nationality",
    "height",
    "weight",
    "jersey",
    "position",
    "goals",
    "assists",
    "points",
    "goalsTonight",
  ];
  const TEAM: AskIntent[] = [
    "standing",
    "form",
    "headToHead",
    "goalsTonight",
    "topScorerTonight",
    "goals",
    "points",
    "position",
  ];
  // no team named: both teams' form or place, tonight's goals and scorers, the head-to-head
  const MATCH: AskIntent[] = ["topScorerTonight", "headToHead", "goalsTonight", "form", "standing"];

  if (players.length && players.length <= 4 && intent && PLAYER.includes(intent))
    return { kind: "player", intent, players, lang };
  if (team && intent && TEAM.includes(intent)) {
    // a team's points, place or goals this season: its line in the table
    const asTeam: AskIntent = intent === "points" || intent === "position" || intent === "goals" ? "standing" : intent;
    return { kind: "team", intent: asTeam, team, lang };
  }
  if (intent && MATCH.includes(intent)) return { kind: "match", intent, lang };
  if (players.length || team) return { kind: "unknown", reason: "not-in-data", lang };
  if (intent && PLAYER.includes(intent)) return { kind: "unknown", reason: "no-subject", lang };
  return { kind: "unknown", reason: "not-in-data", lang };
}
