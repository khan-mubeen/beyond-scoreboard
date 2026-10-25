// "Join at kiekko-demo.trycloudflare.com/join" in big type for the tv: judges type it on their own
// phones (no qr codes). /join opens whatever match the rotation is on. the address is the public
// one (PUBLIC_BASE_URL or the tunnel's, from /me), else where this screen is served from
import type { MeResponse } from "@/shared/types";

export function joinUrl(me: MeResponse | null): string {
  const base = me?.publicUrl || (typeof window === "undefined" ? "" : window.location.origin);
  return `${base.replace(/^https?:\/\//, "").replace(/\/+$/, "")}/join`;
}

export function JoinAt({
  me,
  size = "lg",
  className = "",
}: {
  me: MeResponse | null;
  size?: "md" | "lg" | "xl";
  className?: string;
}) {
  const text = { md: "text-xl", lg: "text-3xl", xl: "text-5xl" }[size];
  return (
    <div className={`rounded-card bg-dark px-5 py-4 text-dark-ink shadow-card ${className}`} data-testid="join-at">
      <p className="text-sm font-bold tracking-wider text-live-bright uppercase">Play along on your phone</p>
      <p className={`mt-1 font-bold break-all ${text}`}>
        Join at <span className="font-mono">{joinUrl(me)}</span>
      </p>
    </div>
  );
}
