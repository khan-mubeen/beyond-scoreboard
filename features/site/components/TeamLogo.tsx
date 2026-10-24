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

export function Avatar({ src, name, size = 32 }: { src: string; name: string; size?: number }) {
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
