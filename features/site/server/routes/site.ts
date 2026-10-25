// /api/site/*: every request validated with zod, every response carries asOf and source
import { timingSafeEqual } from "node:crypto";
import { Router, type NextFunction, type Request, type RequestHandler, type Response } from "express";
import { z } from "zod";
import { findGamblingFields } from "@/features/liiga";
import { getStandings, getSeason } from "@/features/liiga/server";
import { PREDICTION_TYPE } from "@/features/live";
import { answerCall, controlReplay, controlRotation, engineMatch, predictionClosed, publish, refreshRotation, roomScope } from "@/features/live/server";
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
import { askMatch } from "../ask";
import { acceptFriend, acceptInvite, addFriend, createInvite, FriendError, friendsPage, friendsWatching, inviteInfo, removeFriend, usePass } from "../friends";
import { postBurst, postComment, postFact, react, recentComments } from "../social";
import { publicBaseUrl, reportPublicUrl } from "../public-url";
import { answerCount, answerCountChanged, liveStateFor } from "../state";
import { allowWhatIf, WHAT_IF_MAX, whatIf, WhatIfError } from "../whatif";
import { heartbeat, leave, partyStandings } from "../presence";
import { matchStarted, NOT_STARTED } from "../started";
import { cancel, purchase, redeemOffer, WalletError } from "../wallet";
import { predict, predictionFor, PredictionError } from "../prediction";
import { breakdownFor } from "../breakdown";

const matchId = z.string().regex(/^\d{4}-\d+$/, "match ids look like 2027-2701404");
const nickname = z.string().trim().min(1).max(24);

const schemas = {
  home: z.object({ team: z.string().max(40).optional(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }),
  join: z.object({ nickname: nickname.optional(), roomCode: z.string().regex(/^[A-Z]{4}$/).optional(), bot: z.boolean().optional() }),
  read: z.object({ id: z.string().uuid().optional() }),
  leaderboard: z.object({ scope: z.enum(["weekly", "season", "room"]).default("weekly") }),
  breakdown: z.object({ scope: z.enum(["weekly", "season", "room"]).default("weekly"), user: z.string().uuid() }),
  answer: z.object({ optionId: z.string().min(1).max(40) }),
  comment: z.object({ text: z.string().max(400) }),
  ask: z.object({ text: z.string().trim().min(1).max(200) }),
  emoji: z.object({ emoji: z.string().min(1).max(8) }),
  friendCode: z.object({ code: z.string().trim().min(4).max(12) }),
  invite: z.object({ matchId: matchId.nullable().optional() }),
  inviteCode: z.string().regex(/^[A-Z0-9]{6,12}$/),
  accept: z.object({ nickname: nickname.optional() }),
  publicUrl: z.object({ url: z.string().url().max(200) }),
  reminder: z.object({ matchId, on: z.boolean().default(true) }),
  standings: z.object({ live: z.enum(["true", "false"]).default("true") }),
  control: z.object({ action: z.enum(["start", "pause", "resume", "skip", "reset"]) }),
  rotation: z.object({ action: z.enum(["restart", "skip", "pause", "resume"]) }),
  favorite: z.object({ teamId: z.string().regex(/^\d+:[\p{L}\p{N}-]+$/u, "a liiga team id"), on: z.boolean() }),
  calls: z.object({ view: z.enum(["recent", "history"]).default("recent"), match: matchId.optional() }),
  presence: z.object({ leave: z.boolean().default(false) }),
  purchase: z.object({
    planId: z.string().min(1).max(40),
    pointsToUse: z.number().int().min(0).max(1_000_000),
    idempotencyKey: z.string().min(8).max(100),
  }),
  cancel: z.object({ planId: z.string().min(1).max(40) }),
  offerId: z.string().regex(/^[a-z0-9-]{1,40}$/),
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
  handle(async (req, res) => mePage(await viewerOf(req, res), publicBaseUrl(req))),
);

siteRouter.post(
  "/settings",
  handle(async (req, res) => {
    const body = schemas.settings.parse(req.body ?? {});
    const v = await viewerOf(req, res);
    const user = await ensureUser(v, body.nickname);
    // only what changed; never answer with a guest because an update returned nothing
    const patch = { ...(body.language && { language: body.language }), ...(body.notificationPrefs && { notificationPrefs: body.notificationPrefs }) };
    v.user = (Object.keys(patch).length ? await getDb().users.update(user.id, patch) : null) ?? user;
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
    // tv mode (?tv=1) with the host's token always shows the live stream
    const detail = await matchDetail(id, await viewerOf(req, res), { host: req.query.tv === "1" && isHost(req) });
    if (!detail) return void res.status(404).json({ error: "match not found" });
    return detail;
  }),
);

siteRouter.get(
  "/matches/:id/state",
  handle(async (req, res) => {
    const id = matchId.parse(req.params.id);
    const started = await matchStarted(id);
    if (started === null) return void res.status(404).json({ error: "match not found" });
    if (!started) return void res.status(409).json(NOT_STARTED);
    const v = await viewerOf(req, res);
    // ?player= is accepted for older clients; the cookie decides who "me" is
    const state = await liveStateFor(id, v.user);
    if (!state) return void res.status(404).json({ error: "match not found" });
    return { ...state, asOf: new Date(state.serverNow).toISOString(), source: state.isReplay ? "snapshot" : "live" };
  }),
);

/**
 * the page is open (a heartbeat every 30 s while visible) or closed ({ leave: true }). opening a
 * match joins its party: a first-time visitor becomes a guest fan (a row, the welcome balance)
 */
siteRouter.post(
  "/matches/:id/presence",
  handle(async (req, res) => {
    const id = matchId.parse(req.params.id);
    const { leave: going } = schemas.presence.parse(req.body ?? {});
    const started = await matchStarted(id);
    if (started === null) return void res.status(404).json({ error: "match not found" });
    if (!started) return void res.status(409).json(NOT_STARTED);
    const v = await viewerOf(req, res);
    if (going) {
      if (v.user) await leave(id, v.user);
    } else {
      await heartbeat(id, await ensureUser(v));
    }
    const party = await partyStandings(id);
    return { watching: party.watching, userId: v.user?.id ?? null, party: { key: party.key, cycle: party.cycle }, ...asOfNow() };
  }),
);

siteRouter.post(
  "/matches/:id/join",
  handle(async (req, res) => {
    const id = matchId.parse(req.params.id);
    const body = schemas.join.parse(req.body ?? {});
    if (body.bot && !isHost(req)) return void res.status(403).json({ error: "only the host can add fake players" });
    const started = await matchStarted(id);
    if (started === null) return void res.status(404).json({ error: "match not found" });
    if (!started) return void res.status(409).json(NOT_STARTED);
    const v = await viewerOf(req, res);
    const user = await ensureUser(v, body.nickname, !!body.bot);
    // every fan on a match is in its one public party: an old room code (a qr from another
    // cycle, a typo) can't put anyone in a separate room. bots never count
    await heartbeat(id, user);
    const scope = roomScope(id);
    return { user: await viewerSummary(user), nickname: user.nickname, room: { code: "PARTY", matchId: id, cycle: scope.cycle }, ...asOfNow() };
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
    const call = await getDb().calls.get(callId);
    // the match prediction is made before the game (what if? on the preview page); every other call only during it
    if (call && call.type !== PREDICTION_TYPE && !(await matchStarted(call.matchId))) return void res.status(409).json(NOT_STARTED);
    if (call && predictionClosed(call)) return void res.status(409).json({ error: "this call is locked" });
    const v = await viewerOf(req, res);
    const user = await ensureUser(v);
    const result = await answerCall(callId, user.id, optionId);
    if (result.status !== 201) return void res.status(result.status).json({ error: result.error });
    // "8 of 12 have answered" for everyone at once (counts only; the leader's engine also sends it
    // every second, and pages keep the highest count, so the order of the two never matters)
    answerCountChanged(callId);
    if (call && call.type !== "trivia") void answerCount(callId).then((n) => publish(call.matchId, [{ event: "call_count", payload: { callId, answered: n, serverNow: Date.now() } }]));
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
    // a message starting with "?" asks the match instead (the fact card goes to the party)
    if (text.trim().startsWith("?")) return void res.redirect(307, `/api/site/matches/${id}/ask`);
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

/** the fan's one prediction for the match (the lobby's "who wins?"), made from what if? */
siteRouter.get(
  "/matches/:id/prediction",
  handle(
    predicting(async (req, res) => predictionFor(matchId.parse(req.params.id), await viewerOf(req, res))),
  ),
);

siteRouter.post(
  "/matches/:id/prediction",
  handle(
    predicting(async (req, res) => {
      const id = matchId.parse(req.params.id);
      const { optionId } = schemas.answer.parse(req.body ?? {});
      res.status(201);
      return predict(id, await viewerOf(req, res), optionId);
    }),
  ),
);

/** a prediction error is the fan's answer (400 / 404 / 409) */
function predicting(fn: (req: Request, res: Response) => Promise<unknown>) {
  return async (req: Request, res: Response) => {
    try {
      return await fn(req, res);
    } catch (err) {
      if (err instanceof PredictionError) return void res.status(err.status).json({ error: err.message });
      throw err;
    }
  };
}

/** one fan's points on a board, by source and by match (the leaderboard's expanded row) */
siteRouter.get(
  "/leaderboard/breakdown",
  handle(async (req, res) => {
    const { scope, user } = schemas.breakdown.parse(req.query);
    const b = await breakdownFor(await viewerOf(req, res), scope, user);
    if (!b) return void res.status(404).json({ error: "not on this board" });
    return b;
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
  handle(async (req, res) => rewardsPage(await viewerOf(req, res))),
);

/** a wallet error is the fan's answer (400 / 403 / 404 / 409), anything else a server error */
const wallet =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  async (req: Request, res: Response) => {
    try {
      return await fn(req, res);
    } catch (err) {
      if (err instanceof WalletError) return void res.status(err.status).json({ error: err.message });
      throw err;
    }
  };

/** a subscription, paid in demo money plus up to the plan's points cap (no real payment) */
siteRouter.post(
  "/subscriptions",
  handle(wallet(async (req, res) => purchase(await viewerOf(req, res), schemas.purchase.parse(req.body ?? {})))),
);

/** stops renewal; the plan stays valid until it expires */
siteRouter.post(
  "/subscriptions/cancel",
  handle(wallet(async (req, res) => ({ ...(await cancel(await viewerOf(req, res), schemas.cancel.parse(req.body ?? {}).planId)), ...asOfNow() }))),
);

/** a partner offer's demo code, once per fan */
siteRouter.post(
  "/offers/:id/redeem",
  handle(wallet(async (req, res) => redeemOffer(await viewerOf(req, res), schemas.offerId.parse(req.params.id)))),
);

// ---------- the watch party: reactions, ask the match, the guest pass ----------

/** a started match, else the 404 / 409 answer was sent */
async function started(id: string, res: Response): Promise<boolean> {
  const s = await matchStarted(id);
  if (s === null) res.status(404).json({ error: "match not found" });
  else if (!s) res.status(409).json(NOT_STARTED);
  return !!s;
}

/** a reaction that floats over everyone's screen (one every 2 s per fan) */
siteRouter.post(
  "/matches/:id/bursts",
  handle(async (req, res) => {
    const id = matchId.parse(req.params.id);
    const { emoji } = schemas.emoji.parse(req.body ?? {});
    if (!(await started(id, res))) return;
    const v = await viewerOf(req, res);
    if (!v.user?.nickname) return void res.status(401).json({ error: "pick a nickname first" });
    const burst = await postBurst(id, v.user, emoji);
    if ("error" in burst) return void res.status(burst.status).json({ error: burst.error });
    void publish(id, [{ event: "burst", payload: { burst } }]);
    res.status(201);
    return { burst, ...asOfNow() };
  }),
);

/** an emoji on a message in the feed */
siteRouter.post(
  "/comments/:id/react",
  handle(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const { emoji } = schemas.emoji.parse(req.body ?? {});
    const v = await viewerOf(req, res);
    if (!v.user?.nickname) return void res.status(401).json({ error: "pick a nickname first" });
    const r = await react(id, v.user.id, emoji);
    if ("error" in r) return void res.status(r.status).json({ error: r.error });
    void publish(r.matchId, [{ event: "reaction", payload: { commentId: id, reactions: r.reactions } }]);
    res.status(201);
    return { commentId: id, reactions: r.reactions, ...asOfNow() };
  }),
);

const ASK_EVERY_MS = 5000;
const lastAsk = new Map<string, number>();

/** "ask the match": an answer from liiga data, as a fact card for the whole party (one ask every 5 s) */
siteRouter.post(
  "/matches/:id/ask",
  handle(async (req, res) => {
    const id = matchId.parse(req.params.id);
    const { text } = schemas.ask.parse(req.body ?? {});
    if (!(await started(id, res))) return;
    const v = await viewerOf(req, res);
    if (!v.user?.nickname) return void res.status(401).json({ error: "pick a nickname first" });
    if (Date.now() - (lastAsk.get(v.user.id) ?? 0) < ASK_EVERY_MS) return void res.status(429).json({ error: "one question every 5 seconds" });
    lastAsk.set(v.user.id, Date.now());
    const { card, post } = await askMatch(id, text);
    if (!post) return { card, comment: null, posted: false, ...asOfNow() };
    const comment = await postFact(id, v.user.id, card);
    void publish(id, [{ event: "comment", payload: { comment } }]);
    res.status(201);
    return { card, comment, posted: true, ...asOfNow() };
  }),
);

/** the guest pass: "Watch free" binds it to this match and cycle */
siteRouter.post(
  "/matches/:id/pass",
  handle(
    friendly(async (req, res) => {
      const id = matchId.parse(req.params.id);
      if (!(await started(id, res))) return;
      return { ...(await usePass(await viewerOf(req, res), id)), ...asOfNow() };
    }),
  ),
);

/** a friend error is the fan's answer (400 / 401 / 404 / 409 / 429), anything else a server error */
function friendly(fn: (req: Request, res: Response) => Promise<unknown>) {
  return async (req: Request, res: Response) => {
    try {
      return await fn(req, res);
    } catch (err) {
      if (err instanceof FriendError) return void res.status(err.status).json({ error: err.message, ...err.extra });
      throw err;
    }
  };
}

// ---------- friends and invites ----------

siteRouter.get(
  "/friends",
  handle(async (req, res) => friendsPage(await viewerOf(req, res))),
);

/** friends in a watch party right now (?match= one match) */
siteRouter.get(
  "/friends/watching",
  handle(async (req, res) => {
    const match = matchId.optional().parse(req.query.match || undefined);
    return { friends: await friendsWatching((await viewerOf(req, res)).user, match), ...asOfNow() };
  }),
);

siteRouter.post(
  "/friends/add",
  handle(friendly(async (req, res) => ({ ...(await addFriend(await viewerOf(req, res), schemas.friendCode.parse(req.body ?? {}).code)), ...asOfNow() }))),
);

siteRouter.post(
  "/friends/:userId/accept",
  handle(
    friendly(async (req, res) => {
      await acceptFriend(await viewerOf(req, res), z.string().uuid().parse(req.params.userId));
      return { ok: true, ...asOfNow() };
    }),
  ),
);

/** declines a request, cancels your own, or unfriends */
siteRouter.post(
  "/friends/:userId/remove",
  handle(
    friendly(async (req, res) => {
      await removeFriend(await viewerOf(req, res), z.string().uuid().parse(req.params.userId));
      return { ok: true, ...asOfNow() };
    }),
  ),
);

siteRouter.post(
  "/invites",
  handle(
    friendly(async (req, res) => {
      const body = schemas.invite.parse(req.body ?? {});
      res.status(201);
      return createInvite(await viewerOf(req, res), body.matchId ?? null, req);
    }),
  ),
);

siteRouter.get(
  "/invites/:code",
  handle(friendly(async (req, res) => inviteInfo(await viewerOf(req, res), schemas.inviteCode.parse(String(req.params.code).toUpperCase())))),
);

siteRouter.post(
  "/invites/:code/accept",
  handle(
    friendly(async (req, res) => {
      const code = schemas.inviteCode.parse(String(req.params.code).toUpperCase());
      const { nickname: name } = schemas.accept.parse(req.body ?? {});
      return { ...(await acceptInvite(await viewerOf(req, res), code, name)), ...asOfNow() };
    }),
  ),
);

/** npm run demo:tunnel reports its public url here (host token), so tv mode can show "Join at …" */
siteRouter.post(
  "/public-url",
  handle(async (req, res) => {
    if (!process.env.HOST_TOKEN) return void res.status(503).json({ error: "host controls are off (set HOST_TOKEN)" });
    if (!isHost(req)) return void res.status(403).json({ error: "wrong host token" });
    const { url } = schemas.publicUrl.parse(req.body ?? {});
    await reportPublicUrl(url);
    return { url: publicBaseUrl(req), ...asOfNow() };
  }),
);

siteRouter.use((_req, res) => {
  res.status(404).json({ error: "not found" });
});
