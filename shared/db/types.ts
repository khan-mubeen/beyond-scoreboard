// repositories over the tables in supabase/migrations. server only.
// one interface, two implementations: supabase (production) and memory (tests, DB_MODE=memory)

import type { NotificationPrefs } from "../types";

export type { NotificationPrefs };

export const DEFAULT_PREFS: NotificationPrefs = { callResults: true, favoriteReminders: true, favoriteResults: true };

export interface DbUser {
  id: string;
  anonId: string;
  nickname: string | null;
  createdAt: string;
  /** npm run fake-players: never on leaderboards, watching counts or notifications */
  isBot: boolean;
  /** words call it! and picks the summary's audio */
  language: "en" | "fi";
  notificationPrefs: NotificationPrefs;
}

export interface DbNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  createdAt: string;
  readAt: string | null;
  /** one row per event per user */
  dedupeKey: string;
}

export interface DbRoom {
  id: string;
  matchId: string;
  code: string;
  createdAt: string;
}

export type CallStatus = "open" | "locked" | "resolved" | "cancelled";

export interface DbCallOption {
  id: string;
  label: string;
}

export interface DbCall {
  id: string;
  matchId: string;
  type: string;
  trigger: string;
  question: string;
  options: DbCallOption[];
  stakesLine: string | null;
  openedGameTime: number;
  /** iso */
  openedAt: string;
  /** iso, wall clock */
  locksAt: string;
  lockGameTime: number | null;
  /** how the call is decided, see features/live/engine/rules.ts */
  resolvesRule: Record<string, unknown>;
  status: CallStatus;
  correctOptionId: string | null;
  resolvedAt: string | null;
  /** the finnish wording of the question and options */
  i18n?: { fi?: { question: string; options: DbCallOption[] } } | null;
}

export interface DbAnswer {
  id: string;
  callId: string;
  userId: string;
  optionId: string;
  answeredAt: string;
  correct: boolean | null;
}

/** one ledger row: earned points are positive, spending is negative (reason subscription / offer) */
export interface DbPoints {
  id: string;
  userId: string;
  matchId: string | null;
  callId: string | null;
  points: number;
  reason: string;
  /** what a debit paid for (the subscription or redemption id) */
  ref?: string | null;
  createdAt: string;
}

export type SubscriptionStatus = "active" | "cancelled" | "expired";

export interface DbSubscription {
  id: string;
  userId: string;
  planId: string;
  startedAt: string;
  expiresAt: string;
  pointsUsed: number;
  demoAmountEur: number;
  /** stored active or cancelled; one past its expiry reads as expired */
  status: SubscriptionStatus;
  idempotencyKey: string;
  createdAt: string;
}

export interface DbRedemption {
  id: string;
  userId: string;
  offerId: string;
  pointsUsed: number;
  code: string;
  createdAt: string;
}

/** an atomic spend: done (or the first result again, replayed), not enough points, or refused */
export type SpendResult<T> = { status: "ok"; replayed: boolean; balance: number; row: T } | { status: "insufficient"; balance: number } | { status: "invalid" | "conflict" };

/** what a party feed item is: a fan's chat line, a system line (no author), a fact card, a trivia card, a reaction burst */
export type FeedKind = "chat" | "system" | "fact" | "trivia" | "burst";

export interface DbComment {
  id: string;
  matchId: string;
  /** null for a system line */
  userId: string | null;
  text: string;
  createdAt: string;
  hidden: boolean;
  likes: number;
  kind: FeedKind;
  /** the rotation cycle (or "" for other matches): each run of a match has its own party feed */
  cycle: string;
  /** a fact card's or trivia card's details */
  data: Record<string, unknown> | null;
}

export type NewComment = Pick<DbComment, "matchId" | "userId" | "text"> & Partial<Pick<DbComment, "kind" | "cycle" | "data">>;

/** a fan in a match's party this cycle; active while last seen in the last 90 s */
export interface DbPresence {
  matchId: string;
  cycle: string;
  userId: string;
  joinedAt: string;
  lastSeen: string;
}

/** one pair of fans (userA < userB), pending until the other accepts */
export interface DbFriendship {
  userA: string;
  userB: string;
  status: "pending" | "accepted";
  requestedBy: string;
  createdAt: string;
}

export interface DbInvite {
  code: string;
  inviterId: string;
  matchId: string | null;
  createdAt: string;
  usedBy: string | null;
  usedAt: string | null;
}

/** one free live match from a member's invite; bound to a match and cycle when first played */
export interface DbGuestPass {
  userId: string;
  grantedBy: string | null;
  grantedAt: string;
  usedAt: string | null;
  consumedMatchId: string | null;
  consumedCycle: string | null;
}

/** the engine leader's lease: whether this instance holds it, who does, until when */
export interface LeaderLease {
  leader: boolean;
  holder: string | null;
  expiresAt: string | null;
}

export interface Db {
  mode: "memory" | "supabase";
  users: {
    getByAnonId(anonId: string): Promise<DbUser | null>;
    create(anonId: string, nickname: string | null, isBot?: boolean): Promise<DbUser>;
    /** the fake players' ids (a few dozen at most), to leave them out of every count */
    botIds(): Promise<string[]>;
    setNickname(id: string, nickname: string): Promise<void>;
    update(id: string, patch: Partial<Pick<DbUser, "nickname" | "language" | "notificationPrefs">>): Promise<DbUser | null>;
    /** the fan and everything of theirs (answers, points, comments, favourites... cascade) */
    remove(id: string): Promise<void>;
    getMany(ids: string[]): Promise<DbUser[]>;
    getByFriendCode(code: string): Promise<DbUser | null>;
    /** false when another fan has the code already */
    setFriendCode(id: string, code: string): Promise<boolean>;
    /** a fan's friend code, null until one is set */
    friendCode(id: string): Promise<string | null>;
  };
  favorites: {
    /** liiga team ids, oldest first */
    list(userId: string): Promise<string[]>;
    set(userId: string, teamId: string, on: boolean): Promise<void>;
  };
  rooms: {
    getByCode(code: string): Promise<DbRoom | null>;
    /** the match's default room, created on first use */
    getOrCreateForMatch(matchId: string, code: string): Promise<DbRoom>;
    join(roomId: string, userId: string): Promise<void>;
    members(roomId: string): Promise<string[]>;
  };
  calls: {
    create(c: Omit<DbCall, "id">): Promise<DbCall>;
    /** one call per match and trigger, whichever server asks first (a match's prediction): the existing one, else a new one */
    createOnce(c: Omit<DbCall, "id">): Promise<{ call: DbCall; created: boolean }>;
    update(id: string, patch: Partial<Omit<DbCall, "id">>): Promise<DbCall | null>;
    get(id: string): Promise<DbCall | null>;
    getMany(ids: string[]): Promise<DbCall[]>;
    listForMatch(matchId: string): Promise<DbCall[]>;
  };
  answers: {
    create(a: Omit<DbAnswer, "id" | "correct">): Promise<"ok" | "duplicate">;
    listForCall(callId: string): Promise<DbAnswer[]>;
    listForUser(userId: string, callIds: string[]): Promise<DbAnswer[]>;
    /** a fan's answers, newest first */
    recentForUser(userId: string, limit: number): Promise<DbAnswer[]>;
    setCorrect(callId: string, correctOptionId: string): Promise<void>;
  };
  points: {
    /** false when this user was already paid for this call */
    award(e: Omit<DbPoints, "id" | "createdAt"> & { createdAt?: string }): Promise<boolean>;
    listForUser(userId: string): Promise<DbPoints[]>;
    listSince(iso: string, matchId?: string): Promise<DbPoints[]>;
  };
  /**
   * spending points. every spend is one transaction behind a per-fan lock (postgres: an advisory
   * lock in purchase_subscription / redeem_offer; memory: a per-fan mutex), so parallel clicks
   * can't overspend and the balance never goes below zero
   */
  wallet: {
    /** the sum of the fan's ledger */
    balance(userId: string): Promise<number>;
    /** the debit and the subscription together; an active plan of the same id is extended */
    purchase(p: { userId: string; planId: string; points: number; amountEur: number; days: number; idempotencyKey: string }): Promise<SpendResult<DbSubscription>>;
    /** newest first */
    subscriptions(userId: string): Promise<DbSubscription[]>;
    /** the plan's running periods stop renewing (they stay valid until they expire); how many */
    cancel(userId: string, planId: string): Promise<number>;
    /** once per fan and offer: a second call returns the first redemption */
    redeem(p: { userId: string; offerId: string; points: number; code: string }): Promise<SpendResult<DbRedemption>>;
    redemptions(userId: string): Promise<DbRedemption[]>;
  };
  comments: {
    create(c: NewComment): Promise<DbComment>;
    /** a line posted once per key (a goal, a result): null when the key was used already */
    createOnce(c: NewComment, dedupeKey: string): Promise<DbComment | null>;
    get(id: string): Promise<DbComment | null>;
    /** newest first. by default every kind but bursts, of every cycle */
    list(matchId: string, limit: number, opts?: { cycle?: string; kinds?: FeedKind[] }): Promise<DbComment[]>;
    /** items of these kinds since a time, oldest first (recent reaction bursts) */
    since(matchId: string, cycle: string, iso: string, kinds: FeedKind[]): Promise<DbComment[]>;
    like(commentId: string, userId: string): Promise<"ok" | "duplicate">;
    react(commentId: string, userId: string, emoji: string): Promise<"ok" | "duplicate">;
    reactions(commentIds: string[]): Promise<{ commentId: string; userId: string; emoji: string }[]>;
  };
  presence: {
    /**
     * a heartbeat: upserts last seen. fresh when the fan just joined (the count went up; postgres:
     * the row was made in the last few seconds, memory: also when they come back after a timeout)
     */
    beat(matchId: string, cycle: string, userId: string, at?: string): Promise<{ fresh: boolean }>;
    /** the page closed: no longer active, still a participant of the party */
    leave(matchId: string, cycle: string, userId: string): Promise<void>;
    /** everyone who joined this party, active or not */
    list(matchId: string, cycle: string): Promise<DbPresence[]>;
    /** where these fans were seen since a time, newest first (friends watching now) */
    seenSince(userIds: string[], iso: string): Promise<DbPresence[]>;
  };
  friends: {
    /** every friendship of a fan, pending ones too */
    list(userId: string): Promise<DbFriendship[]>;
    /** a request from one fan to another: exists when the pair has a row already */
    request(from: string, to: string): Promise<"requested" | "exists">;
    /** accepts the other's pending request; false when there is none */
    accept(userId: string, otherId: string): Promise<boolean>;
    /** friends at once (an invite) */
    connect(a: string, b: string, requestedBy: string): Promise<void>;
    remove(userId: string, otherId: string): Promise<void>;
  };
  invites: {
    create(i: { code: string; inviterId: string; matchId: string | null }): Promise<DbInvite>;
    get(code: string): Promise<DbInvite | null>;
    /** the inviter's unused invites */
    openCount(inviterId: string): Promise<number>;
    /** marks it used by this fan, only if nobody used it yet (atomic): null when it was */
    use(code: string, userId: string): Promise<DbInvite | null>;
  };
  passes: {
    get(userId: string): Promise<DbGuestPass | null>;
    /** false when the fan has (or had) one: one pass per fan, ever */
    grant(userId: string, grantedBy: string): Promise<boolean>;
    /** binds the unused pass to a match and cycle (atomic): null when it was used already */
    consume(userId: string, matchId: string, cycle: string): Promise<DbGuestPass | null>;
  };
  /** the live engine's leader lease (memory: always this instance) */
  leader: {
    claim(instance: string, ttlSeconds: number): Promise<LeaderLease>;
    release(instance: string): Promise<void>;
  };
  reminders: {
    set(userId: string, matchId: string): Promise<void>;
    remove(userId: string, matchId: string): Promise<void>;
    listForUser(userId: string): Promise<string[]>;
  };
  content: {
    get(key: string): Promise<{ content: unknown; source: "template" | "llm" } | null>;
    put(key: string, content: unknown, source: "template" | "llm"): Promise<void>;
  };
  phrases: {
    listApproved(callType: string, lang: string): Promise<string[]>;
    insert(rows: { callType: string; lang: string; template: string; approved: boolean }[]): Promise<void>;
  };
  notifications: {
    /** bulk insert; rows whose dedupe key already exists are skipped */
    create(rows: Omit<DbNotification, "id" | "createdAt" | "readAt">[]): Promise<void>;
    list(userId: string, limit: number): Promise<DbNotification[]>;
    unreadCount(userId: string): Promise<number>;
    /** one notification, or all of the user's when id is omitted */
    markRead(userId: string, id?: string): Promise<void>;
  };
  settings: {
    get<T>(key: string): Promise<T | null>;
    set(key: string, value: unknown): Promise<void>;
  };
  admin: {
    /**
     * npm run demo:reset: deletes bots and every fan who isn't seeded (anon id "seed:…") created
     * since `since` (all when omitted), with everything of theirs (answers, points, spending,
     * subscriptions, codes, comments, rooms: cascade), plus notifications and calls since then.
     * a fan who comes back starts fresh (and gets the welcome balance again). party presence is
     * cleared; friendships, invites and guest passes go with their fans. per table counts
     */
    resetDemo(since?: string): Promise<Record<string, number>>;
  };
}
