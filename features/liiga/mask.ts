// pure: a game the demo clock says hasn't been played yet looks exactly like an upcoming game.
// no score, no goals, no penalties, no totals, no video: nothing about its result can leak
import type { LiigaFixture, LiigaGame, LiigaGameSummary, LiigaPastAndFuture } from "./model";

export function unplayedGame(g: LiigaGame): LiigaGame {
  return {
    ...g,
    status: "scheduled",
    decidedIn: null,
    home: { ...g.home, goals: 0 },
    away: { ...g.away, goals: 0 },
    currentPeriod: null,
    gameTime: 0,
    periods: [],
    spectators: null,
    goals: [],
    penalties: [],
    powerPlay: null,
    video: null,
  };
}

export function unplayedFixture(f: LiigaFixture): LiigaFixture {
  return { ...f, status: "scheduled", decidedIn: null, homeGoals: null, awayGoals: null, xg: null };
}

/** past meetings only from before the demo date, future games without scores */
export function maskPastAndFuture(p: LiigaPastAndFuture, notPlayed: (start: string) => boolean): LiigaPastAndFuture {
  const hide = (g: LiigaGameSummary): LiigaGameSummary => (notPlayed(g.start) ? { ...g, homeGoals: 0, awayGoals: 0, extraTime: false, shootouts: false } : g);
  return {
    pastBetween: p.pastBetween.filter((g) => !notPlayed(g.start)),
    futureHome: p.futureHome.map(hide),
    futureAway: p.futureAway.map(hide),
  };
}
