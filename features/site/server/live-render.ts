// what the live engine broadcasts, in ui shapes: built from the same pieces as the match page,
// so a realtime update and a page load always agree
import type { LiigaGame } from "@/features/liiga";
import type { CallDraft, MatchRenderer } from "@/features/live/server";
import { getSeasonContext, ifEndsNow } from "@/features/stakes/server";
import { whatItMeansText } from "@/features/story/server";
import { checkText } from "@/shared/guardrails";
import { gameStakes, timelineFor } from "./game-stakes";
import { clockIn, pct, periodName, whenLabel } from "./labels";
import { chips, emptyStakes, factsFor, seasonStakesCard, stakesSide } from "./match";
import { eventsOf, periodScoresOf } from "./match-parts";
import { roomSummary } from "./social";
import { teamBook } from "./teams";

async function stakesFor(game: LiigaGame) {
  const ctx = await getSeasonContext();
  // the schedule's status picks the forecast: a replayed final is judged as the season stood then
  const fixture = ctx.schedule.find((f) => f.id === game.id);
  return fixture ? gameStakes(ctx, fixture) : null;
}

export const siteRenderer: MatchRenderer = {
  async render(_matchId, game, names) {
    const [s, book] = await Promise.all([stakesFor(game), teamBook()]);
    const side = stakesSide(game);
    const timeline = s ? timelineFor(s, side, game) : [];
    return {
      stakes: {
        chips: chips(s, game, book),
        seasonStakes: s ? seasonStakesCard(s, game, side, book) : emptyStakes(game[side].name),
        whatItMeans: whatItMeansText(factsFor(game, s, side, book)),
      },
      events: eventsOf(game, names, timeline, book),
      periodScores: game.status === "scheduled" ? [] : periodScoresOf(game),
    };
  },

  clock(game) {
    const period = game.currentPeriod ?? 1;
    return game.status === "live"
      ? { label: periodName(period), clock: clockIn(game.gameTime, period) }
      : { label: game.status === "final" ? "Final" : whenLabel(game.start, new Date()), clock: "" };
  },

  /** "A Kärpät goal now would lift their playoff chance to 66%" and friends */
  async stakesLine(_matchId, game, draft: CallDraft) {
    const s = await stakesFor(game);
    if (!s) return null;
    const side = stakesSide(game);
    const team = game[side].name;
    const worth = s.worth[side];
    const now = ifEndsNow(worth, side === "home" ? game.home.goals : game.away.goals, side === "home" ? game.away.goals : game.home.goals, s.otRate[side]).playoffs;
    const ifGoal = (scorer: "home" | "away") => {
      const score = { home: game.home.goals + (scorer === "home" ? 1 : 0), away: game.away.goals + (scorer === "away" ? 1 : 0) };
      return ifEndsNow(worth, side === "home" ? score.home : score.away, side === "home" ? score.away : score.home, s.otRate[side]).playoffs;
    };
    const goalLine = (scorer: "home" | "away") => {
      const after = ifGoal(scorer);
      const verb = after > now ? "lift" : after < now ? "drop" : "keep";
      return `A ${game[scorer].name} goal now would ${verb} ${team}'s playoff chance ${verb === "keep" ? "at" : "to"} ${pct(after)}%.`;
    };
    let line: string;
    switch (draft.rule.kind) {
      case "who_wins":
        line = `A regulation win would take ${team} to a ${pct(worth.regulationWin.playoffs)}% playoff chance.`;
        break;
      case "overtime": {
        const ot = worth.overtimeWin.playoffs * s.otRate[side] + worth.overtimeLoss.playoffs * (1 - s.otRate[side]);
        line = `Overtime would put ${team}'s playoff chance at ${pct(ot)}%.`;
        break;
      }
      case "power_play":
      case "answer_back":
        line = goalLine(draft.rule.side);
        break;
      default:
        line = goalLine(side);
    }
    return checkText(line).length ? null : line;
  },

  async leaderboard(matchId) {
    const room = await roomSummary(matchId, null, false, 0, 10);
    return { rows: room.leaderboard, watching: room.watching };
  },
};
