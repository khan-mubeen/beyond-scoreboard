// GET /api/site/matches/:id: a live, upcoming or finished match exactly as the ui types it
import { liigaGameUrl, parseMatchId, type LiigaFixture, type LiigaGame } from "@/features/liiga";
import { getGame, getGameStats, getLineups, getPastAndFuture, liigaNow } from "@/features/liiga/server";
import { goalOfTheGame, rankOf, zoneForRank, zoneLabel, getSeasonContext, type SeasonContext } from "@/features/stakes/server";
import { engineMatch, ensureLiveLoop, roomScope } from "@/features/live/server";
import { matchStory, spokenSummary, whatItMeansText, type MatchFactsInput } from "@/features/story/server";
import { getDb } from "@/shared/db";
import type {
  ApiMeta,
  DataSource,
  FinishedMatchDetail,
  GameOutcome,
  LiveMatchDetail,
  MatchDetail,
  SeasonStakes,
  StakesChipData,
} from "@/shared/types";
import { describeGoalTypes } from "./match-types";
import { chanceNow, gameStakes, projectedTable, timelineFor, type GameStakes } from "./game-stakes";
import type { Viewer } from "./identity";
import { clockIn, longDate, ordinal, pct, periodName, shortDate, timeLabel } from "./labels";
import { eventsOf, goalVideo, lineupsOf, statsOf, summaryOf } from "./match-parts";
import { clipOf, highlightOf } from "./highlight";
import { recentComments, roomSummary } from "./social";
import { SITE } from "./config";
import { teamBook, type TeamBook } from "./teams";
import { whatIfOptions } from "./whatif";
import { previewDetail } from "./preview";
import { matchStarted } from "./started";

export type Side = "home" | "away";

/** the side the stakes card is written for: the favourite team when it plays, else home */
const stakesSide = (g: LiigaGame): Side => (g.away.teamId.endsWith(`:${SITE.favoriteSlug}`) ? "away" : "home");
const other = (s: Side): Side => (s === "home" ? "away" : "home");

const fixtureOf = (g: LiigaGame): LiigaFixture => ({
  id: g.id,
  gameId: g.gameId,
  season: g.season,
  start: g.start,
  status: g.status,
  decidedIn: g.decidedIn,
  homeTeamId: g.home.teamId,
  awayTeamId: g.away.teamId,
  homeName: g.home.name,
  awayName: g.away.name,
  homeGoals: g.home.goals,
  awayGoals: g.away.goals,
  xg: null,
  rink: g.rink,
});

export function chips(s: GameStakes | null, g: LiigaGame, book: TeamBook): StakesChipData[] {
  if (!s) return [];
  return (["home", "away"] as const).map((side) => {
    const now = chanceNow(s, side, g).playoffs;
    return {
      team: book.ref(g[side].teamId, g[side].name),
      label: "Playoff chance",
      chance: pct(now),
      change: pct(now) - pct(s.baseline[side].playoffs),
    };
  });
}

export function seasonStakesCard(s: GameStakes, g: LiigaGame, side: Side, book: TeamBook): SeasonStakes {
  const team = g[side];
  const timeline = timelineFor(s, side, g);
  const now = chanceNow(s, side, g).playoffs;
  const before = s.baseline[side].playoffs;
  const table = projectedTable(s, g);
  const rankNow = rankOf(table, team.teamId);
  const rankBefore = rankOf(s.table, team.teamId);
  const label = g.status === "final" ? "after the game" : g.status === "live" ? "if it ends now" : "before the game";
  const worth = s.worth[side];
  const titleLead = g.status === "final" ? "After the game" : g.status === "live" ? "If it ends now" : "Before the game";
  return {
    teamName: team.name,
    source: "From league data · scenario model",
    chance: pct(now),
    change: pct(now) - pct(before),
    before: pct(before),
    now: pct(now),
    nowLabel: label,
    steps: timeline.map((p) => ({ label: p.label, chance: pct(p.chance) })),
    tableTitle: g.status === "scheduled" ? `${titleLead}: ${ordinal(rankBefore)}` : `${titleLead}: ${ordinal(rankBefore)} → ${ordinal(rankNow)}`,
    tableBadge: rankNow <= 12 ? "Above playoff line" : rankNow <= 14 ? "Below playoff line" : "In the relegation zone",
    // the whole table (the card scrolls it to the team); an 8-row window used to cut off 1st place
    rows: table.map((r) => ({
      rank: r.rank,
      label: r.teamId === team.teamId ? `${book.ref(r.teamId).name}${g.status === "live" ? " · if it ends now" : ""}` : book.ref(r.teamId).name,
      zone: zoneForRank(r.rank),
      ...(r.teamId === team.teamId && { highlight: true }),
    })),
    worth: Object.fromEntries((Object.keys(worth) as GameOutcome[]).map((o) => [o, pct(worth[o].playoffs)])) as Record<GameOutcome, number>,
  };
}

/** "20.10.2026" in Helsinki */
const fiDate = (d: Date) => new Intl.DateTimeFormat("fi-FI", { timeZone: "Europe/Helsinki", day: "numeric", month: "numeric", year: "numeric" }).format(d);

/** the goal that moved the team's chance most, with the chance before and after it */
function turningPoint(s: GameStakes | null, side: Side, g: LiigaGame): MatchFactsInput["turningPoint"] {
  if (!s || g.goals.length === 0) return null;
  const timeline = timelineFor(s, side, g);
  const gotg = goalOfTheGame(timeline);
  const at = timeline.findIndex((p) => p.goalId === gotg?.goalId);
  const goal = g.goals.findIndex((x) => x.id === gotg?.goalId);
  if (!gotg || at < 1 || goal < 0) return null;
  return { goal, before: pct(timeline[at - 1].chance), after: pct(gotg.chance) };
}

/**
 * the facts the texts may use, for one team's point of view. `next` (the team's next game) is
 * only known after an async lookup, so the summary passes it in
 */
export function factsFor(g: LiigaGame, s: GameStakes | null, side: Side, book: TeamBook, next: NextGame | null = null): MatchFactsInput {
  const table = s ? projectedTable(s, g) : null;
  const name = (x: Side) => book.ref(g[x].teamId, g[x].name).name;
  return {
    dateFi: fiDate(new Date(g.start)),
    worth: s ? { win: pct(s.worth[side].regulationWin.playoffs), loss: pct(s.worth[side].regulationLoss.playoffs) } : null,
    turningPoint: g.status === "final" ? turningPoint(s, side, g) : null,
    next: next && { opponent: next.opponent, date: next.date, dateFi: next.dateFi, win: next.win, loss: next.loss },
    matchId: g.id,
    home: name("home"),
    away: name("away"),
    team: name(side),
    score: { home: g.home.goals, away: g.away.goals },
    decidedIn: g.decidedIn,
    venue: g.rink,
    date: longDate(new Date(g.start)),
    goals: g.goals.map((goal) => ({
      scorer: goal.scorer,
      team: name(goal.side),
      // 4 is overtime, 5 the shootout
      period: Math.min(goal.period, 5),
      time: clockIn(goal.gameTime, goal.period),
      homeScore: goal.homeScore,
      awayScore: goal.awayScore,
      kind: describeGoalTypes(goal.types).labels[0] ?? null,
    })),
    chanceBefore: s ? pct(s.baseline[side].playoffs) : null,
    chanceAfter: s ? pct(chanceNow(s, side, g).playoffs) : null,
    positionBefore: s ? rankOf(s.table, g[side].teamId) : null,
    positionAfter: table ? rankOf(table, g[side].teamId) : null,
    sourceGameIds: [g.id],
  };
}

export interface NextGame {
  fixture: LiigaFixture;
  opponent: string;
  date: string;
  dateFi: string;
  /** the team's playoff chance with a regulation win / loss there */
  win: number | null;
  loss: number | null;
}

/** the stakes team's next game: pastAndFutureGames first (as docs/api/mapping.md), the schedule as a fallback */
export async function nextGame(g: LiigaGame, side: Side, ctx: SeasonContext, book: TeamBook): Promise<NextGame | null> {
  const teamId = g[side].teamId;
  const pf = await getPastAndFuture(g);
  const futureId = (side === "home" ? pf?.data.futureHome : pf?.data.futureAway)?.find((x) => x.start > g.start)?.id;
  const next =
    (futureId && ctx.schedule.find((f) => f.id === futureId)) ||
    ctx.schedule.find((f) => f.status === "scheduled" && f.start > g.start && (f.homeTeamId === teamId || f.awayTeamId === teamId));
  if (!next) return null;
  const s = gameStakes(ctx, next);
  const nextSide: Side = next.homeTeamId === teamId ? "home" : "away";
  const other = nextSide === "home" ? book.ref(next.awayTeamId, next.awayName) : book.ref(next.homeTeamId, next.homeName);
  const d = new Date(next.start);
  return {
    fixture: next,
    opponent: other.name,
    date: longDate(d),
    dateFi: fiDate(d),
    win: s ? pct(s.worth[nextSide].regulationWin.playoffs) : null,
    loss: s ? pct(s.worth[nextSide].regulationLoss.playoffs) : null,
  };
}

function nextUp(next: NextGame | null, book: TeamBook): FinishedMatchDetail["nextUp"] {
  if (!next) return null;
  const f = next.fixture;
  const d = new Date(f.start);
  return {
    title: `${book.ref(f.homeTeamId, f.homeName).name} vs ${book.ref(f.awayTeamId, f.awayName).name}`,
    when: `${shortDate(d)} · ${timeLabel(d)}`,
    worth: next.win !== null ? `What it's worth: Win → ${next.win}% playoff chance` : "What it's worth: chances update after tonight",
    matchId: f.id,
  };
}

async function yourNight(matchId: string, youId: string | null): Promise<FinishedMatchDetail["yourNight"]> {
  if (!youId) return null;
  const db = getDb();
  const since = roomScope(matchId).since;
  const calls = (await db.calls.listForMatch(matchId)).filter((c) => c.status === "resolved" && c.openedAt >= since);
  const mine = await db.answers.listForUser(youId, calls.map((c) => c.id));
  if (mine.length === 0) return null;
  const all = await db.points.listSince(since, matchId);
  const totals = new Map<string, number>();
  for (const r of all) totals.set(r.userId, (totals.get(r.userId) ?? 0) + r.points);
  const myPoints = totals.get(youId) ?? 0;
  const best = mine.find((a) => a.correct);
  const bestCall = best ? calls.find((c) => c.id === best.callId)?.question ?? "" : "";
  return {
    points: myPoints,
    callsCorrect: mine.filter((a) => a.correct).length,
    callsTotal: mine.length,
    rank: 1 + [...totals.values()].filter((p) => p > myPoints).length,
    of: Math.max(totals.size, 1),
    bestCall: best ? `Called it: ${bestCall}` : "No correct calls this time",
  };
}

export async function matchDetail(id: string, viewer: Viewer): Promise<(MatchDetail & ApiMeta) | null> {
  const ids = parseMatchId(id);
  if (!ids) return null;
  const res = await getGame(ids.season, ids.gameId).catch(() => null);
  if (!res) return null;
  // a match the live engine runs: its visible state (a replay shows only what has happened so far)
  const eng = engineMatch(id);
  const isReplay = !!eng?.isReplay;
  const g = eng?.visible ?? res.data.game;
  const names = eng?.visible ? eng.names : res.data.names;
  if (!eng && g.status === "live") void ensureLiveLoop(id, g);
  const [ctx, book] = await Promise.all([getSeasonContext(), teamBook()]);
  const now = liigaNow();
  // the schedule's status picks the forecast: a final (even one being replayed) is judged as
  // the season stood before it; the game's own status decides "if it ends now" vs the result
  const fixture = ctx.schedule.find((f) => f.id === g.id) ?? fixtureOf(g);
  const s = gameStakes(ctx, fixture);
  const side = stakesSide(g);
  const youId = viewer.user?.id ?? null;
  // not started (a rotation match starts at its lobby): the preview page
  if (!(await matchStarted(id))) {
    return previewDetail({ g, s, side, ctx, book, viewer, source: res.source === "snapshot" || ctx.source === "snapshot" ? "snapshot" : "live" });
  }
  // a replay's real stats are the final totals: hide them until the replay ends
  const hideStats = g.status === "scheduled" || (isReplay && g.status !== "final");
  // the game as the page shows it (a masked or replayed game has no final stats yet)
  const [stats, lineups] = await Promise.all([hideStats ? null : getGameStats(g), getLineups(g)]);

  const timeline = s ? timelineFor(s, side, g) : [];
  const facts = factsFor(g, s, side, book);
  const source: DataSource = res.source === "snapshot" || ctx.source === "snapshot" ? "snapshot" : "live";
  const latestGoal = g.goals.at(-1);
  const rotation = eng?.rotation ?? null;
  const highlight = highlightOf(id);
  const liigaUrl = liigaGameUrl(g);
  const clip = clipOf(id, liigaUrl);
  const summary = summaryOf(g, book, now);
  if (rotation?.phase === "lobby") Object.assign(summary, { whenLabel: "Starting soon", startsAt: rotation.liveStartedAt });
  const base = {
    liigaUrl,
    id: g.id,
    breadcrumbs: [{ label: "Sports", href: "/sports" }, { label: "Ice Hockey", href: "/sports" }, { label: "Liiga", href: "/sports" }, { label: `${g.home.name} – ${g.away.name}` }],
    match: summary,
    venue: g.rink ?? "",
    dateLabel: shortDate(new Date(g.start)),
    spectators: g.spectators,
    stakesSummary: chips(s, g, book),
    events: eventsOf(g, names, timeline, book, clip),
    eventsNote: "Goals and penalties as they happen. Shots and more are under Statistics.",
    stats: statsOf(stats?.data ?? null),
    statsSource: "Liiga feed",
    statsNote: stats
      ? "From the Liiga feed. A stat the feed doesn't have shows as pending, no values are assumed."
      : isReplay && g.status !== "final"
        ? "Statistics appear when the replay ends: the feed only has the final totals."
        : "Awaiting statistics from the Liiga feed. No values are assumed.",
    lineups: lineupsOf(lineups?.data ?? null),
    seasonStakes: s ? { ...seasonStakesCard(s, g, side, book), whatIf: g.status === "final" ? null : await whatIfOptions(ctx, g.id) } : emptyStakes(g[side].name),
    isReplay,
    highlight,
    rotation,
    asOf: res.asOf,
    source,
  };
  const highlightInfo = highlight && {
    poster: highlight.poster ?? "/placeholders/video-highlights.svg",
    title: `Match highlights · ${g.home.name} – ${g.away.name}`,
    src: highlight.type === "mp4" ? highlight.url : null,
    href: liigaUrl,
  };

  if (g.status !== "final") {
    const [discussion, room] = await Promise.all([recentComments(g.id), roomSummary(g.id, youId, false)]);
    const detail: LiveMatchDetail & ApiMeta = {
      ...base,
      status: g.status === "live" ? "live" : "scheduled",
      video: highlightInfo ?? (latestGoal && goalVideo(latestGoal, `Latest goal · ${latestGoal.scorer ?? g[latestGoal.side].name}`, liigaUrl)) ?? {
        poster: "/placeholders/video-live.svg",
        title: `${g.home.name} – ${g.away.name}`,
        src: null,
        href: liigaUrl,
      },
      whatItMeans: whatItMeansText(facts),
      discussion,
      guidelinesHref: "/guidelines",
      callIt: null,
      room,
    };
    return detail;
  }

  const gotg = goalOfTheGame(timeline);
  const goal = gotg && g.goals.find((x) => x.id === gotg.goalId);
  const before = timeline.findIndex((p) => p.goalId === gotg?.goalId);
  const coming = await nextGame(g, side, ctx, book);
  // the spoken summary also says what's next, so it gets the next game's facts
  const summaryFacts = factsFor(g, s, side, book, coming);
  const [{ content }, night, room, discussion, en, fi] = await Promise.all([
    matchStory(facts, g[side].teamId),
    yourNight(g.id, youId),
    roomSummary(g.id, youId, true),
    recentComments(g.id),
    spokenSummary(summaryFacts, g[side].teamId, "en"),
    spokenSummary(summaryFacts, g[side].teamId, "fi"),
  ]);
  const next = nextUp(coming, book);
  const posBefore = facts.positionBefore ?? 0;
  const posAfter = facts.positionAfter ?? 0;
  const detail: FinishedMatchDetail & ApiMeta = {
    ...base,
    status: "final",
    video: highlightInfo ?? (goal && clip(goal, `Goal of the game · ${goal.scorer ?? ""}`)) ?? { poster: "/placeholders/video-highlights.svg", title: "Match highlights", src: null, href: liigaUrl },
    whatItMeant: {
      badge: "Facts from match data",
      chanceBefore: facts.chanceBefore ?? 0,
      chanceAfter: facts.chanceAfter ?? 0,
      positionBefore: posBefore,
      positionAfter: posAfter,
      positionNote: posAfter <= 12 ? "Above playoff line" : posAfter <= 14 ? "Below playoff line" : "In the relegation zone",
      story: content,
      chips: [
        { label: `Before: ${ordinal(posBefore)} · ${facts.chanceBefore}%`, tone: "neutral" },
        { label: `After: ${ordinal(posAfter)} · ${facts.chanceAfter}%`, tone: "good" },
        { label: zoneLabel(zoneForRank(posAfter || 17)), tone: posAfter <= 12 ? "good" : "neutral" },
      ],
    },
    goalOfTheGame:
      goal && gotg
        ? {
            thumbnail: goal.thumbUrl ?? "/placeholders/goal-thumb.svg",
            meta: [clockIn(goal.gameTime, goal.period), periodName(goal.period), ...describeGoalTypes(goal.types).labels].join(" · "),
            title: `${goal.scorer ?? g[goal.side].name}'s ${goal.homeScore}–${goal.awayScore} goal`,
            effectText: `Playoff chance for ${g[side].name}: ${pct(timeline[before - 1]?.chance ?? 0)}% → ${pct(gotg.chance)}%.`,
            chip: `Playoff chance ${Math.round(gotg.delta * 100) > 0 ? "+" : "−"}${Math.abs(Math.round(gotg.delta * 100))}%`,
            video: clip(goal, `${goal.scorer ?? ""} · ${goal.homeScore}–${goal.awayScore}`) ?? { poster: "/placeholders/goal-thumb.svg", title: "Goal", src: null, href: liigaUrl },
          }
        : null,
    yourNight: night,
    room,
    discussion,
    nextUp: next,
    summary: { en, fi },
  };
  return detail;
}

export function emptyStakes(teamName: string): SeasonStakes {
  return {
    teamName,
    source: "From league data · scenario model",
    chance: 0,
    change: 0,
    before: 0,
    now: 0,
    nowLabel: "pending",
    steps: [],
    tableTitle: "Stakes pending",
    tableBadge: "Data pending",
    rows: [],
    worth: { regulationWin: 0, overtimeWin: 0, overtimeLoss: 0, regulationLoss: 0 },
  };
}

export { other, stakesSide };
