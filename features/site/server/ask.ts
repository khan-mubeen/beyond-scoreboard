// "ask the match" and party trivia: answers and questions from liiga data only (the game's
// rosters with each player's details, the season so far as of the league clock, tonight's goals,
// the table, form and head-to-head). no llm. an answer is a fact card for the whole party; a
// question the data can't answer gets "that's not in the liiga data"
import { parseMatchId, type LiigaGame, type RosterPlayer } from "@/features/liiga";
import { getGame, getRoster, getSeasonStats, liigaNow } from "@/features/liiga/server";
import { engineMatch } from "@/features/live/server";
import { compareRows, forecastNow, getSeasonContext } from "@/features/stakes/server";
import { teamCase } from "@/features/story";
import { demoMode } from "@/shared/clock";
import { checkText } from "@/shared/guardrails";
import type { FactCard, FormResult } from "@/shared/types";
import { parseAsk, type AskIntent, type AskLang, type AskParse } from "../ask/parse";
import { buildTrivia, type TriviaQuestion } from "../ask/trivia";
import { clockIn, ordinal } from "./labels";
import { headToHead } from "./preview";
import { teamBook } from "./teams";

const NOT_IN_DATA: Record<AskLang, string> = {
  en: "That's not in the Liiga data — try age, birthplace or goals this season.",
  fi: "Sitä ei ole Liigan datassa — kokeile ikää, syntymäpaikkaa tai kauden maaleja.",
};
const WHICH_PLAYER: Record<AskLang, string> = {
  en: "Which player? Try a surname or a number, like #19.",
  fi: "Kuka pelaaja? Kokeile sukunimeä tai numeroa, esim. #19.",
};

const COUNTRIES: Record<string, [string, string]> = {
  FIN: ["Finland", "Suomi"],
  SWE: ["Sweden", "Ruotsi"],
  NOR: ["Norway", "Norja"],
  DEN: ["Denmark", "Tanska"],
  CAN: ["Canada", "Kanada"],
  USA: ["the United States", "Yhdysvallat"],
  CZE: ["Czechia", "Tšekki"],
  SVK: ["Slovakia", "Slovakia"],
  LAT: ["Latvia", "Latvia"],
  EST: ["Estonia", "Viro"],
  GER: ["Germany", "Saksa"],
  AUT: ["Austria", "Itävalta"],
  SUI: ["Switzerland", "Sveitsi"],
  FRA: ["France", "Ranska"],
  SLO: ["Slovenia", "Slovenia"],
  KAZ: ["Kazakhstan", "Kazakstan"],
  HUN: ["Hungary", "Unkari"],
  ITA: ["Italy", "Italia"],
  POL: ["Poland", "Puola"],
  GBR: ["Great Britain", "Iso-Britannia"],
  UKR: ["Ukraine", "Ukraina"],
  BLR: ["Belarus", "Valko-Venäjä"],
  RUS: ["Russia", "Venäjä"],
};
const country = (code: string | null, lang: AskLang) =>
  code ? (COUNTRIES[code]?.[lang === "fi" ? 1 : 0] ?? code) : null;

const ROLES: Record<string, [string, string]> = {
  GOALKEEPER: ["goaltender", "maalivahti"],
  LEFT_DEFENSEMAN: ["left defenceman", "vasen puolustaja"],
  RIGHT_DEFENSEMAN: ["right defenceman", "oikea puolustaja"],
  DEFENSEMAN: ["defenceman", "puolustaja"],
  LEFT_WING: ["left wing", "vasen laitahyökkääjä"],
  RIGHT_WING: ["right wing", "oikea laitahyökkääjä"],
  CENTER: ["centre", "keskushyökkääjä"],
  CENTRE: ["centre", "keskushyökkääjä"],
  FORWARD: ["forward", "hyökkääjä"],
};
const role = (r: string | null, lang: AskLang) =>
  r ? (ROLES[r]?.[lang === "fi" ? 1 : 0] ?? r.toLowerCase().replaceAll("_", " ")) : null;

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .slice(0, 2)
    .join("");

/** age in whole years on a day (the league clock) */
function ageOn(birth: string, at: Date): number {
  const b = new Date(`${birth}T12:00:00Z`);
  let age = at.getUTCFullYear() - b.getUTCFullYear();
  if (at.getUTCMonth() < b.getUTCMonth() || (at.getUTCMonth() === b.getUTCMonth() && at.getUTCDate() < b.getUTCDate()))
    age--;
  return age;
}
const fiDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d}.${m}.${y}`;
};
const enDate = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${iso}T12:00:00Z`),
  );
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

interface MatchData {
  game: LiigaGame;
  players: RosterPlayer[];
  teams: { id: string; name: string; logo: string }[];
}

async function matchData(matchId: string): Promise<MatchData | null> {
  const ids = parseMatchId(matchId);
  if (!ids) return null;
  const visible = engineMatch(matchId)?.visible;
  const [res, roster, book] = await Promise.all([
    visible ? null : getGame(ids.season, ids.gameId).catch(() => null),
    getRoster(ids.season, ids.gameId).catch(() => null),
    teamBook(),
  ]);
  const game = visible ?? res?.data.game;
  if (!game) return null;
  const players = roster ? [...roster.data.home, ...roster.data.away] : [];
  const teams = (["home", "away"] as const).map((s) => {
    const ref = book.ref(game[s].teamId, game[s].name);
    return { id: game[s].teamId, name: ref.name, logo: ref.logo };
  });
  return { game, players, teams };
}

/** answers a question; post: true when the answer goes to the whole party, false for "not in the data" */
export async function askMatch(matchId: string, question: string): Promise<{ card: FactCard; post: boolean }> {
  const data = await matchData(matchId);
  const q = question
    .replace(/^\s*\?+\s*/, "")
    .trim()
    .slice(0, 140);
  const card = (answer: string, subject: FactCard["subject"] = null): FactCard => ({
    question: q,
    answer,
    subject,
    source: "Liiga data",
  });
  if (!data) return { card: card(NOT_IN_DATA.en), post: false };
  const parsed = parseAsk(q, { players: data.players, teams: data.teams.map((t) => ({ id: t.id, name: t.name })) });
  const answer = await answerFor(parsed, data);
  if (!answer)
    return {
      card: card(
        parsed.kind === "unknown" && parsed.reason === "no-subject"
          ? WHICH_PLAYER[parsed.lang]
          : NOT_IN_DATA[parsed.lang],
      ),
      post: false,
    };
  // the guardrails hold for generated text too
  if (checkText(answer.text).length) return { card: card(NOT_IN_DATA[parsed.lang]), post: false };
  return { card: card(answer.text, answer.subject), post: true };
}

type Answer = { text: string; subject: FactCard["subject"] } | null;

async function answerFor(p: AskParse, d: MatchData): Promise<Answer> {
  if (p.kind === "unknown") return null;
  const fi = p.lang === "fi";
  const teamName = (id: string) => d.teams.find((t) => t.id === id)?.name ?? "";
  if (p.kind === "player") {
    const players = p.players.map((x) => d.players.find((r) => r.id === x.id)!).filter(Boolean);
    const lines: string[] = [];
    for (const pl of players) {
      const line = await playerLine(p.intent, pl, d, p.lang);
      if (line) lines.push(line);
    }
    if (!lines.length) return null;
    const one = players.length === 1 ? players[0] : null;
    return {
      text: lines.join(" "),
      subject: one
        ? { name: one.name, photo: one.pictureUrl, initials: initialsOf(one.name), team: teamName(one.teamId) }
        : null,
    };
  }
  const subjectOf = (id: string) => {
    const t = d.teams.find((x) => x.id === id)!;
    return { name: t.name, photo: t.logo, initials: initialsOf(t.name), team: null };
  };
  if (p.kind === "team") {
    const text = await teamLine(p.intent, p.team.id, d, p.lang);
    return text ? { text, subject: subjectOf(p.team.id) } : null;
  }
  // the whole match: tonight's goals and scorers, the head-to-head, both teams' place or form
  if (p.intent === "form" || p.intent === "standing") {
    const both = await Promise.all(d.teams.map((t) => teamLine(p.intent, t.id, d, p.lang)));
    return both.every(Boolean) ? { text: both.join(" "), subject: null } : null;
  }
  const text = await teamLine(p.intent, null, d, p.lang);
  return text
    ? { text, subject: null }
    : { text: fi ? "Ei vielä maaleja tänään." : "No goals yet tonight.", subject: null };
}

async function playerLine(intent: AskIntent, pl: RosterPlayer, d: MatchData, lang: AskLang): Promise<string | null> {
  const fi = lang === "fi";
  const team = d.teams.find((t) => t.id === pl.teamId)?.name ?? "";
  const n = pl.name;
  switch (intent) {
    case "who": {
      const r = role(pl.role, lang);
      if (fi) return `${n} (#${pl.jersey ?? "?"}) pelaa joukkueessa ${team}${r ? `, pelipaikka: ${r}` : ""}.`;
      return `${n} wears #${pl.jersey ?? "?"} for ${team}${r ? ` and plays ${r}` : ""}.`;
    }
    case "age": {
      if (!pl.birthDate) return null;
      const age = ageOn(pl.birthDate, liigaNow());
      return fi
        ? `${n} on ${age}-vuotias (syntynyt ${fiDate(pl.birthDate)}).`
        : `${n} is ${age} (born ${enDate(pl.birthDate)}).`;
    }
    case "birthplace": {
      if (!pl.birthPlace) return null;
      const c = country(pl.birthCountry, lang);
      return fi
        ? `${n} · syntymäpaikka: ${pl.birthPlace}${c ? `, ${c}` : ""}.`
        : `${n} was born in ${pl.birthPlace}${c ? `, ${c}` : ""}.`;
    }
    case "nationality": {
      const c = country(pl.nationality, lang);
      if (!c) return null;
      return fi ? `${n} · kansalaisuus: ${c}.` : `${n}'s nationality: ${c}.`;
    }
    case "height":
      return pl.height ? (fi ? `${n} · pituus ${pl.height} cm.` : `${n} is ${pl.height} cm tall.`) : null;
    case "weight":
      return pl.weight ? (fi ? `${n} · paino ${pl.weight} kg.` : `${n} weighs ${pl.weight} kg.`) : null;
    case "jersey":
      return pl.jersey !== null
        ? fi
          ? `${n} pelaa numerolla ${pl.jersey} (${team}).`
          : `${n} wears #${pl.jersey} for ${team}.`
        : null;
    case "position": {
      const r = role(pl.role, lang);
      return r ? (fi ? `${n} · pelipaikka: ${r} (${team}).` : `${n} plays ${r} for ${team}.`) : null;
    }
    case "goals":
    case "assists":
    case "points": {
      const ids = parseMatchId(d.game.id)!;
      const s = await getSeasonStats(ids.season);
      const st = s.players.get(pl.id) ?? { games: 0, goals: 0, assists: 0 };
      // in demo mode (or before tonight's game) tonight isn't in the season totals yet
      const note =
        demoMode() || d.game.status !== "final" ? (fi ? ", ennen tätä iltaa" : ", not counting tonight") : "";
      const pts = st.goals + st.assists;
      if (fi)
        return `${n} tällä kaudella: ${st.goals} maalia, ${st.assists} syöttöä, ${pts} pistettä ${st.games} ottelussa${note}.`;
      const lead =
        intent === "goals"
          ? plural(st.goals, "goal", "goals")
          : intent === "assists"
            ? plural(st.assists, "assist", "assists")
            : plural(pts, "point", "points");
      return `${n} has ${lead} this season (${st.goals}+${st.assists} in ${plural(st.games, "game", "games")}${note}).`;
    }
    case "goalsTonight": {
      const mine = d.game.goals.filter((g) => g.scorerId === pl.id || (g.scorerId === null && g.scorer === pl.name));
      if (!mine.length) return fi ? `${n} ei ole tehnyt maalia tänään.` : `${n} hasn't scored tonight.`;
      const list = mine.map((g) => `${g.homeScore}–${g.awayScore} ${clockIn(g.gameTime, g.period)}`).join(", ");
      return fi
        ? `${n}: ${mine.length} maali${mine.length === 1 ? "" : "a"} tänään (${list}).`
        : `${n} has ${plural(mine.length, "goal", "goals")} tonight (${list}).`;
    }
    default:
      return null;
  }
}

/** a team's answer, or the match's when teamId is null (goals and scorers tonight, head-to-head) */
async function teamLine(intent: string, teamId: string | null, d: MatchData, lang: AskLang): Promise<string | null> {
  const fi = lang === "fi";
  const name = (id: string) => d.teams.find((t) => t.id === id)?.name ?? "";
  const nameGen = (id: string) => (fi ? teamCase(name(id), "gen") : `${name(id)}'s`);
  const g = d.game;
  const goals = teamId ? g.goals.filter((x) => x.teamId === teamId) : g.goals;
  switch (intent) {
    case "goalsTonight": {
      if (!goals.length)
        return teamId
          ? fi
            ? `${name(teamId)}: ei vielä maaleja tänään.`
            : `No ${name(teamId)} goals yet tonight.`
          : null;
      const list = goals.map((x) => `${x.scorer ?? name(x.teamId)} ${clockIn(x.gameTime, x.period)}`).join(", ");
      const who = teamId ? name(teamId) : fi ? "Illan maalit" : "Goals tonight";
      return fi ? `${who}: ${goals.length} · ${list}.` : `${who}: ${goals.length} · ${list}.`;
    }
    case "topScorerTonight": {
      const count = new Map<string, number>();
      for (const x of goals) if (x.scorer) count.set(x.scorer, (count.get(x.scorer) ?? 0) + 1);
      if (!count.size)
        return teamId
          ? fi
            ? `${name(teamId)}: ei vielä maaleja tänään.`
            : `No ${name(teamId)} goals yet tonight.`
          : null;
      const max = Math.max(...count.values());
      const top = [...count.entries()].filter(([, c]) => c === max).map(([s]) => s);
      if (fi)
        return `Illan paras maalintekijä${top.length > 1 ? "t" : ""}: ${top.join(", ")} (${max} maali${max === 1 ? "" : "a"}).`;
      return top.length === 1
        ? `Top scorer tonight: ${top[0]} (${plural(max, "goal", "goals")}).`
        : `Top scorers tonight: ${top.join(", ")} (${max} each).`;
    }
    case "headToHead": {
      const [ctx, book] = await Promise.all([getSeasonContext(), teamBook()]);
      const h = headToHead(ctx, g, book);
      if (!h.games.length)
        return fi ? "Joukkueet kohtaavat tällä kaudella ensimmäistä kertaa." : "First meeting this season.";
      const last = h.games[0];
      const lastLine = `${last.home.name} ${last.score.home}–${last.score.away}${last.extra} ${last.away.name} (${last.date})`;
      if (fi)
        return `Keskinäiset tällä kaudella: ${h.games.length} ottelu${h.games.length === 1 ? "" : "a"}. Viimeksi: ${lastLine}.`;
      return `${h.summary} Last time: ${lastLine}.`;
    }
    case "standing": {
      if (!teamId) return null;
      const ctx = await getSeasonContext();
      const table = [...forecastNow(ctx, []).world.table].sort(compareRows);
      const i = table.findIndex((r) => r.teamId === teamId);
      if (i < 0) return null;
      const r = table[i];
      const when = demoMode() ? (fi ? " ennen tätä iltaa" : " before tonight") : "";
      if (fi)
        return `${name(teamId)} on sarjataulukossa sijalla ${i + 1}${when}: ${r.points} pistettä ${r.gamesPlayed} ottelusta, maalit ${r.goalsFor}–${r.goalsAgainst}.`;
      return `${name(teamId)} are ${ordinal(i + 1)}${when}: ${r.points} points from ${r.gamesPlayed} games, goals ${r.goalsFor}–${r.goalsAgainst}.`;
    }
    case "form": {
      if (!teamId) return null;
      const ctx = await getSeasonContext();
      const nowIso = liigaNow().toISOString();
      const last5 = ctx.schedule
        .filter(
          (f) =>
            f.status === "final" &&
            f.start < nowIso &&
            (f.homeTeamId === teamId || f.awayTeamId === teamId) &&
            f.homeGoals !== null &&
            f.awayGoals !== null,
        )
        .slice(-5)
        .reverse()
        .map((f): FormResult => {
          const home = f.homeTeamId === teamId;
          const won = home ? f.homeGoals! > f.awayGoals! : f.awayGoals! > f.homeGoals!;
          return f.decidedIn === "regulation" ? (won ? "W" : "L") : won ? "OTW" : "OTL";
        });
      if (!last5.length) return null;
      const wins = last5.filter((x) => x === "W" || x === "OTW").length;
      if (fi) return `${nameGen(teamId)} viimeiset ${last5.length}: ${last5.join(" ")} (uusin ensin), ${wins} voittoa.`;
      return `${nameGen(teamId)} last ${last5.length}: ${last5.join(" ")} (newest first), ${plural(wins, "win", "wins")}.`;
    }
    default:
      return null;
  }
}

/** party trivia for a match: tonight's rosters and the season so far (null when nothing fits) */
export async function triviaFor(matchId: string, seed: string, n: number): Promise<TriviaQuestion | null> {
  const d = await matchData(matchId);
  const ids = parseMatchId(matchId);
  if (!d || !ids || d.players.length < 8) return null;
  const season = await getSeasonStats(ids.season).catch(() => null);
  const goals = new Map([...(season?.players ?? new Map()).entries()].map(([id, s]) => [id, s.goals]));
  const q = buildTrivia({
    seed,
    n,
    teams: d.teams.map((t) => ({ id: t.id, name: t.name, genitive: teamCase(t.name, "gen") })),
    players: d.players.map((p) => ({
      id: p.id,
      name: p.name,
      teamId: p.teamId,
      jersey: p.jersey,
      birthPlace: p.birthPlace,
      height: p.height,
      birthDate: p.birthDate,
    })),
    goals,
  });
  if (!q || checkText(q.question).length || q.options.some((o) => checkText(o.label).length)) return null;
  return q;
}
