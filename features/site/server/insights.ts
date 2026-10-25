// the finished match page's graphics, all from liiga data and the stakes engine: the season impact
// (chance before -> after, the table before -> after), the game in one chart (goals on a shared
// axis with the playoff-chance steps), shots and puck control per period, the player of the game,
// and "next time": the next opponent, what it's worth, the head-to-head, both teams' form and a
// player on a hot streak. no generated text: every number is read off the data
import type { LiigaFixture, LiigaGame, LiigaGameStats, RosterPlayer } from "@/features/liiga";
import { getRoster, getSeasonStats, liigaNow, type PlayerGameLine } from "@/features/liiga/server";
import { compareRows, rankOf, zoneForRank, type SeasonContext } from "@/features/stakes/server";
import type { FinishedInsights, FormResult, GoalMarker, NextTimePanel, VideoInfo, WhatIfTableRow } from "@/shared/types";
import { describeGoalTypes } from "./match-types";
import { projectedTable, timelineFor, type GameStakes } from "./game-stakes";
import { clockIn, ordinal, pct, shortDate, timeLabel } from "./labels";
import type { NextGame } from "./match";
import type { TeamBook } from "./teams";

type Side = "home" | "away";
type Goal = LiigaGame["goals"][number];

const initials = (name: string | null) =>
  (name ?? "?")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .slice(0, 2)
    .join("");

const plays = (f: LiigaFixture, teamId: string) => f.homeTeamId === teamId || f.awayTeamId === teamId;

/** a finished fixture from one team's view */
function resultFor(f: Pick<LiigaFixture, "homeTeamId" | "homeGoals" | "awayGoals" | "decidedIn">, teamId: string): { result: FormResult; own: number; other: number } {
  const home = f.homeTeamId === teamId;
  const own = (home ? f.homeGoals : f.awayGoals) ?? 0;
  const other = (home ? f.awayGoals : f.homeGoals) ?? 0;
  const won = own > other;
  return { result: f.decidedIn === "regulation" ? (won ? "W" : "L") : won ? "OTW" : "OTL", own, other };
}

/** tonight's game as a fixture */
const fixtureOfGame = (g: LiigaGame): LiigaFixture => ({
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

/** the table before and after the game, each row with both places */
function impactTable(s: GameStakes, g: LiigaGame, book: TeamBook): WhatIfTableRow[] {
  const before = [...s.table].sort(compareRows);
  const after = projectedTable(s, g);
  const was = new Map(before.map((r, i) => [r.teamId, { rank: i + 1, points: r.points }]));
  return after.map((r, i) => ({
    team: book.ref(r.teamId),
    rank: i + 1,
    rankBefore: was.get(r.teamId)?.rank ?? i + 1,
    points: r.points,
    pointsBefore: was.get(r.teamId)?.points ?? r.points,
    zone: zoneForRank(i + 1),
  }));
}

/** goals and assists per player tonight (the shootout doesn't count) */
function tonightLines(g: LiigaGame): Map<number, { name: string; side: Side; goals: number; assists: number; winning: boolean }> {
  const out = new Map<number, { name: string; side: Side; goals: number; assists: number; winning: boolean }>();
  const line = (id: number, name: string, side: Side) => out.get(id) ?? out.set(id, { name, side, goals: 0, assists: 0, winning: false }).get(id)!;
  for (const goal of g.goals) {
    if (goal.period > 4) continue;
    if (goal.scorerId !== null) {
      const l = line(goal.scorerId, goal.scorer ?? "", goal.side);
      l.goals++;
      l.winning ||= goal.winningGoal;
    }
    goal.assistIds.forEach((id, i) => line(id, goal.assists[i] ?? "", goal.side).assists++);
  }
  return out;
}

/** points in a row, counting back from the latest game */
const pointStreak = (lines: { goals: number; assists: number }[]) => {
  let n = 0;
  for (let i = lines.length - 1; i >= 0 && lines[i].goals + lines[i].assists > 0; i--) n++;
  return n;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export interface InsightsInput {
  g: LiigaGame;
  s: GameStakes;
  side: Side;
  ctx: SeasonContext;
  book: TeamBook;
  stats: LiigaGameStats | null;
  coming: NextGame | null;
  clip: (goal: Goal, title: string) => VideoInfo | null;
}

export async function finishedInsights({ g, s, side, ctx, book, stats, coming, clip }: InsightsInput): Promise<FinishedInsights> {
  const [roster, season] = await Promise.all([getRoster(g.season, g.gameId).catch(() => null), getSeasonStats(g.season).catch(() => null)]);
  const players = new Map<number, RosterPlayer>([...(roster?.data.home ?? []), ...(roster?.data.away ?? [])].map((p) => [p.id, p]));
  const team = (x: Side) => book.ref(g[x].teamId, g[x].name);
  const focusId = g[side].teamId;

  // the game in one chart: goals on one time axis, and the focus team's chance after each
  const timeline = timelineFor(s, side, g);
  const after = new Map(timeline.filter((p) => p.goalId).map((p, i, all) => [p.goalId!, { after: pct(p.chance), before: pct((i === 0 ? timeline[0] : all[i - 1]).chance) }]));
  const regular = g.goals.filter((x) => x.period <= 4);
  const goals: GoalMarker[] = regular.map((goal) => {
    const chance = after.get(goal.id);
    const photo = goal.scorerId !== null ? (players.get(goal.scorerId)?.pictureUrl ?? null) : null;
    return {
      id: goal.id,
      side: goal.side,
      team: team(goal.side),
      seconds: goal.gameTime,
      period: goal.period,
      time: goal.period >= 4 ? `OT ${clockIn(goal.gameTime, goal.period)}` : clockIn(goal.gameTime, goal.period),
      score: `${goal.homeScore}–${goal.awayScore}`,
      scorer: goal.scorer,
      assists: goal.assists,
      photo,
      initials: initials(goal.scorer),
      chanceBefore: chance?.before ?? null,
      chanceAfter: chance?.after ?? null,
      kind: describeGoalTypes(goal.types).labels[0] ?? null,
      video: clip(goal, `${goal.scorer ?? team(goal.side).name} · ${goal.homeScore}–${goal.awayScore}`),
    };
  });
  const steps = [{ seconds: 0, chance: pct(s.baseline[side].playoffs) }, ...goals.filter((x) => x.chanceAfter !== null).map((x) => ({ seconds: x.seconds, chance: x.chanceAfter! }))];
  const endSeconds = g.decidedIn && g.decidedIn !== "regulation" ? 3900 : 3600;

  // the periods: shots and puck control where the feed has them
  const periods = [1, 2, 3, 4]
    .map((n) => {
      const shot = stats?.shotsByPeriod.find((x) => x.period === n);
      const ctl = stats?.momentumByPeriod.find((x) => x.period === n);
      return { label: n === 4 ? "OT" : ordinal(n), shots: shot ? { home: shot.home, away: shot.away } : null, control: ctl ? { home: ctl.home, away: ctl.away } : null };
    })
    .filter((p) => p.shots || p.control)
    // overtime only when it was played and has numbers
    .filter((p) => p.label !== "OT" || (g.decidedIn && g.decidedIn !== "regulation"));

  // the player of the game: most points tonight, then goals, then the winning goal
  const tonight = tonightLines(g);
  const log = season?.log ?? new Map<number, PlayerGameLine[]>();
  const withTonight = (id: number): { goals: number; assists: number }[] => {
    const lines = log.get(id) ?? [];
    const t = tonight.get(id);
    return lines.some((l) => l.matchId === g.id) || !t ? lines : [...lines, { goals: t.goals, assists: t.assists }];
  };
  const best = [...tonight.entries()].sort(
    ([, a], [, b]) => b.goals + b.assists - (a.goals + a.assists) || b.goals - a.goals || Number(b.winning) - Number(a.winning),
  )[0];
  let playerOfGame: FinishedInsights["playerOfGame"] = null;
  if (best) {
    const [id, t] = best;
    const lines = withTonight(id);
    const seasonTotals = lines.length ? { games: lines.length, goals: lines.reduce((n, l) => n + l.goals, 0), assists: lines.reduce((n, l) => n + l.assists, 0) } : null;
    const last3 = lines.slice(-3);
    const goals3 = last3.reduce((n, l) => n + l.goals, 0);
    const streak = pointStreak(lines);
    const note =
      goals3 >= 3 && last3.length === 3
        ? `${goals3} goals in the last 3 games`
        : streak >= 3
          ? `Points in ${streak} games in a row`
          : t.goals > 0 && seasonTotals
            ? `${ordinal(seasonTotals.goals)} goal of the season`
            : t.assists > 0
              ? `${plural(t.assists, "assist", "assists")} tonight`
              : null;
    playerOfGame = {
      name: players.get(id) ? `${players.get(id)!.firstName} ${players.get(id)!.lastName}`.trim() : t.name,
      team: team(t.side),
      photo: players.get(id)?.pictureUrl ?? null,
      initials: initials(t.name),
      goals: t.goals,
      assists: t.assists,
      season: seasonTotals,
      note,
    };
  }

  const table = impactTable(s, g, book);
  const rankAfter = rankOf(projectedTable(s, g), focusId);
  return {
    focus: { team: team(side), side },
    impact: {
      chanceBefore: pct(s.baseline[side].playoffs),
      chanceAfter: steps[steps.length - 1].chance,
      rankBefore: rankOf([...s.table].sort(compareRows), focusId),
      rankAfter,
      zoneAfter: zoneForRank(rankAfter),
      table,
    },
    game: { endSeconds, goals, steps },
    periods,
    playerOfGame,
    nextTime: coming ? nextTime(g, coming, focusId, ctx, book, log, tonight, steps[steps.length - 1].chance) : null,
  };
}

function nextTime(
  g: LiigaGame,
  coming: NextGame,
  focusId: string,
  ctx: SeasonContext,
  book: TeamBook,
  log: Map<number, PlayerGameLine[]>,
  tonight: ReturnType<typeof tonightLines>,
  chanceNow: number,
): NextTimePanel {
  const f = coming.fixture;
  const home = f.homeTeamId === focusId;
  const oppId = home ? f.awayTeamId : f.homeTeamId;
  const opponent = home ? book.ref(f.awayTeamId, f.awayName) : book.ref(f.homeTeamId, f.homeName);
  const nowIso = liigaNow().toISOString();
  const finals = ctx.schedule.filter((x) => x.status === "final" && x.homeGoals !== null && x.awayGoals !== null && x.id !== g.id && x.start < g.start);
  const title = (x: LiigaFixture, teamId: string) => {
    const r = resultFor(x, teamId);
    const other = x.homeTeamId === teamId ? book.ref(x.awayTeamId, x.awayName) : book.ref(x.homeTeamId, x.homeName);
    return `${r.result === "W" || r.result === "OTW" ? "Win" : "Loss"} ${r.own}–${r.other}${x.decidedIn === "regulation" ? "" : x.decidedIn === "shootout" ? " (SO)" : " (OT)"} vs ${other.name}`;
  };

  const headToHead = finals
    .filter((x) => plays(x, focusId) && plays(x, oppId))
    .map((x) => {
      const r = resultFor(x, focusId);
      return { matchId: x.id, date: shortDate(new Date(x.start)), result: r.result, score: `${r.own}–${r.other}` };
    });
  const tonightFixture = fixtureOfGame(g);
  const formOf = (teamId: string) => {
    const played = finals.filter((x) => plays(x, teamId) && x.start < nowIso);
    // tonight's game counts for the two teams that played it
    const list = plays(tonightFixture, teamId) ? [...played, tonightFixture] : played;
    return list.slice(-5).map((x) => ({ result: resultFor(x, teamId).result, title: title(x, teamId) }));
  };

  // a player on a hot streak in the next game: the most points over their last three games
  const candidates: { name: string; teamId: string; picture: string | null; lines: { goals: number; assists: number }[] }[] = [];
  for (const [id, lines] of log) {
    const latest = lines[lines.length - 1];
    if (!latest || (latest.teamId !== focusId && latest.teamId !== oppId)) continue;
    const t = tonight.get(id);
    const all = lines.some((l) => l.matchId === g.id) || !t ? lines : [...lines, { ...latest, matchId: g.id, goals: t.goals, assists: t.assists }];
    candidates.push({ name: latest.name, teamId: latest.teamId, picture: latest.picture, lines: all });
  }
  const scored = candidates
    .map((c) => {
      const last3 = c.lines.slice(-3);
      return { c, games: last3.length, goals: last3.reduce((n, l) => n + l.goals, 0), points: last3.reduce((n, l) => n + l.goals + l.assists, 0), streak: pointStreak(c.lines) };
    })
    .filter((x) => x.games === 3 && x.points >= 3)
    .sort((a, b) => b.points - a.points || b.goals - a.goals || b.streak - a.streak);
  const hot = scored[0];
  const playerToWatch = hot
    ? {
        name: hot.c.name,
        team: book.ref(hot.c.teamId),
        photo: hot.c.picture,
        initials: initials(hot.c.name),
        note:
          hot.goals >= 2
            ? `${hot.goals} goals and ${plural(hot.points - hot.goals, "assist", "assists")} in the last 3 games`
            : `${hot.points} points in the last 3 games${hot.streak >= 3 ? `, points in ${hot.streak} in a row` : ""}`,
      }
    : null;

  const d = new Date(f.start);
  return {
    matchId: f.id,
    opponent,
    home,
    when: `${shortDate(d)} · ${timeLabel(d)}`,
    // the chance that game moves most for the team (playoff, relegation or top 4)
    worth: coming.relevant ?? (coming.win !== null && coming.loss !== null ? { label: "Playoff chance", now: chanceNow, win: coming.win, loss: coming.loss } : null),
    headToHead,
    form: [
      { team: book.ref(focusId), results: formOf(focusId) },
      { team: opponent, results: formOf(oppId) },
    ],
    playerToWatch,
    followTeamId: focusId,
  };
}
