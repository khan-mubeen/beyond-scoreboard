// ?debug=1 on a match page: who this browser is, which party it is in, how updates arrive
// (realtime or polling), when the last one came, the watching count and where it came from, and
// whether the server that answers runs the live engine (leader) or only serves http (follower)
import type { LiveState } from "@/shared/types";
import { useServerNow } from "../data";
import type { ChannelDebug } from "./use-match-channel";

export const debugMode = () =>
  typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debug") === "1";

export function DebugPanel({ debug, state }: { debug: ChannelDebug; state: LiveState | null }) {
  const now = useServerNow(1000);
  const ago = debug.lastEventAt
    ? `${Math.max(0, Math.round((now - debug.lastEventAt) / 1000))} s ago (${debug.lastEvent})`
    : "none yet";
  const rows: [string, string][] = [
    ["user", debug.userId ?? state?.me?.userId ?? "–"],
    [
      "party",
      `${state?.party?.key ?? debug.party?.key ?? "–"} · cycle ${state?.party?.cycle || debug.party?.cycle || "–"}`,
    ],
    ["channel", debug.status],
    ["last event", ago],
    ["watching", `${state?.watching ?? "–"} (from ${debug.watchingFrom ?? "–"})`],
    ["server", state?.server ? `${state.server.role} · ${state.server.instance}` : "–"],
    ["server clock", new Date(now).toISOString().slice(11, 19)],
  ];
  return (
    <aside
      aria-label="Debug"
      className="fixed bottom-16 left-2 z-[70] max-w-[min(92vw,360px)] rounded-lg bg-dark/90 p-3 font-mono text-[11px] leading-snug text-dark-ink shadow-card md:bottom-4"
      data-testid="debug-panel"
    >
      <p className="mb-1 font-bold">debug</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-2">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="opacity-70">{k}</dt>
            <dd className="break-all" data-testid={`debug-${k.replace(" ", "-")}`}>
              {v}
            </dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
