import { type FormEvent, useState } from "react";
import { Modal } from "./Modal";

/** first visit: pick a nickname to play along (calls, comments, the room leaderboard) */
export function NicknamePrompt({
  open,
  onClose,
  onSubmit,
  roomCode,
}: {
  open: boolean;
  onClose: () => void;
  /** resolves to an error message, or null when joined */
  onSubmit: (nickname: string) => Promise<string | null>;
  roomCode?: string | null;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const err = await onSubmit(name.trim());
    setBusy(false);
    setError(err);
  }

  return (
    <Modal open={open} onClose={onClose} title={roomCode ? `Join room ${roomCode}` : "Join the match"}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Pick a nickname to make calls and comment</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={24}
            autoFocus
            className="rounded-lg border border-line bg-surface-2/60 px-3 py-2.5 text-base"
            aria-describedby="nickname-note"
          />
        </label>
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="h-11 rounded-lg bg-accent text-sm font-semibold text-accent-ink hover:brightness-110 disabled:opacity-50"
        >
          {busy ? "Joining…" : "Join"}
        </button>
        {error && (
          <p role="alert" className="text-sm text-bad">
            {error}
          </p>
        )}
        <p id="nickname-note" className="text-xs text-muted">
          Points only. Your nickname shows on leaderboards and next to your comments.
        </p>
      </form>
    </Modal>
  );
}
