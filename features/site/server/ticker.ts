// GET /api/site/ticker: one line for the header on every sports page. the rotation's match while
// it runs (lobby, live, summary), else the next scheduled game, else nothing. the score and the
// open your call! question come from the match channel in the browser, not from here
import { liigaNow } from "@/features/liiga/server";
import { demoMode } from "@/shared/clock";
import { engineMatch, rotationNow } from "@/features/live/server";
import { getSeasonContext } from "@/features/stakes/server";
import type { ApiMeta, TickerData } from "@/shared/types";
import { whenLabel } from "./labels";
import { teamBook } from "./teams";

export async function tickerLine(): Promise<{ ticker: TickerData | null } & ApiMeta> {
  const now = liigaNow();
  const meta = { asOf: now.toISOString(), source: "config" as const };
  const [ctx, book] = await Promise.all([getSeasonContext(), teamBook()]);
  const fixture = (id: string) => ctx.schedule.find((f) => f.id === id);
  const followingOf = (id: string, startsAt: number): TickerData["following"] => {
    const f = fixture(id);
    if (!f || id === rotationNow()?.current.matchId) return null;
    return { matchId: id, home: book.ref(f.homeTeamId, f.homeName), away: book.ref(f.awayTeamId, f.awayName), startsAt, when: null };
  };

  const rot = rotationNow();
  if (rot) {
    const id = rot.current.matchId;
    const game = engineMatch(id)?.visible;
    const f = fixture(id);
    const homeId = game?.home.teamId ?? f?.homeTeamId;
    const awayId = game?.away.teamId ?? f?.awayTeamId;
    if (homeId && awayId) {
      return {
        ticker: {
          matchId: id,
          phase: rot.phase,
          home: book.ref(homeId, game?.home.name ?? f?.homeName),
          away: book.ref(awayId, game?.away.name ?? f?.awayName),
          score: game && rot.phase !== "lobby" ? { home: game.home.goals, away: game.away.goals } : null,
          when: null,
          startsAt: rot.phase === "lobby" ? rot.phaseEnd : null,
          following: followingOf(rot.next.matchId, rot.next.lobbyAt),
        },
        ...meta,
      };
    }
  }

  const iso = now.toISOString();
  const next = ctx.schedule
    .filter((f) => f.status === "scheduled" && f.start > iso)
    .sort((a, b) => a.start.localeCompare(b.start))[0];
  if (!next) return { ticker: null, ...meta };
  return {
    ticker: {
      matchId: next.id,
      phase: "next",
      home: book.ref(next.homeTeamId, next.homeName),
      away: book.ref(next.awayTeamId, next.awayName),
      score: null,
      // today just "18:30"; later "Tomorrow 18:30", "Thu 22 Oct 18:30"
      when: whenLabel(next.start, now).replace(/^Today /, ""),
      // the pinned demo clock stands still, so a countdown would never move: no countdown there
      startsAt: demoMode() ? null : Date.parse(next.start),
      following: null,
    },
    ...meta,
  };
}
