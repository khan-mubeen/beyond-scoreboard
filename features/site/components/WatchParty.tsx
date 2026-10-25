// the watch party panel, the right column of a live match: who's here and an invite on top, then
// Chat · Party (Your Call! is its own box above it). chat is the match discussion grown into the party feed:
// messages with names and avatars, emoji on messages, system lines (goals, results), "ask the
// match" fact cards, trivia cards, reaction bursts and quick-ask chips. party: everyone here and
// the board (0 points too), with a friends filter
import { AnimatePresence, motion } from "motion/react";
import { type FormEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import type { Comment, FactCard, PartyMember, RoomLeaderboardRow } from "@/shared/types";
import { NAMES } from "@/shared/copy/names";
import { fmtInt } from "../format";
import { optionClass } from "./CallItCard";
import { Icon } from "./Icon";
import { AiLabel } from "./AiLabel";
import { InitialAvatar } from "./TeamLogo";
import type { TriviaView } from "./use-live-match";

export type PartyTab = "chat" | "party";

export const BURST_EMOJI = ["🔥", "👏", "😱", "🏒"] as const;
const REACTIONS = ["🔥", "👏", "😱", "🏒", "😂", "👍"] as const;
const QUICK_ASKS = ["Top scorer tonight", "Head-to-head", "Who's #19?", "Team form"];

/** what the panel can do; each resolves to an error to show, or null */
export interface PartyActions {
  post: (text: string) => Promise<string | null>;
  ask: (text: string) => Promise<{ error: string | null; privateCard?: FactCard | null }>;
  burst: (emoji: string) => Promise<string | null>;
  react: (commentId: string, emoji: string) => Promise<string | null>;
}

const timeOf = (iso?: string) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";

/** the avatar stack: up to five faces, then "+N" */
export function AvatarStack({
  people,
  total,
  size = 28,
}: {
  people: { name: string }[];
  total: number;
  size?: number;
}) {
  const shown = people.slice(0, 5);
  return (
    <span className="flex items-center -space-x-1.5" aria-label={`${fmtInt(total)} in the party`}>
      {shown.map((p, i) => (
        <span key={i} className="rounded-full ring-2 ring-surface">
          <InitialAvatar name={p.name} size={size} />
        </span>
      ))}
      {total > shown.length && (
        <span className="pl-3 text-xs font-semibold text-muted">+{fmtInt(total - shown.length)}</span>
      )}
    </span>
  );
}

function PartyHeader({
  watching,
  members,
  friendsHere,
  onInvite,
  pulse,
}: {
  watching: number;
  members: PartyMember[];
  friendsHere: PartyMember[];
  onInvite: () => void;
  pulse: boolean;
}) {
  return (
    <header
      className={`flex flex-col gap-2.5 border-b border-line px-4 py-3 transition-colors ${pulse ? "bg-accent-soft" : ""}`}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-2 text-[17px] leading-tight font-semibold">
          <Icon name="users" className="size-5 shrink-0 text-accent" />
          <span>
            {NAMES.party} ·{" "}
            <span className="whitespace-nowrap">
              <span className="tabular-nums" data-testid="watching">
                {fmtInt(watching)}
              </span>{" "}
              watching
            </span>
          </span>
          <span aria-hidden className="size-2 shrink-0 animate-pulse rounded-full bg-live" />
        </h2>
        <button
          type="button"
          onClick={onInvite}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-semibold text-accent-ink hover:bg-accent-hover"
        >
          <Icon name="users" className="size-4" />
          Invite
        </button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <AvatarStack people={members} total={watching} />
        {friendsHere.length > 0 && (
          <span className="flex items-center gap-1.5 font-semibold text-good" data-testid="friends-here">
            <span className="flex -space-x-1">
              {friendsHere.slice(0, 3).map((f) => (
                <span key={f.userId} className="rounded-full ring-2 ring-surface">
                  <InitialAvatar name={f.name} size={20} />
                </span>
              ))}
            </span>
            {friendsHere.length} {friendsHere.length === 1 ? "friend" : "friends"} here
          </span>
        )}
      </div>
    </header>
  );
}

function TabBar({ tab, onTab, unread, people }: { tab: PartyTab; onTab: (t: PartyTab) => void; unread: number; people: number }) {
  const tabs: { id: PartyTab; label: ReactNode }[] = [
    {
      id: "chat",
      label: (
        <>
          Chat
          {unread > 0 && (
            <span className="rounded-full bg-live px-1.5 text-[11px] font-bold text-live-ink tabular-nums">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </>
      ),
    },
    {
      id: "party",
      label: (
        <>
          Party <span className="text-muted tabular-nums">{people}</span>
        </>
      ),
    },
  ];
  return (
    <div role="tablist" aria-label="Watch party" className="grid grid-cols-2 border-b border-line">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          type="button"
          aria-selected={tab === t.id}
          onClick={() => onTab(t.id)}
          className={`relative flex items-center justify-center gap-1.5 px-2 py-3 text-sm font-semibold ${tab === t.id ? "text-accent" : "text-muted hover:text-ink"}`}
        >
          {t.label}
          {tab === t.id && (
            <motion.span layoutId="party-tab" className="absolute inset-x-2 -bottom-px h-0.5 bg-accent" />
          )}
        </button>
      ))}
    </div>
  );
}

function Reactions({ c, onReact }: { c: Comment; onReact: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  const counts = Object.entries(c.reactions ?? {});
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {counts.map(([e, n]) => (
        <button
          key={e}
          type="button"
          onClick={() => onReact(e)}
          className="rounded-full border border-line bg-surface px-1.5 py-0.5 text-xs tabular-nums hover:border-ink"
          aria-label={`${e} ${n}`}
        >
          {e} {n}
        </button>
      ))}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="rounded-full px-1.5 py-0.5 text-xs text-muted hover:bg-surface-2 hover:text-ink"
          aria-label="React"
          aria-expanded={open}
        >
          ☺+
        </button>
        {open && (
          <div className="absolute bottom-full left-0 z-10 mb-1 flex gap-0.5 rounded-full border border-line bg-surface p-1 shadow-card">
            {REACTIONS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  setOpen(false);
                  onReact(e);
                }}
                className="rounded-full px-1.5 py-0.5 text-base hover:bg-surface-2"
                aria-label={`React ${e}`}
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** an "ask the match" answer: the player's photo (or initials), the answer, the source */
export function FactCardView({ card, by, compact = false }: { card: FactCard; by?: string; compact?: boolean }) {
  const s = card.subject;
  return (
    <div className="rounded-lg border border-line bg-surface-2/60 p-3" data-testid="fact-card">
      <div className="flex items-start gap-3">
        {s?.photo ? (
          <img
            src={s.photo}
            alt=""
            width={compact ? 36 : 44}
            height={compact ? 36 : 44}
            className="shrink-0 rounded-full bg-surface object-cover"
            style={{ width: compact ? 36 : 44, height: compact ? 36 : 44 }}
          />
        ) : s ? (
          <InitialAvatar name={s.name} size={compact ? 36 : 44} />
        ) : (
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
            <Icon name="info" className="size-5" />
          </span>
        )}
        <div className="min-w-0">
          <p className="text-xs text-muted">
            {by ? `${by} asked: ` : "Asked: "}
            <span className="italic">{card.question}</span>
          </p>
          <p className="mt-0.5 text-sm font-semibold">{card.answer}</p>
          <AiLabel className="mt-1 text-[11px]" label={{ kind: "data" }} />
        </div>
      </div>
    </div>
  );
}

/** party trivia in the chat: four answers, 15 s, +10 pts, then the answer */
export function TriviaCard({ t, display = false }: { t: TriviaView; display?: boolean }) {
  return (
    <div
      className={`rounded-lg border-2 ${t.phase === "open" ? "border-live" : "border-line"} bg-surface p-3`}
      data-testid="trivia-card"
    >
      <p className={`flex items-center justify-between text-xs font-bold tracking-wide uppercase ${t.phase === "open" ? "text-live" : "text-muted"}`}>
        <span className="flex items-center gap-1.5">
          <Icon name="sparkle" className="size-4" /> Party trivia
        </span>
        <span className="rounded-full bg-accent-soft px-2 py-0.5 normal-case">+{t.call.points} pts</span>
      </p>
      <p className={`mt-1.5 font-semibold ${display ? "text-2xl" : "text-sm"}`}>{t.question}</p>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {t.options.map((o) => {
          const view = { phase: t.phase, picked: t.picked, correctOptionId: t.call.correctOptionId };
          const cls = `flex min-h-10 items-center justify-center gap-1 rounded-lg border px-2 py-2 text-center text-sm font-semibold ${optionClass(view, o.id)}`;
          const mark =
            t.phase === "revealed"
              ? o.id === t.call.correctOptionId
                ? "check"
                : o.id === t.picked
                  ? "close"
                  : null
              : t.picked === o.id
                ? t.phase === "open"
                  ? "check"
                  : "lock"
                : null;
          const content = (
            <>
              {mark && (
                <Icon
                  name={mark}
                  className={`size-4 ${mark === "check" && t.phase === "revealed" ? "text-good" : ""}`}
                />
              )}
              {o.label}
            </>
          );
          return display ? (
            <div key={o.id} className={cls}>
              {content}
            </div>
          ) : (
            <button
              key={o.id}
              type="button"
              disabled={t.phase !== "open" || !!t.picked}
              aria-pressed={t.picked === o.id}
              onClick={() => t.pick(o.id)}
              className={cls}
            >
              {content}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted" aria-live="polite">
        {t.phase === "open" ? (
          <>
            <span className="tabular-nums font-semibold text-ink">{t.secondsLeft}s</span> to answer
          </>
        ) : t.phase === "locked" ? (
          "Answers are in. The answer comes in a second."
        ) : t.picked ? (
          t.picked === t.call.correctOptionId ? (
            <span className="font-semibold text-good">Right! +{t.call.points} pts</span>
          ) : (
            "Not this time."
          )
        ) : (
          "The answer is marked above."
        )}
      </p>
      {!display && <AiLabel className="mt-1.5" label={{ kind: "data" }} />}
    </div>
  );
}

function FeedItem({
  c,
  myId,
  onReact,
  trivia,
}: {
  c: Comment;
  myId: string | null;
  onReact: (id: string, emoji: string) => void;
  trivia: TriviaView | null;
}) {
  if (c.kind === "system") {
    const goal = c.text.startsWith("GOAL!");
    return (
      <li className="flex justify-center py-1.5" data-testid="system-line">
        <span
          className={`rounded-full px-3 py-1 text-center text-xs font-semibold ${goal ? "bg-accent text-accent-ink" : "bg-surface-2 text-ink"}`}
        >
          {c.text}
        </span>
      </li>
    );
  }
  if (c.kind === "trivia") {
    const t = trivia && c.trivia?.callId === trivia.call.id ? trivia : null;
    return (
      <li className="py-1.5">{t ? <TriviaCard t={t} /> : <p className="text-xs text-muted">Trivia: {c.text}</p>}</li>
    );
  }
  const mine = !!myId && c.userId === myId;
  return (
    <li className="flex gap-2.5 py-2" data-testid="chat-item">
      <InitialAvatar name={c.author} size={30} />
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-2 text-xs">
          <span className="font-semibold">{mine ? `${c.author} (you)` : c.author}</span>
          <span className="text-muted">{timeOf(c.createdAt)}</span>
        </p>
        {c.kind === "fact" && c.fact ? (
          <FactCardView card={c.fact} by={c.author} />
        ) : (
          <p className="text-sm break-words text-ink/90">{c.text}</p>
        )}
        <Reactions c={c} onReact={(e) => onReact(c.id, e)} />
      </div>
    </li>
  );
}

function Chat({
  feed,
  myId,
  trivia,
  act,
}: {
  feed: Comment[];
  myId: string | null;
  trivia: TriviaView | null;
  act: PartyActions;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [privateCard, setPrivateCard] = useState<FactCard | null>(null);
  const inputId = useId();
  const list = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  // new lines scroll into view, unless the fan scrolled up to read
  useEffect(() => {
    const el = list.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [feed.length]);

  async function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    setPrivateCard(null);
    const asking = t.startsWith("?") || QUICK_ASKS.includes(t);
    if (asking) {
      const r = await act.ask(t);
      setError(r.error);
      if (r.privateCard) setPrivateCard(r.privateCard);
      if (!r.error) setDraft("");
    } else {
      const err = await act.post(t);
      setError(err);
      if (!err) setDraft("");
    }
    stick.current = true;
    setBusy(false);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={list}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
        }}
        className="max-h-[28rem] min-h-48 flex-1 overflow-y-auto px-4"
      >
        {feed.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">
            The party chat starts here. Say hi, react, or ask the match with "?".
          </p>
        ) : (
          <ol className="flex flex-col divide-y divide-line/60" aria-live="polite" data-testid="feed">
            {feed.map((c) => (
              <FeedItem
                key={c.id}
                c={c}
                myId={myId}
                trivia={trivia}
                onReact={(id, e) => void act.react(id, e).then(setError)}
              />
            ))}
          </ol>
        )}
      </div>
      <div className="flex flex-col gap-2 border-t border-line px-4 py-3">
        {privateCard && (
          <div className="relative">
            <FactCardView card={privateCard} compact />
            <button
              type="button"
              onClick={() => setPrivateCard(null)}
              className="absolute top-1 right-1 rounded-full p-1 text-muted hover:text-ink"
              aria-label="Dismiss"
            >
              <Icon name="close" className="size-3.5" />
            </button>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          {BURST_EMOJI.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => void act.burst(e).then(setError)}
              className="grid size-9 place-items-center rounded-full border border-line bg-surface text-lg hover:border-accent hover:bg-accent-soft active:scale-95"
              aria-label={`Send ${e} to everyone`}
              data-testid={`burst-${e}`}
            >
              {e}
            </button>
          ))}
          <span className="ml-1 text-[11px] leading-tight text-muted">Float a reaction on everyone's screen</span>
        </div>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
          {QUICK_ASKS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => void send(q)}
              className="shrink-0 rounded-full border border-line bg-surface-2/60 px-2.5 py-1 text-xs font-semibold hover:border-accent hover:text-accent"
            >
              ? {q}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void send(draft);
          }}
          className="flex items-center gap-2 rounded-lg border border-line bg-surface-2/60 px-3 py-1.5"
        >
          <label htmlFor={inputId} className="sr-only">
            Message the party, or start with ? to ask the match
          </label>
          <input
            id={inputId}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder='Say something… or "?" to ask the match'
            maxLength={280}
            className="min-w-0 flex-1 bg-transparent py-1.5 text-sm placeholder:text-muted focus:outline-none"
            data-testid="chat-input"
          />
          <button
            type="button"
            onClick={() => void send(draft.trim().startsWith("?") ? draft : `?${draft}`)}
            disabled={!draft.trim() || busy}
            className="rounded-md px-2 py-1 text-xs font-bold text-accent hover:bg-accent-soft disabled:opacity-40"
          >
            Ask
          </button>
          <button
            type="submit"
            disabled={!draft.trim() || busy}
            className="rounded-md p-1.5 text-muted hover:text-accent disabled:opacity-40"
            aria-label="Send"
          >
            <Icon name="send" className="size-4" />
          </button>
        </form>
        {error && (
          <p role="alert" className="text-xs text-bad">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

/** everyone here, and the board with every participant (0 points too); friends only on request */
function Party({
  board,
  members,
  friends,
  myId,
}: {
  board: RoomLeaderboardRow[];
  members: PartyMember[];
  friends: Set<string>;
  myId: string | null;
}) {
  const [only, setOnly] = useState(false);
  const mine = (id?: string) => !!id && (friends.has(id) || id === myId);
  const rows = only ? board.filter((r) => mine(r.userId)) : board;
  const here = only ? members.filter((m) => mine(m.userId)) : members;
  return (
    <div className="flex flex-col gap-4 px-4 py-3">
      <div className="flex rounded-lg bg-surface-2 p-1 text-sm font-semibold" role="group" aria-label="Show">
        {[
          [false, "Everyone"],
          [true, `Friends (${[...friends].length})`],
        ].map(([v, label]) => (
          <button
            key={String(v)}
            type="button"
            aria-pressed={only === v}
            onClick={() => setOnly(v as boolean)}
            className={`flex-1 rounded-md py-1.5 ${only === v ? "bg-surface text-ink shadow-card" : "text-muted"}`}
          >
            {label as string}
          </button>
        ))}
      </div>
      <section>
        <h3 className="mb-2 text-sm font-semibold">Here now · {here.length}</h3>
        {here.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {here.map((m) => (
              <li
                key={m.userId}
                className={`flex items-center gap-1.5 rounded-full border py-0.5 pr-2.5 pl-0.5 text-xs font-semibold ${friends.has(m.userId) ? "border-good" : "border-line"}`}
              >
                <InitialAvatar name={m.name} size={22} />
                {m.userId === myId ? `${m.name} (you)` : m.name}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">{only ? "No friends here right now. Invite one!" : "Nobody here yet."}</p>
        )}
      </section>
      <section>
        <h3 className="mb-1 flex items-center justify-between text-sm font-semibold">
          Party board <span className="text-xs font-normal text-muted">points this match</span>
        </h3>
        <ol className="flex flex-col divide-y divide-line text-sm" data-testid="party-board">
          {rows.map((r, i) => (
            <li
              key={r.userId ?? `${r.name}-${i}`}
              className={`flex items-center gap-2.5 py-2 ${r.isYou ? "-mx-2 rounded-lg bg-accent-soft px-2 font-semibold text-accent" : ""}`}
            >
              <span className="w-5 text-right text-muted tabular-nums">{r.rank ?? "–"}</span>
              <InitialAvatar name={r.name} size={24} />
              <span className="min-w-0 flex-1 truncate">
                {r.name}
                {r.isYou && " (you)"}
                {!r.isYou && r.userId && friends.has(r.userId) && (
                  <span className="ml-1 text-xs text-good">friend</span>
                )}
              </span>
              <span className="tabular-nums">{fmtInt(r.score ?? 0)}</span>
            </li>
          ))}
        </ol>
        {rows.length === 0 && (
          <p className="text-sm text-muted">
            {only ? "Your friends show up here when they join." : "Open the match on another phone to fill the party."}
          </p>
        )}
      </section>
    </div>
  );
}

export function WatchPartyPanel({
  tab,
  onTab,
  watching,
  members,
  board,
  feed,
  myId,
  friends,
  trivia,
  pulse,
  onInvite,
  act,
  className = "",
}: {
  tab: PartyTab;
  onTab: (t: PartyTab) => void;
  watching: number;
  members: PartyMember[];
  board: RoomLeaderboardRow[];
  feed: Comment[];
  myId: string | null;
  /** accepted friends' user ids */
  friends: string[];
  trivia: TriviaView | null;
  pulse: boolean;
  onInvite: () => void;
  act: PartyActions;
  className?: string;
}) {
  const friendSet = new Set(friends);
  const friendsHere = members.filter((m) => friendSet.has(m.userId));
  // chat lines that arrived while another tab was open (react's "adjust state while rendering")
  const [seen, setSeen] = useState(feed.length);
  if (tab === "chat" && seen !== feed.length) setSeen(feed.length);
  const unread = Math.max(0, feed.length - seen);
  return (
    <section
      id="watch-party"
      aria-label={NAMES.party}
      className={`flex min-h-0 scroll-mt-20 flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card ${className}`}
    >
      <PartyHeader watching={watching} members={members} friendsHere={friendsHere} onInvite={onInvite} pulse={pulse} />
      <TabBar tab={tab} onTab={onTab} unread={unread} people={board.length} />
      <AnimatePresence initial={false} mode="wait">
        {tab === "chat" && (
          <motion.div
            key="chat"
            className="flex min-h-0 flex-1 flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
          >
            <Chat feed={feed} myId={myId} trivia={trivia} act={act} />
          </motion.div>
        )}
        {tab === "party" && (
          <motion.div
            key="party"
            className="min-h-0 flex-1 overflow-y-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
          >
            <Party board={board} members={members} friends={friendSet} myId={myId} />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
