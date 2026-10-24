// site server api. server only: never import this from browser code (lint enforces it).
// the http handlers are in ./routes/site.ts (mounted by server/api.ts)
import { parseMatchId } from "@/features/liiga";
import { getGame } from "@/features/liiga/server";
import { getSeasonContext } from "@/features/stakes/server";
import type { MatchFactsInput } from "@/features/story/server";
import { gameStakes } from "./game-stakes";
import { factsFor, nextGame, stakesSide } from "./match";
import { teamBook } from "./teams";

export { homePage } from "./home";
export { matchDetail } from "./match";
export { rewardsPage } from "./rewards";

/**
 * the facts the texts for a match may use, from its stakes team's point of view, with its next
 * game (npm run pregen). the game is read unmasked: in demo mode a rotation match is "not played
 * yet" on the league clock, but its summary is written ahead of its summary phase
 */
export async function matchFactsFor(matchId: string): Promise<{ facts: MatchFactsInput; summaryFacts: MatchFactsInput; teamId: string; status: string } | null> {
  const ids = parseMatchId(matchId);
  if (!ids) return null;
  const res = await getGame(ids.season, ids.gameId, { unmasked: true }).catch(() => null);
  if (!res) return null;
  const g = res.data.game;
  const [ctx, book] = await Promise.all([getSeasonContext(), teamBook()]);
  const fixture = ctx.schedule.find((f) => f.id === g.id);
  const s = fixture ? gameStakes(ctx, fixture) : null;
  const side = stakesSide(g);
  const next = await nextGame(g, side, ctx, book);
  // exactly what the page uses: the story's facts, and the summary's (which add the next game)
  return { facts: factsFor(g, s, side, book), summaryFacts: factsFor(g, s, side, book, next), teamId: g[side].teamId, status: g.status };
}
