import { useState } from "react";
import { readHostToken, saveHostToken } from "../data";
import { useToast } from "./Toast";

const ACTIONS = [
  { id: "start", label: "Start" },
  { id: "pause", label: "Pause" },
  { id: "resume", label: "Resume" },
  { id: "skip", label: "Skip to next call" },
  { id: "reset", label: "Reset" },
] as const;

/** demo replay controls (/match/<id>?host=1). the server checks HOST_TOKEN */
export function HostBar({ matchId }: { matchId: string }) {
  const [token, setToken] = useState(readHostToken);
  const toast = useToast();

  async function send(action: string) {
    saveHostToken(token);
    const res = await fetch(`/api/site/matches/${matchId}/control`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json", "x-host-token": token },
      body: JSON.stringify({ action }),
    }).catch(() => null);
    const body = res ? await res.json().catch(() => ({})) : {};
    toast(res?.ok ? `Replay: ${action}` : (body as { error?: string }).error ?? "control failed");
  }

  return (
    <div role="region" aria-label="Host controls" className="flex flex-wrap items-center gap-2 border-b border-line bg-highlight px-4 py-2 text-sm md:px-[30px]">
      <span className="font-semibold">Host</span>
      <label className="flex items-center gap-1">
        <span className="sr-only">Host token</span>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="HOST_TOKEN"
          className="w-36 rounded-md border border-line bg-surface px-2 py-1"
        />
      </label>
      {ACTIONS.map((a) => (
        <button key={a.id} type="button" onClick={() => send(a.id)} className="rounded-md border border-line bg-surface px-3 py-1 hover:bg-surface-2">
          {a.label}
        </button>
      ))}
    </div>
  );
}
