// what's on now, once per page: the header ticker, the "Live now / Next up" card and the home
// page's Live filter all read this, so lobby, live and final agree everywhere. the server picks
// the match and says its phase (GET /api/site/ticker, the rotation clock is the authority); one
// match channel keeps the score and the open question fresh. the engine's own state can lag the
// clock by a moment (and hold the last run's final right after a restart), so it never sets the phase
import { createContext, type ReactNode, useContext } from "react";
import type { Score, TickerData } from "@/shared/types";
import { useQuery, useServerNow, USE_MOCKS } from "../data";
import { featuredQuestion } from "./featured-question";
import { useMatchChannel } from "./use-match-channel";

export interface LiveNow {
  t: TickerData;
  /** from the server's rotation clock */
  phase: TickerData["phase"];
  score: Score | null;
  /** a your call! question takes answers right now (live only), and the seconds it has left */
  question: { secondsLeft: number } | null;
  serverNow: number;
}

const Ctx = createContext<LiveNow | null | undefined>(undefined);

function useLiveNowSource(): LiveNow | null {
  const { data } = useQuery<{ ticker: TickerData | null }>(USE_MOCKS ? null : "/api/site/ticker", {
    refreshMs: 5_000,
  });
  const t = data?.ticker ?? null;
  const running = !!t && t.phase !== "next";
  const { state } = useMatchChannel(running ? t.matchId : null);
  const serverNow = useServerNow();
  if (!t) return null;
  const fresh = state?.matchId === t.matchId ? state : null;
  const phase = t.phase;
  // the channel's score only when it is in the same phase (live while live, final in the summary)
  const want = phase === "live" ? "live" : phase === "summary" ? "final" : null;
  const live = fresh && fresh.status === want ? fresh : null;
  const q = phase === "live" && fresh?.status === "live" ? featuredQuestion(fresh, serverNow) : null;
  return {
    t,
    phase,
    score: phase === "lobby" || phase === "next" ? null : (live?.score ?? t.score),
    question: q?.kind === "open" ? { secondsLeft: q.secondsLeft } : null,
    serverNow,
  };
}

/** in the site layout: one source for the whole page */
export function LiveNowProvider({ children }: { children: ReactNode }) {
  return <Ctx.Provider value={useLiveNowSource()}>{children}</Ctx.Provider>;
}

/** what's on now (null: nothing scheduled, or still loading) */
export function useLiveNow(): LiveNow | null {
  return useContext(Ctx) ?? null;
}

/** "1:05:09", "4:30" */
export function fmtLeft(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}
