// GET /api/site/home: featured game, live / upcoming / recent, season stakes today,
// the weekly leaderboard and the live liiga table with its zone lines
import type { LiigaFixture, LiigaGame } from "@/features/liiga";
import { getGamesOn, getStandings, helsinkiDate, liigaNow } from "@/features/liiga/server";
import { activeReplays, engineMatch } from "@/features/live/server";
import { forecastNow, getSeasonContext, zoneForRank, type SeasonContext } from "@/features/stakes/server";
import { whatItMeansText } from "@/features/story/server";
import type { ApiMeta, DataSource, FavoriteTeam, FeaturedMatch, HomePage, LiigaTableData, StakesStripItem } from "@/shared/types";
import { SITE } from "./config";
import { gameStakes, type GameStakes } from "./game-stakes";
import type { Viewer } from "./identity";
import { longDate, ordinal, pct } from "./labels";
import { chips, factsFor } from "./match";
import { summaryOf } from "./match-parts";
import { viewerSummary, weeklyLeaderboard } from "./points";
import { teamBook, type TeamBook } from "./teams";

/** a schedule entry as a game, for cards of games we haven't fetched in detail */
export const gameOfFixture = (f: LiigaFixture): LiigaGame => ({
  id: f.id,
  gameId: f.gameId,
  season: f.season,
  start: f.start,
  status: f.status,
  decidedIn: f.decidedIn,
  home: { teamId: f.homeTeamId, name: f.homeName, logo: null, goals: f.homeGoals ?? 0 },
  away: { teamId: f.awayTeamId, name: f.awayName, logo: null, goals: f.awayGoals ?? 0 },
  currentPeriod: null,
  gameTime: 0,
  periods: [],
  spectators: null,
  rink: f.rink,
  goals: [],
  penalties: [],
  powerPlay: null,
  video: null,
});

const COMING_SOON_FAVORITES: FavoriteTeam[] = [
  { team: { id: "lippo", name: "Oulun Lippo", logo: "/placeholders/teams/lippo.svg" }, league: "Superpesis", starred: false, comingSoon: true },
  { team: { id: "oulu-basketball", name: "Oulu Basketball", logo: "/placeholders/teams/oulu-basketball.svg" }, league: "Korisliiga", starred: false, comingSoon: true },
  { team: { id: "finland", name: "Finland National Team", logo: "/placeholders/teams/finland.svg" }, league: "Ice hockey", starred: false, comingSoon: true },
];

function resultNote(f: LiigaFixture, book: TeamBook): string {
  const homeWon = (f.homeGoals ?? 0) > (f.awayGoals ?? 0);
  const winner = book.ref(homeWon ? f.homeTeamId : f.awayTeamId, homeWon ? f.homeName : f.awayName).name;
  const extra = f.decidedIn === "overtime" ? " in overtime" : f.decidedIn === "shootout" ? " in a shootout" : "";
  const [w, l] = homeWon ? [f.homeGoals, f.awayGoals] : [f.awayGoals, f.homeGoals];
  return `${winner} won ${w}–${l}${extra}.`;
}

/** how far a game swings both teams' seasons: playoff and relegation chance, win vs loss */
const swingOf = (s: GameStakes) =>
  (["home", "away"] as const).reduce((sum, side) => {
    const w = s.worth[side];
    return sum + (w.regulationWin.playoffs - w.regulationLoss.playoffs) + (w.regulationLoss.relegation - w.regulationWin.relegation);
  }, 0);

/** one line on what's at stake: the team with the bigger swing, playoff or relegation */
function stakesLine(g: LiigaGame, s: GameStakes, book: TeamBook): string {
  const best = (["home", "away"] as const)
    .map((side) => {
      const w = s.worth[side];
      return { side, w, playoff: w.regulationWin.playoffs - w.regulationLoss.playoffs, releg: w.regulationLoss.relegation - w.regulationWin.relegation };
    })
    .reduce((a, b) => (Math.max(b.playoff, b.releg) > Math.max(a.playoff, a.releg) ? b : a));
  const name = book.ref(g[best.side].teamId, g[best.side].name).name;
  if (best.releg > best.playoff) {
    return `${name}: relegation chance ${pct(best.w.regulationLoss.relegation)}% with a loss, ${pct(best.w.regulationWin.relegation)}% with a win`;
  }
  return `${name}: playoff chance ${pct(best.w.regulationWin.playoffs)}% with a win, ${pct(best.w.regulationLoss.playoffs)}% with a loss`;
}

function liigaTable(rows: Awaited<ReturnType<typeof getStandings>>["data"]["rows"], favId: string, favLive: boolean, book: TeamBook): LiigaTableData {
  const sorted = [...rows].sort((a, b) => a.liveRanking - b.liveRanking);
  const fav = sorted.find((r) => r.teamId === favId);
  return {
    rows: sorted.map((r) => ({
      teamId: r.teamId,
      team: book.ref(r.teamId, r.name),
      rank: r.liveRanking,
      points: r.livePoints,
      gamesPlayed: r.liveGames,
      goalDifference: r.liveGoals - r.liveGoalsAgainst,
      zone: zoneForRank(r.liveRanking),
    })),
    highlightTeamId: favId,
    // live standings already count live scores, so the live rank is "if it ends now"
    highlightNote: fav && favLive ? `${ordinal(fav.liveRanking)} if it ends now` : null,
    fullTableHref: "#liiga-table",
  };
}

export async function homePage(viewer: Viewer, opts: { team?: string; date?: string } = {}): Promise<HomePage & ApiMeta> {
  const now = liigaNow();
  const date = opts.date ?? helsinkiDate(now);
  const slug = opts.team ?? SITE.favoriteSlug;
  // the db work runs alongside the liiga requests. the no-op catch keeps an early failure from
  // being an unhandled rejection; the await below still raises it
  const userP = viewerSummary(viewer.user);
  const leaderboardP = weeklyLeaderboard(viewer.user?.id ?? null);
  userP.catch(() => {});
  leaderboardP.catch(() => {});
  const [ctx, book, today] = await Promise.all([getSeasonContext(), teamBook(), getGamesOn(date).catch(() => null)]);
  const standings = await getStandings(ctx.season, true);
  const favId = standings.data.rows.find((r) => r.teamId.endsWith(`:${slug}`))?.teamId ?? standings.data.rows[0]?.teamId ?? "";
  const isFav = (g: LiigaGame) => g.home.teamId === favId || g.away.teamId === favId;

  // a running demo replay counts as live today, ahead of the real games
  const replays = activeReplays().filter((r) => r.visible.status === "live");
  const games = [...replays.map((r) => r.visible), ...(today?.data ?? []).filter((g) => !replays.some((r) => r.matchId === g.id))];
  const nowIso = now.toISOString();
  const upcomingFixtures = ctx.schedule.filter((f) => f.status === "scheduled" && f.start > nowIso);
  const favNext = upcomingFixtures.find((f) => f.homeTeamId === favId || f.awayTeamId === favId);
  const featuredGame =
    (replays[0]?.visible as LiigaGame | undefined) ??
    games.find((g) => g.status === "live" && isFav(g)) ??
    games.find((g) => g.status === "live") ??
    games.find((g) => g.status === "scheduled" && isFav(g)) ??
    (favNext ? gameOfFixture(favNext) : undefined) ??
    games.find((g) => g.status === "scheduled");

  const unplayedToday = games.filter((g) => g.status === "live" || g.status === "scheduled");
  const strip = unplayedToday.length ? unplayedToday : upcomingFixtures.slice(0, 8).map(gameOfFixture);
  const upcoming = upcomingFixtures.filter((f) => f.id !== featuredGame?.id && !games.some((g) => g.id === f.id && g.status === "live")).slice(0, 3);

  // one simulation covers every game the page puts a number on
  const shared = forecastNow(ctx, [...strip.map((g) => g.id), ...upcoming.map((f) => f.id), ...(featuredGame ? [featuredGame.id] : [])]);
  const stakesOf = (g: LiigaGame) => stakesFor(ctx, g, shared);

  let featured: FeaturedMatch | null = null;
  if (featuredGame) {
    const s = stakesOf(featuredGame);
    const side = featuredGame.away.teamId === favId ? "away" : "home";
    featured = {
      match: summaryOf(featuredGame, book, now),
      background: "/placeholders/featured-live.svg",
      whatItMeans: whatItMeansText(factsFor(featuredGame, s, side, book)),
      stakes: chips(s, featuredGame, book),
      openCalls: engineMatch(featuredGame.id)?.state?.call?.status === "open" ? 1 : 0,
    };
  }

  const seasonStakesToday: StakesStripItem[] = strip
    .map((g) => ({ g, s: stakesOf(g) }))
    .filter((x): x is { g: LiigaGame; s: GameStakes } => x.s !== null)
    .sort((a, b) => swingOf(b.s) - swingOf(a.s))
    .slice(0, 3)
    .map(({ g, s }) => ({
      id: g.id,
      home: book.ref(g.home.teamId, g.home.name),
      away: book.ref(g.away.teamId, g.away.name),
      line: stakesLine(g, s, book),
      href: `/match/${g.id}`,
    }));

  const favWorth = (f: LiigaFixture): string | undefined => {
    if (f.homeTeamId !== favId && f.awayTeamId !== favId) return undefined;
    const s = gameStakes(ctx, f, shared);
    if (!s) return undefined;
    const side = f.homeTeamId === favId ? "home" : "away";
    return `What this game is worth for ${book.ref(favId).name}: Win → ${pct(s.worth[side].regulationWin.playoffs)}% · Loss → ${pct(s.worth[side].regulationLoss.playoffs)}% playoff chance`;
  };

  const recent = ctx.schedule.filter((f) => f.status === "final").slice(-3).reverse();
  const sources: DataSource[] = [ctx.source, standings.source, today?.source ?? "live"];
  return {
    hero: SITE.hero,
    dateLabel: longDate(new Date(`${date}T12:00:00Z`)),
    featured,
    user: await userP,
    favorites: [{ team: book.ref(favId), league: "Liiga", starred: true, comingSoon: false }, ...COMING_SOON_FAVORITES],
    seasonStakesToday,
    live: games.filter((g) => g.status === "live").map((g) => summaryOf(g, book, now)),
    upcoming: upcoming.map((f) => summaryOf(gameOfFixture(f), book, now, favWorth(f))),
    recent: recent.map((f) => summaryOf(gameOfFixture(f), book, now, resultNote(f, book))),
    comingSoon: [...SITE.comingSoon],
    leaderboard: { ...SITE.leaderboard, entries: await leaderboardP },
    table: liigaTable(standings.data.rows, favId, games.some((g) => g.status === "live" && isFav(g)), book),
    asOf: standings.asOf,
    source: sources.includes("snapshot") ? "snapshot" : "live",
  };
}

function stakesFor(ctx: SeasonContext, g: LiigaGame, shared: ReturnType<typeof forecastNow>): GameStakes | null {
  const f = ctx.schedule.find((x) => x.id === g.id);
  return f ? gameStakes(ctx, f, shared) : null;
}
