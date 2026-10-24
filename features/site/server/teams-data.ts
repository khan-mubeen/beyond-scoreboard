// the 17 teams as the league clock sees them: position, zone, playoff chance and next game, from
// the stakes engine on the schedule (masked in demo mode, so it is the table before the demo date).
// shared by /teams, /teams/:slug and the home page's "your teams"
import type { LiigaFixture } from "@/features/liiga";
import { compareRows, forecastNow, getSeasonContext, zoneForRank, zoneLabel, type ForecastResult, type SeasonContext } from "@/features/stakes/server";
import { demoMode, leagueNow } from "@/shared/clock";
import type { FormResult, TeamListItem, TeamNextGame, TeamPageData } from "@/shared/types";
import { gameStakes } from "./game-stakes";
import { pct, shortDate, timeLabel } from "./labels";
import { teamBook, type TeamBook } from "./teams";

export const slugOf = (teamId: string) => teamId.split(":")[1] ?? teamId;

const plays = (f: LiigaFixture, teamId: string) => f.homeTeamId === teamId || f.awayTeamId === teamId;

function upcomingFor(ctx: SeasonContext, teamId: string, n: number): LiigaFixture[] {
  const now = leagueNow().toISOString();
  return ctx.schedule.filter((f) => f.status === "scheduled" && f.start > now && plays(f, teamId)).slice(0, n);
}

function nextGameOf(ctx: SeasonContext, shared: ForecastResult, book: TeamBook, f: LiigaFixture, teamId: string, withWorth: boolean): TeamNextGame {
  const home = f.homeTeamId === teamId;
  const opp = home ? book.ref(f.awayTeamId, f.awayName) : book.ref(f.homeTeamId, f.homeName);
  const s = withWorth ? gameStakes(ctx, f, shared) : null;
  const d = new Date(f.start);
  return {
    matchId: f.id,
    opponent: opp,
    home,
    when: `${shortDate(d)} · ${timeLabel(d)}`,
    worth: s ? `Win → ${pct(s.worth[home ? "home" : "away"].regulationWin.playoffs)}% playoff chance` : null,
  };
}

export interface TeamsWorld {
  ctx: SeasonContext;
  book: TeamBook;
  shared: ForecastResult;
  items: TeamListItem[];
}

/** every team, best first, each with its next game and what it is worth */
export async function teamsWorld(follows: string[] = []): Promise<TeamsWorld> {
  const [ctx, book] = await Promise.all([getSeasonContext(), teamBook()]);
  const teamIds = [...new Set(ctx.schedule.flatMap((f) => [f.homeTeamId, f.awayTeamId]))].filter((id) => !id.startsWith("tbd"));
  const next = new Map(teamIds.map((id) => [id, upcomingFor(ctx, id, 1)[0]] as const));
  // one simulation for every team's next game
  const shared = forecastNow(ctx, [...new Set([...next.values()].filter((f): f is LiigaFixture => !!f).map((f) => f.id))]);
  const table = [...shared.world.table].sort(compareRows);
  const items = table.map((r, i): TeamListItem => {
    const f = next.get(r.teamId);
    return {
      team: book.ref(r.teamId),
      slug: slugOf(r.teamId),
      rank: i + 1,
      points: r.points,
      gamesPlayed: r.gamesPlayed,
      zone: zoneForRank(i + 1),
      zoneLabel: zoneLabel(zoneForRank(i + 1)),
      playoffChance: pct(shared.forecast.teams[r.teamId]?.playoffs ?? 0),
      next: f ? nextGameOf(ctx, shared, book, f, r.teamId, true) : null,
      followed: follows.includes(r.teamId),
    };
  });
  return { ctx, book, shared, items };
}

export const tableNote = () => (demoMode() ? `Standings before ${shortDate(leagueNow())}` : "Standings now");

/** one team: the list entry, its other chances, the last five results and the next three games */
export async function teamDetail(slug: string, follows: string[]): Promise<Omit<TeamPageData, "asOf" | "source"> | null> {
  const w = await teamsWorld(follows);
  const item = w.items.find((x) => x.slug.toLowerCase() === slug.toLowerCase());
  if (!item) return null;
  const teamId = item.team.id;
  const chances = w.shared.forecast.teams[teamId];
  const last5 = w.ctx.schedule
    .filter((f) => f.status === "final" && plays(f, teamId) && f.homeGoals !== null && f.awayGoals !== null)
    .slice(-5)
    .reverse()
    .map((f) => {
      const home = f.homeTeamId === teamId;
      const own = (home ? f.homeGoals : f.awayGoals)!;
      const other = (home ? f.awayGoals : f.homeGoals)!;
      const won = own > other;
      const result: FormResult = f.decidedIn === "regulation" ? (won ? "W" : "L") : won ? "OTW" : "OTL";
      return {
        matchId: f.id,
        opponent: home ? w.book.ref(f.awayTeamId, f.awayName) : w.book.ref(f.homeTeamId, f.homeName),
        home,
        result,
        score: `${own}–${other}`,
        date: shortDate(new Date(f.start)),
      };
    });
  const next3 = upcomingFor(w.ctx, teamId, 3).map((f, i) => nextGameOf(w.ctx, w.shared, w.book, f, teamId, i === 0));
  return { item, top4Chance: pct(chances?.top4 ?? 0), relegationChance: pct(chances?.relegation ?? 0), last5, next3 };
}
