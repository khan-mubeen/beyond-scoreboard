import { type FormEvent, useState } from "react";
import type { JoinResponse } from "@/shared/types";
import { Button, Card } from "@/shared/ui";

export function JoinForm({ code, onJoined }: { code: string; onJoined: (playerId: string) => void }) {
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(code)}/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nickname }),
      });
      const body = await res.json();
      if (res.ok) onJoined((body as JoinResponse).playerId);
      else setError(body.error ?? "could not join");
    } catch {
      setError("can't reach the server");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted">Nickname</span>
          <input
            className="rounded-card border border-line bg-surface-2 px-3 py-2 text-lg"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={20}
            autoFocus
          />
        </label>
        <Button type="submit" disabled={busy || !nickname.trim()}>
          Join room {code}
        </Button>
        {error && <p className="text-sm text-bad">{error}</p>}
        <p className="text-xs text-muted">Make live calls for points and bragging rights.</p>
      </form>
    </Card>
  );
}
