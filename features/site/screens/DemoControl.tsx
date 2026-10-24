import { useState } from "react";
import type { RotationInfo } from "@/shared/types";
import { Breadcrumbs, SiteLayout } from "../components/SiteLayout";
import { DataUnavailable, PageSkeleton } from "../components/Skeleton";
import { toast } from "../components/Toast";
import { fmtCountdown, hostPost, readHostToken, saveHostToken, setData, useRotation, useServerNow } from "../data";

const ACTIONS = [
  { id: "restart", label: "Restart rotation", hint: "Match 1's lobby, from the start" },
  { id: "skip", label: "Skip to next phase", hint: "Lobby → live → summary → next match" },
  { id: "pause", label: "Pause", hint: "Freezes the clock, the video and the calls" },
  { id: "resume", label: "Resume", hint: "Carries on where it paused" },
] as const;

const PHASE = { lobby: "Lobby", live: "Live", summary: "Summary" };
const clockOf = (ms: number) => new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** /demo/control: the host's view of the rotation, with the controls (x-host-token) */
export function DemoControl() {
  const { data: r, status, refresh } = useRotation();
  const now = useServerNow(500);
  const [token, setToken] = useState(readHostToken);
  const [busy, setBusy] = useState(false);

  async function send(action: string) {
    saveHostToken(token);
    setBusy(true);
    const res = await hostPost<RotationInfo>("/api/site/rotation/control", { action }, token);
    setBusy(false);
    if (!res.ok) return toast(res.error, { tone: "bad" });
    setData<RotationInfo>("/api/site/rotation", () => res.data);
    toast(`Rotation: ${action}`);
  }

  return (
    <SiteLayout sidebar={{ docked: false }}>
      <main className="px-4 pb-12 md:px-6">
        <Breadcrumbs items={[{ label: "Sports", href: "/sports" }, { label: "Demo control" }]} />
        <h1 className="font-serif text-[36px] leading-tight font-bold">Demo control</h1>
        {!r ? (
          status === "notfound" ? (
            <p className="mt-4 max-w-xl text-muted">The demo rotation is off. Start the server with DEMO_MODE=true and a demo/rotation.json (npm run demo:pick).</p>
          ) : status === "error" ? (
            <DataUnavailable what="the rotation" onRetry={refresh} />
          ) : (
            <PageSkeleton cards={2} />
          )
        ) : (
          <div className="mt-4 grid max-w-5xl gap-4 lg:grid-cols-2">
            <section className="rounded-card border border-line bg-surface p-5 shadow-card">
              <p className="text-sm text-muted">Now · cycle {r.cycle + 1}{r.paused && " · paused"}</p>
              <p className="mt-1 text-2xl font-bold">{r.current.title}</p>
              <p className="mt-2 text-lg">
                <span className="rounded-md bg-accent px-2 py-0.5 font-bold text-accent-ink">{PHASE[r.current.phase]}</span>{" "}
                <span className="tabular-nums">{r.paused ? "paused" : `${fmtCountdown(r.current.phaseEndsAt - now)} left`}</span>
              </p>
              <p className="mt-4 text-sm text-muted">Next</p>
              <p className="font-semibold">
                {r.next.title} · <span className="tabular-nums">{r.paused ? "paused" : `starts in ${fmtCountdown(r.next.startsAt - now)}`}</span>
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-sm">
                <a href="/tv" target="_blank" rel="noreferrer" className="rounded-lg border border-line px-3 py-2 font-semibold hover:bg-surface-2">
                  Open TV mode
                </a>
                <a href={`/match/${r.current.matchId}`} className="rounded-lg border border-line px-3 py-2 font-semibold hover:bg-surface-2">
                  Open the match page
                </a>
              </div>
            </section>

            <section className="rounded-card border border-line bg-surface p-5 shadow-card">
              <label className="flex flex-col gap-1 text-sm font-semibold">
                Host token
                <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="HOST_TOKEN" className="rounded-lg border border-line bg-surface px-3 py-2 font-normal" />
              </label>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {ACTIONS.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    disabled={busy || !token}
                    onClick={() => void send(a.id)}
                    className="rounded-lg border border-line px-3 py-2.5 text-left hover:bg-surface-2 disabled:opacity-50"
                  >
                    <span className="block font-semibold">{a.label}</span>
                    <span className="block text-xs text-muted">{a.hint}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-card border border-line bg-surface p-5 shadow-card lg:col-span-2">
              <h2 className="font-semibold">This cycle</h2>
              <table className="mt-2 w-full text-sm tabular-nums">
                <thead className="text-left text-muted">
                  <tr>
                    <th className="py-1 font-medium">Match</th>
                    <th className="font-medium">Lobby</th>
                    <th className="font-medium">Live</th>
                    <th className="font-medium">Summary</th>
                    <th className="font-medium">Ends</th>
                  </tr>
                </thead>
                <tbody>
                  {r.matches.map((m) => (
                    <tr key={m.matchId} className={`border-t border-line ${m.matchId === r.current.matchId ? "font-semibold text-accent" : ""}`}>
                      <td className="py-1.5">
                        <a href={`/match/${m.matchId}`} className="hover:underline">
                          {m.title}
                        </a>
                      </td>
                      <td>{clockOf(m.lobbyAt)}</td>
                      <td>{clockOf(m.liveAt)}</td>
                      <td>{clockOf(m.summaryAt)}</td>
                      <td>{clockOf(m.endsAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        )}
      </main>
    </SiteLayout>
  );
}
