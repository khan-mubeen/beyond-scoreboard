// "Invite": a link for one friend (/i/<code>, from PUBLIC_BASE_URL or this site's address). they
// become your friend and join your party; when you have a plan with the live stream, their first
// live match is free. your friend code for "add friend" is here too
import { useEffect, useState } from "react";
import type { InviteCreated, MeResponse } from "@/shared/types";
import { createInviteApi } from "../data";
import { Icon } from "./Icon";
import { Modal } from "./Modal";
import { toast } from "./Toast";

export function InviteModal({
  open,
  onClose,
  matchId,
  me,
}: {
  open: boolean;
  onClose: () => void;
  matchId: string | null;
  me: MeResponse | null;
}) {
  const [invite, setInvite] = useState<InviteCreated | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    let gone = false;
    void createInviteApi(matchId).then((r) => {
      if (gone) return;
      if (r.ok) {
        setInvite(r.data);
        setError(null);
      } else setError(r.error);
    });
    return () => {
      gone = true;
    };
  }, [open, matchId]);

  async function copy() {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.url);
      toast("Invite link copied");
    } catch {
      toast(`Share this link: ${invite.url}`, { ms: 6000 });
    }
  }
  async function share() {
    if (!invite) return;
    if (navigator.share)
      await navigator
        .share({ title: "Join my watch party", text: "Watch the match with me on Kaleva Sports", url: invite.url })
        .catch(() => {});
    else await copy();
  }

  return (
    <Modal open={open} onClose={onClose} title="Invite a friend">
      <div className="flex flex-col gap-4" data-testid="invite-modal">
        <p className="text-sm text-muted">One link per friend: they join this party and you become friends.</p>
        {invite?.freeMatch && (
          <p className="flex items-center gap-2 rounded-lg bg-good-soft px-3 py-2 text-sm font-semibold text-ink">
            <Icon name="sparkle" className="size-4 text-good" /> Your friend gets their first live match free
          </p>
        )}
        {error ? (
          <p role="alert" className="text-sm text-bad">
            {error}
          </p>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2/60 px-3 py-2">
            <code className="min-w-0 flex-1 truncate text-sm" data-testid="invite-url">
              {invite?.url ?? "Making your link…"}
            </code>
            <button
              type="button"
              onClick={() => void copy()}
              disabled={!invite}
              className="rounded-md px-2 py-1 text-sm font-semibold text-accent hover:bg-accent-soft disabled:opacity-40"
            >
              Copy
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => void share()}
          disabled={!invite}
          className="flex h-11 items-center justify-center gap-2 rounded-lg bg-accent font-semibold text-accent-ink hover:bg-accent-hover disabled:opacity-50"
        >
          <Icon name="arrowUpRight" className="size-4" /> Share invite
        </button>
        {me?.friendCode && (
          <p className="text-center text-xs text-muted">
            Your friend code:{" "}
            <span className="font-mono text-sm font-bold tracking-widest text-ink">{me.friendCode}</span> ·{" "}
            <a href="/friends" className="underline hover:text-ink">
              Friends
            </a>
          </p>
        )}
      </div>
    </Modal>
  );
}
