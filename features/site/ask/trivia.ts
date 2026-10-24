// party trivia: a multiple-choice question built from tonight's rosters and the season so far.
// deterministic (the same match, cycle and number give the same question) and verified: the
// answer is computed from the data, and no other option can also be right. pure, no i/o

export interface TriviaPlayer {
  id: number;
  name: string;
  teamId: string;
  jersey: number | null;
  birthPlace: string | null;
  /** cm */
  height: number | null;
  /** "2000-04-16" */
  birthDate: string | null;
}

export interface TriviaTeam {
  id: string;
  name: string;
  /** the finnish genitive ("Kärppien"), for the finnish wording */
  genitive: string;
}

export interface TriviaInput {
  /** match id and cycle: the same seed gives the same questions */
  seed: string;
  /** the how-manyth trivia of this run (0, 1, ...) */
  n: number;
  teams: TriviaTeam[];
  players: TriviaPlayer[];
  /** season goals so far by player id (before tonight) */
  goals: Map<number, number>;
}

export interface TriviaQuestion {
  kind: "birthplace" | "leader" | "tallest" | "jersey" | "oldest";
  question: string;
  options: { id: string; label: string }[];
  answer: string;
  fi: { question: string; options: { id: string; label: string }[] };
}

const IDS = ["a", "b", "c", "d"];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** mulberry32: a small seeded random number generator */
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(list: T[], rand: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** the right one plus three that are surely wrong, in a seeded order */
function choices<T>(right: T, wrong: T[], label: (x: T) => string, rand: () => number) {
  if (wrong.length < 3) return null;
  const all = shuffle([right, ...shuffle(wrong, rand).slice(0, 3)], rand);
  const options = all.map((x, i) => ({ id: IDS[i], label: label(x) }));
  return { options, answer: IDS[all.indexOf(right)] };
}

type Builder = (
  team: TriviaTeam,
  roster: TriviaPlayer[],
  input: TriviaInput,
  rand: () => number,
) => TriviaQuestion | null;

const BUILDERS: Record<TriviaQuestion["kind"], Builder> = {
  // a birthplace only one of tonight's players has
  birthplace(team, roster, _input, rand) {
    const places = new Map<string, TriviaPlayer[]>();
    for (const p of roster) if (p.birthPlace) places.set(p.birthPlace, [...(places.get(p.birthPlace) ?? []), p]);
    const unique = [...places.entries()]
      .filter(([, ps]) => ps.length === 1)
      .map(([place, ps]) => ({ place, p: ps[0] }));
    if (!unique.length) return null;
    const { place, p } = unique[Math.floor(rand() * unique.length)];
    const c = choices(
      p,
      roster.filter((x) => x.birthPlace && x.birthPlace !== place),
      (x) => x.name,
      rand,
    );
    if (!c) return null;
    return {
      kind: "birthplace",
      question: `Which ${team.name} player was born in ${place}?`,
      ...c,
      fi: { question: `Kuka ${team.genitive} pelaajista on syntynyt paikkakunnalla ${place}?`, options: c.options },
    };
  },
  // the most goals this season among tonight's players, alone at the top
  leader(team, roster, input, rand) {
    const ranked = roster.map((p) => ({ p, g: input.goals.get(p.id) ?? 0 })).sort((a, b) => b.g - a.g);
    const top = ranked[0];
    if (!top || top.g < 1 || ranked[1]?.g === top.g) return null;
    const c = choices(
      top.p,
      ranked.slice(1, 8).map((x) => x.p),
      (x) => x.name,
      rand,
    );
    if (!c) return null;
    return {
      kind: "leader",
      question: `Who has the most goals this season in tonight's ${team.name} lineup?`,
      ...c,
      fi: {
        question: `Kuka illan ${team.genitive} kokoonpanosta on tehnyt eniten maaleja tällä kaudella?`,
        options: c.options,
      },
    };
  },
  tallest(team, roster, _input, rand) {
    const tall = roster.filter((p) => p.height).sort((a, b) => b.height! - a.height!);
    if (tall.length < 4 || tall[1].height === tall[0].height) return null;
    const c = choices(tall[0], tall.slice(1), (x) => x.name, rand);
    if (!c) return null;
    return {
      kind: "tallest",
      question: `Who is the tallest ${team.name} player tonight?`,
      ...c,
      fi: { question: `Kuka on illan ${team.genitive} pisin pelaaja?`, options: c.options },
    };
  },
  jersey(team, roster, _input, rand) {
    const numbered = roster.filter((p) => p.jersey !== null);
    if (numbered.length < 4) return null;
    const p = numbered[Math.floor(rand() * numbered.length)];
    const others = [...new Set(numbered.filter((x) => x.jersey !== p.jersey).map((x) => x.jersey!))];
    const c = choices(p.jersey!, others, (n) => `#${n}`, rand);
    if (!c) return null;
    return {
      kind: "jersey",
      question: `Which number does ${p.name} (${team.name}) wear?`,
      ...c,
      fi: { question: `Mikä on pelaajan ${p.name} (${team.name}) pelinumero?`, options: c.options },
    };
  },
  oldest(team, roster, _input, rand) {
    const aged = roster.filter((p) => p.birthDate).sort((a, b) => a.birthDate!.localeCompare(b.birthDate!));
    if (aged.length < 4 || aged[1].birthDate === aged[0].birthDate) return null;
    const c = choices(aged[0], aged.slice(1), (x) => x.name, rand);
    if (!c) return null;
    return {
      kind: "oldest",
      question: `Who is the oldest ${team.name} player tonight?`,
      ...c,
      fi: { question: `Kuka on illan ${team.genitive} vanhin pelaaja?`, options: c.options },
    };
  },
};

const ORDER: TriviaQuestion["kind"][] = ["birthplace", "leader", "tallest", "jersey", "oldest"];

/** the n-th trivia question of a match's run, or null when the data has none to ask */
export function buildTrivia(input: TriviaInput): TriviaQuestion | null {
  const base = hash(input.seed);
  for (let k = 0; k < ORDER.length * input.teams.length; k++) {
    const kind = ORDER[(base + input.n + k) % ORDER.length];
    const team = input.teams[(base + input.n + Math.floor(k / ORDER.length)) % input.teams.length];
    const roster = input.players.filter((p) => p.teamId === team.id);
    const q = BUILDERS[kind](team, roster, input, rng(base + input.n * 7919 + k));
    if (q) return q;
  }
  return null;
}
