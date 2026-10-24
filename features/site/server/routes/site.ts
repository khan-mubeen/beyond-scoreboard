// /api/site/*: every request validated with zod, every response carries asOf and source
import { timingSafeEqual } from "node:crypto";
import { Router, type NextFunction, type Request, type RequestHandler, type Response } from "express";
import { z } from "zod";
import { findGamblingFields } from "@/features/liiga";
import { getStandings, getSeason } from "@/features/liiga/server";
import { answerCall, controlReplay, controlRotation, engineMatch, publish, refreshRotation } from "@/features/live/server";
import { forecastNow, getSeasonContext } from "@/features/stakes/server";
import { demoMode, leagueNow } from "@/shared/clock";
import { getDb } from "@/shared/db";
import { engineTable, homePage } from "../home";
import { rotationInfo } from "../rotation";
import { teamBook } from "../teams";
import { ensureUser, viewerOf } from "../identity";
import { leaderboardPage } from "../leaderboard";
import { matchDetail } from "../match";
import { mePage } from "../me";
import { markRead, notificationsFor } from "../notifications";
import { viewerSummary } from "../points";
import { myCalls, profilePage } from "../profile";
import { rewardsPage } from "../rewards";
import { teamPage, teamsPage } from "../teams-page";
import { joinMatch, postComment, recentComments } from "../social";
import { liveStateFor } from "../state";
import { allowWhatIf, WHAT_IF_MAX, whatIf, WhatIfError } from "../whatif";

const matchId = z.string().regex(/^\d{4}-\d+$/, "match ids look like 2027-2701404");
const nickname = z.string().trim().min(1).max(24);

const schemas = {
  home: z.object({ team: z.string().max(40).optional(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }),
  join: z.object({ nickname: nickname.optional(), roomCode: z.string().regex(/^[A-Z]{4}$/).optional(), bot: z.boolean().optional() }),
  read: z.object({ id: z.string().uuid().optional() }),
  leaderboard: z.object({ scope: z.enum(["weekly", "season", "room"]).default("weekly") }),
  answer: z.object({ optionId: z.string().min(1).max(40) }),
  comment: z.object({ text: z.string().max(400) }),
  reminder: z.object({ matchId, on: z.boolean().default(true) }),
  standings: z.object({ live: z.enum(["true", "false"]).default("true") }),
  control: z.object({ action: z.enum(["start", "pause", "resume", "skip", "reset"]) }),
  rotation: z.object({ action: z.enum(["restart", "skip", "pause", "resume"]) }),
  favorite: z.object({ teamId: z.string().regex(/^\d+:[\p{L}\p{N}-]+$/u, "a liiga team id"), on: z.boolean() }),
  calls: z.object({ view: z.enum(["recent", "history"]).default("recent"), match: matchId.optional() }),
  whatIf: z.object({
    matchId,
    overrides: z
      .array(z.object({ gameId: matchId, outcome: z.enum(["regulationWin", "overtimeWin", "overtimeLoss", "regulationLoss"]) }))
      .max(WHAT_IF_MAX, `at most ${WHAT_IF_MAX} results`),
  }),
  settings: z.object({
    nickname: nickname.optional(),
    language: z.enum(["en", "fi"]).optional(),
    notificationPrefs: z.object({ callResults: z.boolean(), favoriteReminders: z.boolean(), favoriteResults: z.boolean() }).optional(),
  }),
};

const asOfNow = () => ({ asOf: new Date().toISOString(), source: "db" as const });

/** async handler with zod errors -> 400 and liiga outages -> 503 */
const handle =
  (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  async (req, res, next: NextFunction) => {
    try {
      const body = await fn(req, res);
      if (body === undefined || res.headersSent) return;
      // last line of defence: no betting data ever leaves the api
      const leaked = findGamblingFields(body);
      if (leaked.length) throw new Error(`refusing to send betting fields: ${leaked.join(", ")}`);
      res.json(body);
    } catch (err) {
      if (err instanceof z.ZodError) return void res.status(400).json({ error: err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") });
      if (/no snapshot|not reachable/i.test((err as Error).message)) return void res.status(503).json({ error: "liiga data unavailable" });
      next(err);
    }
  };

export const siteRouter = Router();

siteRouter.get(
  "/home",
  handle(async (req, res) => homePage(await viewerOf(req, res), schemas.home.parse(req.query))),
);

siteRouter.get(
  "/me",
  handle(async (req, res) => mePage(await viewerOf(req, res))),
);

siteRouter.post(
  "/settings",
  handle(async (req, res) => {
    const body = schemas.settings.parse(req.body ?? {});
    const v = await viewerOf(req, res);
    const user = await ensureUser(v, body.nickname);
    v.user = await getDb().users.update(user.id, { ...(body.language && { language: body.language }), ...(body.notificationPrefs && { notificationPrefs: body.notificationPrefs }) });
    return mePage(v);
  }),
);

/** "reset my demo profile": the fan and everything of theirs goes; the next visit is a new guest */
siteRouter.post(
  "/me/reset",
  handle(async (req, res) => {
    const v = await viewerOf(req, res);
    if (v.user) await getDb().users.remove(v.user.id);
    res.clearCookie("ks_anon");
    return { ok: true, ...asOfNow() };
  }),
);

siteRouter.get(
  "/teams",
  handle(async (req, res) => teamsPage(await viewerOf(req, res))),
);

siteRouter.get(
  "/teams/:slug",
  handle(async (req, res) => {
    const slug = z.string().min(2).max(40).parse(req.params.slug);
    const page = await teamPage(await viewerOf(req, res), slug);
    if (!page) return void res.status(404).json({ error: "team not found" });
    return page;
  }),
);

siteRouter.post(
  "/favorites",
  handle(async (req, res) => {
    const { teamId, on } = schemas.favorite.parse(req.body ?? {});
    const v = await viewerOf(req, res);
    const user = await ensureUser(v);
    await getDb().favorites.set(user.id, teamId, on);
    return { follows: await getDb().favorites.list(user.id), ...asOfNow() };
  }),
);

siteRouter.get(
  "/profile",
  handle(async (req, res) => profilePage(await viewerOf(req, res))),
);

siteRouter.get(
  "/calls",
  handle(async (req, res) => {
    const { view, match } = schemas.calls.parse(req.query);
    return myCalls(await viewerOf(req, res), view, match);
  }),
);

siteRouter.get(
  "/notifications",
  handle(async (req, res) => notificationsFor(await viewerOf(req, res))),
);

siteRouter.post(
  "/notifications/read",
  handle(async (req, res) => {
    const { id } = schemas.read.parse(req.body ?? {});
    const v = await viewerOf(req, res);
    await markRead(v, id);
    return notificationsFor(v);
  }),
);

siteRouter.get(
  "/leaderboard",
  handle(async (req, res) => {
    const { scope } = schemas.leaderboard.parse(req.query);
    return leaderboardPage(await viewerOf(req, res), scope);
  }),
);

siteRouter.get(
  "/matches/:id",
  handle(async (req, res) => {
    const id = matchId.parse(req.params.id);
    const detail = await matchDetail(id, await viewerOf(req, res));
    if (!detail) return void res.status(404).json({ error: "match not found" });
    return detail;
  }),
);

siteRouter.get(
  "/matches/:id/state",
  handle(async (req, res) => {
    const id = matchId.parse(req.params.id);
    const v = await viewerOf(req, res);
    // ?player= is accepted for older clients; the cookie decides who "me" is
    const state = await liveStateFor(id, v.user);
    if (!state) return void res.status(404).json({ error: "match not found" });
    return { ...state, asOf: new Date(state.serverNow).toISOString(), source: state.isReplay ? "snapshot" : "live" };
  }),
);

siteRouter.post(
  "/matches/:id/join",
  handle(async (req, res) => {
    const id = matchId.parse(req.params.id);
    const body = schemas.join.parse(req.body ?? {});
    if (body.bot && !isHost(req)) return void res.status(403).json({ error: "only the host can add fake players" });
    const v = await viewerOf(req, res);
    const user = await ensureUser(v, body.nickname, !!body.bot);
    const room = await joinMatch(id, user.id, body.roomCode);
    if (!room) return void res.status(404).json({ error: "room not found" });
    return { user: await viewerSummary(user), nickname: user.nickname, room: { code: room.code, matchId: room.matchId }, ...asOfNow() };
  }),
);

/** constant-time token check; no HOST_TOKEN means host controls are off */
function isHost(req: Request): boolean {
  const want = process.env.HOST_TOKEN;
  const got = req.get("x-host-token");
  if (!want || !got) return false;
  const [a, b] = [Buffer.from(want), Buffer.from(got)];
  return a.length === b.length && timingSafeEqual(a, b);
}

siteRouter.post(
  "/matches/:id/control",
  handle(async (req, res) => {
    const id = matchId.parse(req.params.id);
    if (!process.env.HOST_TOKEN) return void res.status(503).json({ error: "host controls are off (set HOST_TOKEN)" });
    if (!isHost(req)) return void res.status(403).json({ error: "wrong host token" });
    const { action } = schemas.control.parse(req.body ?? {});
    const problem = await controlReplay(id, action);
    if (problem) return void res.status(409).json({ error: problem });
    const state = engineMatch(id)?.state;
    return { ok: true, action, gameTime: state?.clock.gameTime ?? 0, status: state?.status ?? null, ...asOfNow() };
  }),
);

siteRouter.post(
  "/calls/:callId/answer",
  handle(async (req, res) => {
    const callId = z.string().uuid().parse(req.params.callId);
    const { optionId } = schemas.answer.parse(req.body ?? {});
    const v = await viewerOf(req, res);
    const user = await ensureUser(v);
    const result = await answerCall(callId, user.id, optionId);
    if (result.status !== 201) return void res.status(result.status).json({ error: result.error });
    res.status(201);
    return { ok: true, callId, optionId, ...asOfNow() };
  }),
);

siteRouter.get(
  "/matches/:id/comments",
  handle(async (req) => {
    const id = matchId.parse(req.params.id);
    return { comments: await recentComments(id), ...asOfNow() };
  }),
);

siteRouter.post(
  "/matches/:id/comments",
  handle(async (req, res) => {
    const id = matchId.parse(req.params.id);
    const { text } = schemas.comment.parse(req.body ?? {});
    const v = await viewerOf(req, res);
    if (!v.user?.nickname) return void res.status(401).json({ error: "pick a nickname first" });
    const result = await postComment(id, v.user.id, text);
    if ("error" in result) return void res.status(result.status).json({ error: result.error });
    void publish(id, [{ event: "comment", payload: { comment: result } }]);
    res.status(201);
    return { comment: result, ...asOfNow() };
  }),
);

siteRouter.post(
  "/comments/:id/like",
  handle(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const v = await viewerOf(req, res);
    const user = await ensureUser(v);
    const db = getDb();
    if (!(await db.comments.get(id))) return void res.status(404).json({ error: "comment not found" });
    const r = await db.comments.like(id, user.id);
    if (r === "duplicate") return void res.status(409).json({ error: "already liked" });
    res.status(201);
    return { ok: true, ...asOfNow() };
  }),
);

siteRouter.post(
  "/reminders",
  handle(async (req, res) => {
    const { matchId: id, on } = schemas.reminder.parse(req.body ?? {});
    const v = await viewerOf(req, res);
    const user = await ensureUser(v);
    if (on) await getDb().reminders.set(user.id, id);
    else await getDb().reminders.remove(user.id, id);
    return { matchId: id, on, reminders: await getDb().reminders.listForUser(user.id), ...asOfNow() };
  }),
);

siteRouter.get(
  "/reminders",
  handle(async (req, res) => {
    const v = await viewerOf(req, res);
    return { reminders: v.user ? await getDb().reminders.listForUser(v.user.id) : [], ...asOfNow() };
  }),
);

/** "what if?" on the season stakes card: set results, see the playoff race */
siteRouter.post(
  "/whatif",
  handle(async (req, res) => {
    const body = schemas.whatIf.parse(req.body ?? {});
    // per fan, not per ip: a venue's phones share one address
    if (!allowWhatIf((await viewerOf(req, res)).anonId)) return void res.status(429).json({ error: "too many what-ifs, try again in a minute" });
    try {
      return await whatIf(body.matchId, body.overrides);
    } catch (err) {
      if (err instanceof WhatIfError) return void res.status(400).json({ error: err.message });
      throw err;
    }
  }),
);

siteRouter.get(
  "/standings",
  handle(async (req) => {
    const { live } = schemas.standings.parse(req.query);
    // demo mode: our table as of the demo clock; the api's already counts later games
    if (demoMode()) {
      const ctx = await getSeasonContext();
      const table = engineTable(forecastNow(ctx, []).world.table, "", await teamBook());
      return { rows: table.rows, asOf: leagueNow().toISOString(), source: ctx.source };
    }
    const s = await getStandings(await getSeason(), live === "true");
    return { ...s.data, asOf: s.asOf, source: s.source };
  }),
);

siteRouter.get(
  "/rotation",
  handle(async (_req, res) => rotationInfo() ?? void res.status(404).json({ error: "the demo rotation is off (DEMO_MODE)" })),
);

siteRouter.post(
  "/rotation/control",
  handle(async (req, res) => {
    if (!process.env.HOST_TOKEN) return void res.status(503).json({ error: "host controls are off (set HOST_TOKEN)" });
    if (!isHost(req)) return void res.status(403).json({ error: "wrong host token" });
    const { action } = schemas.rotation.parse(req.body ?? {});
    if (!(await controlRotation(action))) return void res.status(409).json({ error: "the demo rotation is off (DEMO_MODE)" });
    await refreshRotation();
    return rotationInfo();
  }),
);

siteRouter.get(
  "/rewards",
  handle(async () => rewardsPage()),
);

siteRouter.use((_req, res) => {
  res.status(404).json({ error: "not found" });
});
