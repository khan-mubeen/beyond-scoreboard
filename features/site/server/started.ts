// has a match started, for the fan's purposes? a rotation match from its lobby (the "who wins?"
// question opens there) until its summary ends, any engine replay or live game, and otherwise
// whatever the (masked) feed says. a match that hasn't started is a preview: no state, no
// joining, no answers (409)
import { parseMatchId } from "@/features/liiga";
import { getGame } from "@/features/liiga/server";
import { engineMatch, phaseOf } from "@/features/live/server";

/** null: no such match */
export async function matchStarted(matchId: string): Promise<boolean | null> {
  const rot = phaseOf(matchId);
  if (rot) return rot.phase !== "idle";
  if (engineMatch(matchId)) return true;
  const ids = parseMatchId(matchId);
  if (!ids) return null;
  const res = await getGame(ids.season, ids.gameId).catch(() => null);
  return res ? res.data.game.status !== "scheduled" : null;
}

export const NOT_STARTED = { error: "the match hasn't started yet" };
