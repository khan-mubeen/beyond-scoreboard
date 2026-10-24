// what the live engine broadcasts, in ui shapes: built from the same pieces as the match page,
// so a realtime update and a page load always agree
import { liigaGameUrl, type LiigaGame } from "@/features/liiga";
import { roomScope, type CallDraft, type MatchRenderer } from "@/features/live/server";
import { getSeasonContext, ifEndsNow } from "@/features/stakes/server";
import { whatItMeansText } from "@/features/story/server";
import { checkText } from "@/shared/guardrails";
import { gameStakes, timelineFor } from "./game-stakes";
import { clockIn, pct, periodName, whenLabel } from "./labels";
import { chips, emptyStakes, factsFor, seasonStakesCard, stakesSide } from "./match";
import { clipOf } from "./highlight";
import { eventsOf, periodScoresOf } from "./match-parts";
import { triviaFor } from "./ask";
import { boardRows, partyStandings } from "./presence";
import { postLine } from "./social";
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
        whatItMeans: whatItMeansText(factsFor(game, s, side, book)),
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
    if (!s) return null;
    const metrics = ["playoffs", "relegation"] as const;
    const swing = (x: "home" | "away", m: (typeof metrics)[number]) => Math.abs(s.worth[x].regulationWin[m] - s.worth[x].regulationLoss[m]);
    const fav = stakesSide(game);
    const { side, metric } = (["home", "away"] as const)
      .flatMap((x) => metrics.map((m) => ({ side: x, metric: m, swing: swing(x, m) + (x === fav ? 1e-6 : 0) })))
      .reduce((a, b) => (b.swing > a.swing ? b : a));
    const team = game[side].name;
    const worth = s.worth[side];
    const noun = metric === "playoffs" ? "playoff chance" : "relegation chance";
    const own = (sc: { home: number; away: number }) => (side === "home" ? sc.home : sc.away);
    const opp = (sc: { home: number; away: number }) => (side === "home" ? sc.away : sc.home);
    const score = { home: game.home.goals, away: game.away.goals };
    const now = ifEndsNow(worth, own(score), opp(score), s.otRate[side])[metric];
    const goalLine = (scorer: "home" | "away") => {
      const next = { home: score.home + (scorer === "home" ? 1 : 0), away: score.away + (scorer === "away" ? 1 : 0) };
      const after = pct(ifEndsNow(worth, own(next), opp(next), s.otRate[side])[metric]);
      // compared as shown: 99% -> 99% is "keep", not "lift"
      const verb = after > pct(now) ? (metric === "playoffs" ? "lift" : "raise") : after < pct(now) ? (metric === "playoffs" ? "drop" : "cut") : "keep";
      const name = game[scorer].name;
      // "an Ilves goal", "an HIFK goal" (said aitch-I-F-K)
      const article = /^([AEIOUÄÖ]|H[A-Z]{2})/.test(name) ? "An" : "A";
      return `${article} ${name} goal now would ${verb} ${team}'s ${noun} ${verb === "keep" ? "at" : "to"} ${after}%.`;
    };
    let line: string;
    switch (draft.rule.kind) {
      case "who_wins":
        line =
          metric === "playoffs"
            ? `A regulation win would take ${team} to a ${pct(worth.regulationWin.playoffs)}% playoff chance (${pct(worth.regulationLoss.playoffs)}% with a loss).`
            : `A regulation loss would leave ${team} with a ${pct(worth.regulationLoss.relegation)}% relegation chance (${pct(worth.regulationWin.relegation)}% with a win).`;
        break;
      case "overtime": {
        const ot = worth.overtimeWin[metric] * s.otRate[side] + worth.overtimeLoss[metric] * (1 - s.otRate[side]);
        line = `Overtime would put ${team}'s ${noun} at ${pct(ot)}%.`;
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
