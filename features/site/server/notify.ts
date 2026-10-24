// notifications about the teams a fan follows and the matches they set a reminder for, made when
// the bell asks (no background job), on the league clock and the fan's preferences, deduped so
// each one happens once (per cycle for a demo rotation match):
//   a followed team plays within 24 h · a followed team's game is live · its final result and what
//   it meant · a reminded match has started
import { engineMatch, phaseOf, rotationNow } from "@/features/live/server";
import { helsinkiDate, leagueNow } from "@/shared/clock";
import { getDb, type DbNotification, type DbUser } from "@/shared/db";
import { followedIds } from "./favorites";
import { chanceNow, gameStakes } from "./game-stakes";
import { pct, timeLabel } from "./labels";
import { teamsWorld } from "./teams-data";

type NewNote = Omit<DbNotification, "id" | "createdAt" | "readAt">;
const DAY = 24 * 3600 * 1000;

export async function makeNotifications(user: DbUser): Promise<void> {
  const db = getDb();
  const prefs = user.notificationPrefs;
  const [follows, reminders] = await Promise.all([followedIds(user), db.reminders.listForUser(user.id)]);
  if (!follows.length && !reminders.length) return;
  const w = await teamsWorld(follows);
  const now = leagueNow();
  const cycle = rotationNow()?.cycleKey ?? "";
  const out: NewNote[] = [];
  const note = (type: string, title: string, body: string, matchId: string, key: string) =>
    out.push({ userId: user.id, type, title, body, link: `/match/${matchId}`, dedupeKey: `${key}:${user.id}:${matchId}` });
  /** a game's state now: a rotation match's phase, the engine's live game, or the (masked) schedule */
  const stateOf = (matchId: string, start: string): "upcoming" | "live" | "final" => {
    const p = phaseOf(matchId);
    if (p) return p.phase === "live" ? "live" : p.phase === "summary" ? "final" : "upcoming";
    const g = engineMatch(matchId)?.visible;
    if (g?.status === "live") return "live";
    const f = w.ctx.schedule.find((x) => x.id === matchId);
    return f?.status === "final" ? "final" : Date.parse(start) <= now.getTime() ? "live" : "upcoming";
  };

  for (const teamId of follows) {
    const item = w.items.find((i) => i.team.id === teamId);
    if (!item) continue;
    const name = item.team.name;
    // its games around the league clock: the next one, and any played in the last day
    const games = w.ctx.schedule.filter((f) => (f.homeTeamId === teamId || f.awayTeamId === teamId) && Math.abs(Date.parse(f.start) - now.getTime()) <= DAY);
    for (const f of games) {
      const state = stateOf(f.id, f.start);
      const rot = phaseOf(f.id) ? `:${cycle}` : "";
      const vs = f.homeTeamId === teamId ? f.awayName : f.homeName;
      if (state === "upcoming" && prefs.favoriteReminders && Date.parse(f.start) > now.getTime()) {
        const day = helsinkiDate(new Date(f.start)) === helsinkiDate(now) ? "today" : "tomorrow";
        const worth = item.next?.matchId === f.id ? item.next.worth : null;
        note("favorite_soon", `${name} play ${day} ${timeLabel(new Date(f.start))}`, [`vs ${vs}`, worth].filter(Boolean).join(" · "), f.id, "fav-soon");
      }
      if (state === "live" && prefs.favoriteReminders) note("favorite_live", `${name} are live now`, `vs ${vs} · Call It! is on`, f.id, `fav-live${rot}`);
      if (state === "final" && prefs.favoriteResults) {
        // the result as the page shows it, and what it did to the playoff chance
        const g = engineMatch(f.id)?.visible;
        const homeGoals = g?.status === "final" ? g.home.goals : f.homeGoals;
        const awayGoals = g?.status === "final" ? g.away.goals : f.awayGoals;
        if (homeGoals === null || awayGoals === null) continue;
        const own = f.homeTeamId === teamId ? homeGoals : awayGoals;
        const other = f.homeTeamId === teamId ? awayGoals : homeGoals;
        const s = gameStakes(w.ctx, f);
        const side = f.homeTeamId === teamId ? "home" : "away";
        const meant = s && g?.status === "final" ? ` · Playoff chance ${pct(s.baseline[side].playoffs)}% → ${pct(chanceNow(s, side, g).playoffs)}%` : "";
        note("favorite_result", `${name} ${own > other ? "won" : "lost"} ${own}–${other}`, `vs ${vs}${meant}`, f.id, `fav-final${rot}`);
      }
    }
  }

  if (prefs.favoriteReminders) {
    for (const matchId of reminders) {
      const f = w.ctx.schedule.find((x) => x.id === matchId);
      if (!f || stateOf(matchId, f.start) !== "live") continue;
      const rot = phaseOf(matchId) ? `:${cycle}` : "";
      note("reminder", `${w.book.ref(f.homeTeamId, f.homeName).name} – ${w.book.ref(f.awayTeamId, f.awayName).name} has started`, "Your reminder · Call It! is on", matchId, `reminder${rot}`);
    }
  }
  if (out.length) await db.notifications.create(out);
}
