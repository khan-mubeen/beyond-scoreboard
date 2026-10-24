import type { TeamRef } from "@/shared/types";

/** a team logo from data (a placeholder svg today). the name is the alt text */
export function TeamLogo({ team, size = 32, className = "" }: { team: TeamRef; size?: number; className?: string }) {
  return (
    <img
      src={team.logo}
      alt={`${team.name} logo`}
      width={size}
      height={size}
      className={`shrink-0 rounded-full ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

// initial avatars take one of a few token colour pairs, the same one for the same name
const TONES = ["bg-accent-soft text-accent", "bg-good-soft text-good", "bg-top4-soft text-top4", "bg-playoffs-soft text-playoffs", "bg-highlight text-ink", "bg-surface-2 text-ink"];
const toneOf = (name: string) => TONES[[...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % TONES.length];

/** a fan's initial in a coloured circle */
export function InitialAvatar({ name, size = 32, className = "" }: { name: string; size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full font-bold ${toneOf(name)} ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.42)) }}
    >
      {(name.trim()[0] ?? "G").toUpperCase()}
    </span>
  );
}

/** a picture, or "initial:X" (a fan without one): their initial in a coloured circle */
export function Avatar({ src, name, size = 32 }: { src: string; name: string; size?: number }) {
  if (src.startsWith("initial:")) return <InitialAvatar name={name || src.slice(8)} size={size} />;
  return (
    <img
      src={src}
      alt={name}
      width={size}
      height={size}
      className="shrink-0 rounded-full"
      style={{ width: size, height: size }}
    />
  );
}

/** initials circle for people without a picture */
export function Initial({ name, size = 32, dark = false }: { name: string; size?: number; dark?: boolean }) {
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full text-sm font-semibold ${dark ? "bg-ink text-surface" : "bg-surface-2 text-muted"}`}
      style={{ width: size, height: size }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
