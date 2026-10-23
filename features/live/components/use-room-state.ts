import { useEffect, useState, useSyncExternalStore } from "react";
import type { RoomState } from "@/shared/types";

export const POLL_MS = 1000;

/** polls /api/rooms/:code/state every second */
export function useRoomState(code: string, playerId?: string | null) {
  const [state, setState] = useState<RoomState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const url = `/api/rooms/${encodeURIComponent(code)}/state${playerId ? `?playerId=${encodeURIComponent(playerId)}` : ""}`;

    async function poll() {
      try {
        const res = await fetch(url, { cache: "no-store" });
        const body = await res.json();
        if (cancelled) return;
        if (res.ok) {
          setState(body as RoomState);
          setError(null);
        } else {
          setError(body.error ?? `error ${res.status}`);
        }
      } catch {
        if (!cancelled) setError("can't reach the server");
      }
    }

    const id = setInterval(poll, POLL_MS);
    const first = setTimeout(poll, 0);
    return () => {
      cancelled = true;
      clearInterval(id);
      clearTimeout(first);
    };
  }, [code, playerId]);

  return { state, error };
}

const noSubscribe = () => () => {};

/** the url phones open, built in the browser so it matches however the screen was reached */
export function useJoinUrl(code: string): string | null {
  const origin = useSyncExternalStore(
    noSubscribe,
    () => window.location.origin,
    () => null,
  );
  return origin ? `${origin}/room/${code}` : null;
}
