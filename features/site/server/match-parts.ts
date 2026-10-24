// pieces of a match page built from liiga data: summary, events, stats, lineups, video
import { describeGoalTypes, type LiigaGame, type LiigaGameStats, type LiigaLineups, type TimelineLike } from "./match-types";
import type { MatchEvent, MatchStat, MatchSummary, Score, VideoInfo } from "@/shared/types";
import { clockIn, periodName, whenLabel } from "./labels";
import type { TeamBook } from "./teams";

export function periodScoresOf(g: LiigaGame): (Score | null)[] {
  const regular = [1, 2, 3].map((i) => {
    const p = g.periods.find((x) => x.index === i);
    const played = g.status === "final" || (g.status === "live" && (g.currentPeriod ?? 0) >= i);
    return p && played ? { home: p.home, away: p.away } : null;
  });
  const extra = g.periods.filter((p) => p.category !== "NORMAL" && (p.home + p.away > 0 || (g.status === "final" && g.decidedIn !== "regulation")));
  const decisive = extra.filter((p) => p.home + p.away > 0).map((p) => ({ home: p.home, away: p.away }));
  return [...regular, ...decisive];
}

export function summaryOf(g: LiigaGame, book: TeamBook, now: Date, note?: string): MatchSummary {
  const live = g.status === "live";
  return {
    id: g.id,
    league: "Liiga",
    status: g.status === "cancelled" ? "scheduled" : g.status,
    home: book.ref(g.home.teamId, g.home.name),
    away: book.ref(g.away.teamId, g.away.name),
    score: g.status === "scheduled" ? null : { home: g.home.goals, away: g.away.goals },
    periodScores: g.status === "scheduled" ? [] : periodScoresOf(g),
    ...(live && { periodLabel: periodName(g.currentPeriod ?? 1), clock: clockIn(g.gameTime, g.currentPeriod ?? 1) }),
    whenLabel: g.status === "cancelled" ? "Cancelled" : whenLabel(g.start, now),
    ...(note && { note }),
    href: `/match/${g.id}`,
  };
}

const PLACEHOLDER_POSTER = "/placeholders/goal-thumb.svg";

/**
 * a goal liiga has a clip of: its thumbnail and "Watch on liiga.fi" (href). we never play liiga's
 * streams in the app (hls, and each opens with a betting bumper); only our own highlights play
 */
export function goalVideo(goal: LiigaGame["goals"][number], title: string, href: string): VideoInfo | null {
  if (!goal.videoUrl) return null;
  return { poster: goal.thumbUrl ?? PLACEHOLDER_POSTER, title, src: null, href };
}

type Goal = LiigaGame["goals"][number];

/**
 * goals and penalties, newest first. goal effects are playoff-chance points for the stakes team.
 * clipOf gives a goal's video (a rotation match: its highlight, from just before the goal)
 */
export function eventsOf(
  g: LiigaGame,
  names: Map<number, string>,
  timeline: TimelineLike[],
  book: TeamBook,
  clipOf: (goal: Goal, title: string) => VideoInfo | null,
): MatchEvent[] {
  // the game's own team names first ("HIFK"), the book as a fallback
  const teamName = (teamId: string) => (teamId === g.home.teamId ? g.home.name : teamId === g.away.teamId ? g.away.name : book.ref(teamId).name);
  const deltaByGoal = new Map(timeline.filter((p) => p.goalId).map((p) => [p.goalId!, Math.round(p.delta * 100)]));
  const goals: (MatchEvent & { t: number })[] = g.goals.map((goal) => {
    const kinds = describeGoalTypes(goal.types).labels;
    const title = `Goal ${goal.homeScore}–${goal.awayScore} · ${teamName(goal.teamId)}`;
    return {
      t: goal.gameTime,
      id: goal.id,
      kind: "goal",
      time: clockIn(goal.gameTime, goal.period),
      period: periodName(goal.period),
      title,
      detail: [goal.scorer ?? "Unknown scorer", ...kinds].join(" · "),
      effect: deltaByGoal.get(goal.id) ?? null,
      video: clipOf(goal, `${title}${goal.scorer ? ` · ${goal.scorer}` : ""}`),
    };
  });
  const penalties: (MatchEvent & { t: number })[] = g.penalties
    .filter((p) => p.minutes > 0)
    .map((p) => ({
      t: p.gameTime,
      id: p.id,
      kind: "penalty",
      time: clockIn(p.gameTime, p.period),
      period: periodName(p.period),
      title: `Penalty ${p.minutes} min · ${teamName(p.teamId)}`,
      detail: [p.playerId ? names.get(p.playerId) : null, p.fault].filter(Boolean).join(" · ") || "—",
      effect: null,
      video: null,
    }));
  return [...goals, ...penalties].sort((a, b) => b.t - a.t).map(({ t: _t, ...e }) => e);
}

/** the six tiles; anything the feed can't give yet is null and shows "Data pending" */
export function statsOf(s: LiigaGameStats | null): MatchStat[] {
  const pair = (v: [number, number] | null | undefined) => ({ home: v?.[0] ?? null, away: v?.[1] ?? null });
  const pp = s?.powerPlay;
  return [
    { id: "shots", label: "Shots on goal", ...pair(s?.shots) },
    { id: "blocked", label: "Blocked shots", ...pair(s?.blockedShots) },
    { id: "faceoffs", label: "Faceoffs won", unit: "%", ...pair(s?.faceoffs) },
    { id: "pim", label: "Penalty minutes", ...pair(s?.penaltyMinutes) },
    {
      id: "pp",
      label: "Power play goals",
      home: pp ? pp.home.goals : null,
      away: pp ? pp.away.goals : null,
      display: pp ? [`${pp.home.goals} of ${pp.home.instances}`, `${pp.away.goals} of ${pp.away.instances}`] : null,
    },
    { id: "momentum", label: "Time with the puck", unit: "%", ...pair(s?.momentum) },
  ];
}

export const lineupsOf = (l: LiigaLineups | null) => (l && (l.home.length || l.away.length) ? l : null);
