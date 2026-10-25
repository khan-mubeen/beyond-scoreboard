// GET /api/site/home: featured game, live / upcoming / recent, season stakes today,
// the weekly leaderboard and the live liiga table with its zone lines
import type { LiigaFixture, LiigaGame } from "@/features/liiga";
import { getGamesOn, getStandings, helsinkiDate, liigaNow } from "@/features/liiga/server";
import { activeReplays, engineMatch, rotationConfig, rotationNow, type RotationNow } from "@/features/live/server";
import { compareRows, forecastNow, getSeasonContext, zoneForRank, type SeasonContext, type TableRow } from "@/features/stakes/server";
import { demoMode } from "@/shared/clock";
import { whatItMeansText } from "@/features/story/server";
import type { ApiMeta, DataSource, FeaturedMatch, HomePage, LiigaTableData, MatchSummary, StakesStripItem } from "@/shared/types";
import { SITE } from "./config";
import { favoriteTeamIds } from "./favorites";
import { teamsWorld } from "./teams-data";
import { chanceNow, gameStakes, type GameStakes } from "./game-stakes";
import type { Viewer } from "./identity";
import { longDate, ordinal, pct, shortDate } from "./labels";
import { chips, factsFor } from "./match";
import { summaryOf } from "./match-parts";
import { weeklyLeaderboard } from "./points";
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

function resultNote(f: LiigaFixture, book: TeamBook): string {
  const homeWon = (f.homeGoals ?? 0) > (f.awayGoals ?? 0);
  const winner = book.ref(homeWon ? f.homeTeamId : f.awayTeamId, homeWon ? f.homeName : f.awayName).name;
  const extra = f.decidedIn === "overtime" ? " in overtime" : f.decidedIn === "shootout" ? " in a shootout" : "";
  const [w, l] = homeWon ? [f.homeGoals, f.awayGoals] : [f.awayGoals, f.homeGoals];
  return `${winner} won ${w}–${l}${extra}.`;
}

/**
 * a result card's graphic and teaser: both teams' playoff chance after the game and how far it
 * moved (the game judged as the season stood before it), and the winner's next game
 */
function resultCard(ctx: SeasonContext, f: LiigaFixture, book: TeamBook, nowIso: string): Pick<MatchSummary, "swing" | "teaser"> {
  const s = gameStakes(ctx, f);
  const g = gameOfFixture(f);
  const side = (x: "home" | "away") => {
    const now = pct(chanceNow(s!, x, g).playoffs);
    return { now, change: now - pct(s!.baseline[x].playoffs) };
  };
  const winner = (f.homeGoals ?? 0) > (f.awayGoals ?? 0) ? f.homeTeamId : f.awayTeamId;
  const next = ctx.schedule.find((x) => x.status === "scheduled" && x.start > f.start && x.start > nowIso && (x.homeTeamId === winner || x.awayTeamId === winner));
  const opp = next && (next.homeTeamId === winner ? book.ref(next.awayTeamId, next.awayName) : book.ref(next.homeTeamId, next.homeName));
  return {
    swing: s ? { home: side("home"), away: side("away") } : null,
    teaser: next && opp ? { text: `Next for ${book.ref(winner).name}: ${next.homeTeamId === winner ? "vs" : "at"} ${opp.name} · ${shortDate(new Date(next.start))}`, href: `/match/${next.id}` } : null,
  };
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
    fullTableHref: "/teams",
  };
}

/** a question still taking answers: status open and the lock ahead (the lock lands on the next tick) */
const openNow = (c: { status: string; locksAt: number } | null | undefined) => !!c && c.status === "open" && c.locksAt > Date.now();

export async function homePage(viewer: Viewer, opts: { team?: string; date?: string } = {}): Promise<HomePage & ApiMeta> {
  const now = liigaNow();
  const date = opts.date ?? helsinkiDate(now);
  const slug = opts.team ?? SITE.favoriteSlug;
  // the db work runs alongside the liiga requests. the no-op catch keeps an early failure from
  // being an unhandled rejection; the await below still raises it
  const leaderboardP = weeklyLeaderboard(viewer.user?.id ?? null);
  leaderboardP.catch(() => {});
  const [ctx, book, today, chosen] = await Promise.all([getSeasonContext(), teamBook(), getGamesOn(date).catch(() => null), favoriteTeamIds(viewer.user)]);
  const standings = await getStandings(ctx.season, true);
  // the fan's teams (the site's team until they pick); ?team= looks at the home page as another team's fan
  const asked = opts.team ? standings.data.rows.find((r) => r.teamId.endsWith(`:${slug}`))?.teamId : undefined;
  const favIds = asked ? [asked] : chosen.length ? chosen : [standings.data.rows[0]?.teamId ?? ""];
  const favId = favIds[0];
  const favSet = new Set(favIds);
  const isFav = (g: LiigaGame) => favSet.has(g.home.teamId) || favSet.has(g.away.teamId);

  // demo mode: the rotation is the show. its current match is featured (lobby, live or summary)
  // and its next two lead the upcoming list; rotation matches stay out of the other lists
  const rot = rotationNow();
  const rotationIds = new Set(rotationConfig()?.matches.map((m) => m.matchId) ?? []);
  const onNow = rot ? engineMatch(rot.current.matchId)?.visible : null;
  const rotationNext = rot ? nextRotationMatches(rot, 2) : [];

  // a running demo replay counts as live today, ahead of the real games
  const replays = activeReplays().filter((r) => r.visible.status === "live");
  const live = [...(onNow?.status === "live" ? [onNow] : []), ...replays.map((r) => r.visible)];
  const games = [...live, ...(today?.data ?? []).filter((g) => !rotationIds.has(g.id) && !live.some((x) => x.id === g.id))];
  const nowIso = now.toISOString();
  const upcomingFixtures = ctx.schedule.filter((f) => f.status === "scheduled" && f.start > nowIso && !rotationIds.has(f.id));
  const favNext = upcomingFixtures.find((f) => favSet.has(f.homeTeamId) || favSet.has(f.awayTeamId));
  const featuredGame =
    onNow ??
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
  const shared = forecastNow(ctx, [...strip.map((g) => g.id), ...upcoming.map((f) => f.id), ...rotationIds, ...(featuredGame ? [featuredGame.id] : [])]);
  const stakesOf = (g: LiigaGame) => stakesFor(ctx, g, shared);

  let featured: FeaturedMatch | null = null;
  if (featuredGame) {
    const s = stakesOf(featuredGame);
    const side = favSet.has(featuredGame.away.teamId) && !favSet.has(featuredGame.home.teamId) ? "away" : "home";
    const match = summaryOf(featuredGame, book, now);
    if (rot?.phase === "lobby" && featuredGame === onNow) Object.assign(match, { whenLabel: "Starting soon", startsAt: rot.phaseEnd });
    featured = {
      match,
      background: "/placeholders/featured-live.svg",
      whatItMeans: whatItMeansText(factsFor(featuredGame, s, side, book)),
      stakes: chips(s, featuredGame, book),
      // open = still taking answers: status open and the lock ahead (a lock lands on the next tick)
      openCalls: openNow(engineMatch(featuredGame.id)?.state?.call) ? 1 : 0,
      channel: !!engineMatch(featuredGame.id),
    };
  }
  const rotationUpcoming = rotationNext.flatMap(({ matchId, startsAt }) => {
    const g = engineMatch(matchId)?.visible;
    return g ? [{ ...summaryOf(g, book, now), whenLabel: "Next in the rotation", startsAt }] : [];
  });

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
    const team = favSet.has(f.homeTeamId) ? f.homeTeamId : favSet.has(f.awayTeamId) ? f.awayTeamId : null;
    if (!team) return undefined;
    const s = gameStakes(ctx, f, shared);
    if (!s) return undefined;
    const side = f.homeTeamId === team ? "home" : "away";
    return `What this game is worth for ${book.ref(team).name}: Win → ${pct(s.worth[side].regulationWin.playoffs)}% · Loss → ${pct(s.worth[side].regulationLoss.playoffs)}% playoff chance`;
  };
  // "your teams": each followed team's next game and what it is worth
  const world = await teamsWorld(favIds);
  const yourTeams = favIds.flatMap((id) => {
    const item = world.items.find((i) => i.team.id === id);
    return item ? [{ team: item.team, slug: item.slug, next: item.next }] : [];
  });

  const recent = ctx.schedule.filter((f) => f.status === "final" && !rotationIds.has(f.id)).slice(-6).reverse();
  const sources: DataSource[] = [ctx.source, standings.source, today?.source ?? "live"];
  const favLive = games.some((g) => g.status === "live" && isFav(g));
  return {
    hero: SITE.hero,
    dateLabel: longDate(new Date(`${date}T12:00:00Z`)),
    featured,
    seasonStakesToday,
    live: games.filter((g) => g.status === "live").map((g) => summaryOf(g, book, now)),
    upcoming: [...rotationUpcoming, ...upcoming.map((f) => summaryOf(gameOfFixture(f), book, now, favWorth(f)))],
    recent: recent.map((f) => ({ ...summaryOf(gameOfFixture(f), book, now, resultNote(f, book)), ...resultCard(ctx, f, book, nowIso) })),
    comingSoon: [...SITE.comingSoon],
    leaderboard: { ...SITE.leaderboard, entries: await leaderboardP },
    // demo mode never shows the api's table: it already counts games after the demo date
    table: {
      ...(demoMode() ? engineTable(shared.world.table, favId, book) : liigaTable(standings.data.rows, favId, favLive, book)),
      highlightTeamIds: favIds,
    },
    yourTeams,
    asOf: demoMode() ? now.toISOString() : standings.asOf,
    source: sources.includes("snapshot") ? "snapshot" : "live",
  };
}

/** the rotation's next matches after the current one (wrapping into the next cycle) */
function nextRotationMatches(r: RotationNow, n: number): { matchId: string; startsAt: number }[] {
  const out: { matchId: string; startsAt: number }[] = [];
  for (let i = 1; i <= n && i < r.slots.length; i++) {
    const k = r.current.index + i;
    const slot = r.slots[k % r.slots.length];
    out.push({ matchId: slot.matchId, startsAt: slot.lobbyAt + (k >= r.slots.length ? r.cycleLength : 0) });
  }
  return out;
}

/** the table our engine computes from the (masked) schedule: the standings as of the demo clock */
export function engineTable(rows: TableRow[], favId: string, book: TeamBook): LiigaTableData {
  const sorted = [...rows].sort(compareRows);
  return {
    rows: sorted.map((r, i) => ({
      teamId: r.teamId,
      team: book.ref(r.teamId),
      rank: i + 1,
      points: r.points,
      gamesPlayed: r.gamesPlayed,
      goalDifference: r.goalsFor - r.goalsAgainst,
      zone: zoneForRank(i + 1),
    })),
    highlightTeamId: favId,
    highlightNote: null,
    fullTableHref: "/teams",
  };
}

function stakesFor(ctx: SeasonContext, g: LiigaGame, shared: ReturnType<typeof forecastNow>): GameStakes | null {
  const f = ctx.schedule.find((x) => x.id === g.id);
  return f ? gameStakes(ctx, f, shared) : null;
}
