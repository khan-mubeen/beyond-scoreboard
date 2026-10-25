// the page for a game that hasn't started: teams, when it starts (a countdown), what the game is
// worth (with what if?), this season's head-to-head, and reminder / follow. no video, no your
// call!, no discussion, no watch together: those open when the game (or its rotation lobby) starts
import { liigaGameUrl, type LiigaGame } from "@/features/liiga";
import { phaseOf } from "@/features/live/server";
import type { SeasonContext } from "@/features/stakes/server";
import { demoMode, leagueNow } from "@/shared/clock";
import { getDb } from "@/shared/db";
import type { ApiMeta, DataSource, HeadToHeadGame, PreviewMatchDetail } from "@/shared/types";
import type { GameStakes } from "./game-stakes";
import type { Viewer } from "./identity";
import { shortDate } from "./labels";
import { chips, emptyStakes, seasonStakesCard, withMetrics, type Side } from "./match";
import { summaryOf } from "./match-parts";
import type { TeamBook } from "./teams";
import { whatIfOptions } from "./whatif";

/** when it starts on the clock fans see: a rotation match's next lobby, else the real start (not in demo mode, whose league clock stands still) */
function startsAt(g: LiigaGame, now: number): number | undefined {
  const rot = phaseOf(g.id, now);
  if (rot) {
    const slots = rot.r.slots;
    const cycle = slots[slots.length - 1].endsAt - slots[0].lobbyAt;
    return rot.slot.lobbyAt > now ? rot.slot.lobbyAt : rot.slot.lobbyAt + cycle;
  }
  return demoMode() ? undefined : Date.parse(g.start);
}

/** this season's games between the two teams, as of the league clock */
export function headToHead(ctx: SeasonContext, g: LiigaGame, book: TeamBook): PreviewMatchDetail["headToHead"] {
  const pair = new Set([g.home.teamId, g.away.teamId]);
  const games: HeadToHeadGame[] = ctx.schedule
    .filter((f) => f.status === "final" && f.id !== g.id && pair.has(f.homeTeamId) && pair.has(f.awayTeamId) && f.homeGoals !== null && f.awayGoals !== null)
    .sort((a, b) => b.start.localeCompare(a.start))
    .map((f) => ({
      matchId: f.id,
      date: shortDate(new Date(f.start)),
      home: book.ref(f.homeTeamId, f.homeName),
      away: book.ref(f.awayTeamId, f.awayName),
      score: { home: f.homeGoals!, away: f.awayGoals! },
      extra: f.decidedIn === "overtime" ? " OT" : f.decidedIn === "shootout" ? " SO" : "",
    }));
  if (!games.length) return { games, summary: "First meeting this season." };
  const wins = (teamId: string) => games.filter((x) => (x.home.id === teamId ? x.score.home > x.score.away : x.away.id === teamId && x.score.away > x.score.home)).length;
  const [h, a] = [wins(g.home.teamId), wins(g.away.teamId)];
  const name = (id: string) => book.ref(id).name;
  const summary = h === a ? `Level at ${h}–${a} this season.` : `${name(h > a ? g.home.teamId : g.away.teamId)} lead ${Math.max(h, a)}–${Math.min(h, a)} this season.`;
  return { games, summary };
}

export async function previewDetail(a: {
  g: LiigaGame;
  s: GameStakes | null;
  side: Side;
  ctx: SeasonContext;
  book: TeamBook;
  viewer: Viewer;
  source: DataSource;
}): Promise<PreviewMatchDetail & ApiMeta> {
  const { g, s, side, ctx, book, viewer } = a;
  const now = Date.now();
  const match = summaryOf(g, book, leagueNow());
  const at = startsAt(g, now);
  if (at !== undefined) Object.assign(match, { startsAt: at });
  const reminders = viewer.user ? await getDb().reminders.listForUser(viewer.user.id) : [];
  return {
    id: g.id,
    status: "preview",
    breadcrumbs: [{ label: "Sports", href: "/sports" }, { label: "Ice Hockey", href: "/sports" }, { label: "Liiga", href: "/sports" }, { label: `${g.home.name} – ${g.away.name}` }],
    match,
    venue: g.rink ?? "",
    dateLabel: shortDate(new Date(g.start)),
    stakesSummary: chips(s, g, book),
    seasonStakes: s ? { ...seasonStakesCard(s, g, side, book), whatIf: withMetrics(await whatIfOptions(ctx, g.id), s, g) } : emptyStakes(g[side].name),
    headToHead: headToHead(ctx, g, book),
    reminder: reminders.includes(g.id),
    liigaUrl: liigaGameUrl(g),
    asOf: new Date().toISOString(),
    source: a.source,
  };
}
