// what the live engine broadcasts, in ui shapes: built from the same pieces as the match page,
// so a realtime update and a page load always agree
import { liigaGameUrl, type LiigaGame } from "@/features/liiga";
import { roomScope, type CallDraft, type MatchRenderer } from "@/features/live/server";
import { getSeasonContext } from "@/features/stakes/server";
import { whatItMeansText } from "@/features/story/server";
import { gameStakes, timelineFor } from "./game-stakes";
import { clockIn, periodName, whenLabel } from "./labels";
import { chips, emptyStakes, meaningFacts, seasonStakesCard, stakesSide } from "./match";
import { clipOf } from "./highlight";
import { eventsOf, periodScoresOf } from "./match-parts";
import { triviaFor } from "./ask";
import { boardRows, partyStandings } from "./presence";
import { postLine } from "./social";
import { stakesLineFor } from "./stakes-line";
import { teamBook } from "./teams";

async function stakesFor(game: LiigaGame) {
  const ctx = await getSeasonContext();
  // the schedule's status picks the forecast: a replayed final is judged as the season stood then
  const fixture = ctx.schedule.find((f) => f.id === game.id);
  return fixture ? gameStakes(ctx, fixture) : null;
}

const roomScopeCycle = (matchId: string) => roomScope(matchId).cycle;

export const siteRenderer: MatchRenderer = {
  async render(_matchId, game, names) {
    const [s, book] = await Promise.all([stakesFor(game), teamBook()]);
    const side = stakesSide(game);
    const timeline = s ? timelineFor(s, side, game) : [];
    return {
      stakes: {
        chips: chips(s, game, book),
        seasonStakes: s ? seasonStakesCard(s, game, side, book) : emptyStakes(game[side].name),
        whatItMeans: whatItMeansText(meaningFacts(game, s, side, book)),
      },
      // broadcast to everyone: our highlight's url only once the match is over (free highlights)
      events: eventsOf(game, names, timeline, book, clipOf(_matchId, liigaGameUrl(game), game.status === "final")),
      periodScores: game.status === "scheduled" ? [] : periodScoresOf(game),
    };
  },

  clock(game) {
    const period = game.currentPeriod ?? 1;
    return game.status === "live"
      ? { label: periodName(period), clock: clockIn(game.gameTime, period) }
      : { label: game.status === "final" ? "Final" : whenLabel(game.start, new Date()), clock: "" };
  },

  /**
   * "A Kärpät goal now would lift their playoff chance to 66%" and friends, for whichever team and
   * chance (playoff or relegation) this game moves the most: a 0% playoff chance says nothing
   */
  async stakesLine(_matchId, game, draft: CallDraft) {
    const s = await stakesFor(game);
    return s ? stakesLineFor(s, game, draft.rule, stakesSide(game)) : null;
  },

  // the party as everyone sees it (broadcast: each page marks "you" itself)
  async leaderboard(matchId) {
    const p = await partyStandings(matchId);
    return { rows: boardRows(p), watching: p.watching, members: p.members };
  },

  goalLine(game, goal) {
    return `GOAL! ${game[goal.side].name} ${goal.homeScore}–${goal.awayScore} · ${clockIn(goal.gameTime, goal.period)}`;
  },

  async post(matchId, cycle, line) {
    return (await postLine(matchId, cycle, line)) as unknown as Record<string, unknown> | null;
  },

  async trivia(matchId, _game, n) {
    const q = await triviaFor(matchId, `${matchId}:${roomScopeCycle(matchId)}`, n);
    return q && { question: q.question, options: q.options, answer: q.answer, fi: q.fi };
  },
};
