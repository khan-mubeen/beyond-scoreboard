import { type FormEvent, useState } from "react";
import { suggestNickname } from "../data";
import { Modal } from "./Modal";

/**
 * the nickname sheet: the first party action (chat, an answer, a reaction, joining) asks for a
 * name, prefilled with a friendly suggestion ("Kiekko-fan 482") the fan can keep or change
 */
export function NicknamePrompt({
  open,
  onClose,
  onSubmit,
  title = "Join the watch party",
  note = "Your nickname shows in the party chat and on the boards. Points only.",
}: {
  open: boolean;
  onClose: () => void;
  /** resolves to an error message, or null when joined */
  onSubmit: (nickname: string) => Promise<string | null>;
  title?: string;
  note?: string;
  /** older callers passed the room code; every fan is in the match's one party now */
  roomCode?: string | null;
}) {
  const [name, setName] = useState(suggestNickname);
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
    <Modal open={open} onClose={onClose} title={title}>
      <form onSubmit={submit} className="flex flex-col gap-3" data-testid="nickname-sheet">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Pick a nickname (you can change this one)</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={24}
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
            className="rounded-lg border border-line bg-surface-2/60 px-3 py-2.5 text-base"
            aria-describedby="nickname-note"
            data-testid="nickname-input"
          />
        </label>
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="h-11 rounded-lg bg-accent text-sm font-semibold text-accent-ink hover:brightness-110 disabled:opacity-50"
        >
          {busy ? "Joining…" : "Let's go"}
        </button>
        {error && (
          <p role="alert" className="text-sm text-bad">
            {error}
          </p>
        )}
        <p id="nickname-note" className="text-xs text-muted">
          {note}
        </p>
      </form>
    </Modal>
  );
}
