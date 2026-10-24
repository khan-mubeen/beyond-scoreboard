// /friends: your friend code, "add friend" by code, requests to accept or decline, and your
// friends with "watching now". /i/<code>: an invite link — pick a nickname, become the inviter's
// friend, get a free live match when they are a member, and land in their party
import { type FormEvent, useState } from "react";
import { Icon } from "../components/Icon";
import { NicknamePrompt } from "../components/NicknamePrompt";
import { SectionCard } from "../components/SectionCard";
import { SiteLayout } from "../components/SiteLayout";
import { InitialAvatar } from "../components/TeamLogo";
import { toast } from "../components/Toast";
import {
  acceptFriendApi,
  acceptInviteApi,
  addFriendApi,
  removeFriendApi,
  saveSettings,
  useFriends,
  useInvite,
  useMe,
} from "../data";
import type { FriendItem } from "@/shared/types";

function Person({ f, children }: { f: FriendItem; children?: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 py-3">
      <InitialAvatar name={f.name} size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{f.name}</p>
        {f.watching && (
          <a
            href={`/match/${f.watching.matchId}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-good hover:underline"
            data-testid="friend-watching"
          >
            <span aria-hidden className="size-2 animate-pulse rounded-full bg-good" />
            Watching now · {f.watching.title}
          </a>
        )}
      </div>
      {children}
    </li>
  );
}

export function FriendsPage() {
  const me = useMe().data;
  const { data, refresh } = useFriends();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [nameOpen, setNameOpen] = useState(false);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (me && !me.joined) return setNameOpen(true);
    const r = await addFriendApi(code.trim().toUpperCase());
    if (!r.ok) return setError(r.error);
    setError(null);
    setCode("");
    toast(r.data.status === "friends" ? "You're friends now" : "Request sent");
    refresh();
  }
  const act = (fn: () => Promise<{ ok: boolean }>, msg: string) => async () => {
    const r = await fn();
    if (r.ok) toast(msg);
    refresh();
  };

  return (
    <SiteLayout sidebar={{ activeLinkId: "profile", docked: true }}>
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6 md:px-[30px]">
        <h1 className="font-serif text-3xl font-bold">Friends</h1>
        <SectionCard title="Your friend code">
          {data?.friendCode ? (
            <p className="flex flex-wrap items-center gap-3">
              <span
                className="rounded-lg bg-surface-2 px-4 py-2 font-mono text-2xl font-bold tracking-[0.25em]"
                data-testid="friend-code"
              >
                {data.friendCode}
              </span>
              <span className="text-sm text-muted">
                Friends add you with this code. Or send an invite link from any match.
              </span>
            </p>
          ) : (
            <p className="text-sm text-muted">Pick a nickname in any match (or below) and your code appears here.</p>
          )}
          <form onSubmit={add} className="mt-4 flex gap-2">
            <label className="sr-only" htmlFor="friend-code-input">
              A friend's code
            </label>
            <input
              id="friend-code-input"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="A friend's code, e.g. K7M2PQ"
              maxLength={12}
              className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2/60 px-3 py-2.5 font-mono uppercase"
            />
            <button
              type="submit"
              disabled={code.trim().length < 4}
              className="rounded-lg bg-accent px-4 font-semibold text-accent-ink hover:brightness-110 disabled:opacity-50"
            >
              Add friend
            </button>
          </form>
          {error && (
            <p role="alert" className="mt-2 text-sm text-bad">
              {error}
            </p>
          )}
        </SectionCard>

        {!!data?.incoming.length && (
          <SectionCard title={`Requests (${data.incoming.length})`}>
            <ul className="divide-y divide-line">
              {data.incoming.map((f) => (
                <Person key={f.userId} f={f}>
                  <button
                    type="button"
                    onClick={act(() => acceptFriendApi(f.userId), "You're friends now")}
                    className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={act(() => removeFriendApi(f.userId), "Declined")}
                    className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold"
                  >
                    Decline
                  </button>
                </Person>
              ))}
            </ul>
          </SectionCard>
        )}

        <SectionCard title={`Your friends${data ? ` (${data.friends.length})` : ""}`}>
          {data?.friends.length ? (
            <ul className="divide-y divide-line" data-testid="friends-list">
              {data.friends.map((f) => (
                <Person key={f.userId} f={f} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">
              No friends yet. Share an invite link from a match: they join your party and you're friends at once.
            </p>
          )}
        </SectionCard>

        {!!data?.outgoing.length && (
          <SectionCard title="Sent requests">
            <ul className="divide-y divide-line">
              {data.outgoing.map((f) => (
                <Person key={f.userId} f={f}>
                  <button
                    type="button"
                    onClick={act(() => removeFriendApi(f.userId), "Request cancelled")}
                    className="text-sm text-muted underline"
                  >
                    Cancel
                  </button>
                </Person>
              ))}
            </ul>
          </SectionCard>
        )}
      </div>
      <NicknamePrompt
        open={nameOpen}
        title="Pick a nickname"
        note="Friends see this name. You can change it in settings."
        onClose={() => setNameOpen(false)}
        onSubmit={async (nickname) => {
          const r = await saveSettings({ nickname });
          if (!r.ok) return r.error;
          setNameOpen(false);
          refresh();
          return null;
        }}
      />
    </SiteLayout>
  );
}

/** /i/<code>: an invite from a friend */
export function InvitePage({ code }: { code: string }) {
  const me = useMe().data;
  const { data: invite, status } = useInvite(code.toUpperCase());
  const [nameOpen, setNameOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept(nickname?: string): Promise<string | null> {
    const r = await acceptInviteApi(code.toUpperCase(), nickname);
    if (!r.ok) {
      setError(r.error);
      return r.error;
    }
    setNameOpen(false);
    toast(
      r.data.pass
        ? `You and ${r.data.friend} are friends · 1 free live match from ${r.data.friend}`
        : `You and ${r.data.friend} are friends`,
      { tone: "good", ms: 5000 },
    );
    window.location.assign(r.data.matchId ? `/match/${r.data.matchId}` : "/friends");
    return null;
  }
  const go = () => (me?.joined ? void accept() : setNameOpen(true));

  return (
    <SiteLayout sidebar={{ docked: false }}>
      <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-10">
        {status === "notfound" || (status === "error" && !invite) ? (
          <SectionCard title="Invite not found">
            <p className="text-sm text-muted">
              This link doesn't work any more. Ask your friend for a new one, or see what's on.
            </p>
            <a
              href="/sports"
              className="mt-4 inline-flex h-11 items-center rounded-lg bg-accent px-5 font-semibold text-accent-ink"
            >
              Kaleva Sports
            </a>
          </SectionCard>
        ) : !invite ? (
          <p className="text-center text-muted">Opening the invite…</p>
        ) : (
          <section
            className="overflow-hidden rounded-card border border-line bg-surface shadow-card"
            data-testid="invite-page"
          >
            <div className="bg-dark p-6 text-dark-ink">
              <p className="text-sm font-bold tracking-wider text-accent uppercase">Watch party invite</p>
              <h1 className="mt-2 font-serif text-3xl font-bold">
                {invite.yours ? "This is your own invite" : `${invite.inviter} invited you`}
              </h1>
              {invite.match && <p className="mt-1 text-lg opacity-90">to watch {invite.match.title} together</p>}
            </div>
            <div className="flex flex-col gap-4 p-6">
              {invite.freeMatch && !invite.yours && (
                <p
                  className="flex items-center gap-2 rounded-lg bg-good-soft px-3 py-2 text-sm font-semibold text-ink"
                  data-testid="invite-free-match"
                >
                  <Icon name="sparkle" className="size-4 text-good" /> Your first live match is free, from{" "}
                  {invite.inviter}
                </p>
              )}
              <ul className="flex flex-col gap-2 text-sm">
                <li className="flex gap-2">
                  <Icon name="users" className="size-5 text-accent" /> You and {invite.inviter} become friends: see when
                  each other is watching
                </li>
                <li className="flex gap-2">
                  <Icon name="target" className="size-5 text-accent" /> Make the same calls, chat and react in one party
                </li>
              </ul>
              {invite.used ? (
                <p className="text-sm text-bad">
                  This invite was used already. Ask {invite.inviter} for a new link, or join the match anyway.
                </p>
              ) : null}
              <button
                type="button"
                onClick={
                  invite.used || invite.yours
                    ? () => window.location.assign(invite.match ? `/match/${invite.match.id}` : "/sports")
                    : go
                }
                className="flex h-12 items-center justify-center gap-2 rounded-lg bg-accent text-base font-semibold text-accent-ink hover:brightness-110"
                data-testid="invite-accept"
              >
                {invite.used || invite.yours ? "Go to the match" : "Join the party"}
              </button>
              {error && (
                <p role="alert" className="text-sm text-bad">
                  {error}
                </p>
              )}
            </div>
          </section>
        )}
      </div>
      <NicknamePrompt open={nameOpen} onClose={() => setNameOpen(false)} onSubmit={(n) => accept(n)} />
    </SiteLayout>
  );
}
