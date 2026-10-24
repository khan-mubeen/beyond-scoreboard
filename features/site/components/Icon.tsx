// small inline icon set, stroke icons on a 24 grid. decorative unless a label is given
const PATHS = {
  menu: "M4 6h16M4 12h16M4 18h16",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4",
  bell: "M6 9a6 6 0 0 1 12 0c0 6 2.5 8 2.5 8h-17S6 15 6 9zM10 20.5a2.2 2.2 0 0 0 4 0",
  chevronDown: "M6 9l6 6 6-6",
  chevronRight: "M9 6l6 6-6 6",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  arrowUpRight: "M7 17L17 7M8 7h9v9",
  home: "M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  calls: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01M15 9l5-5",
  history: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  rewards: "M3 8h18v4H3zM12 8v13M5 12v9h14v-9M12 8S10.5 3.5 8 4s-1.5 4 4 4zm0 0s1.5-4.5 4-4 1.5 4-4 4z",
  achievements: "M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3a3 3 0 0 1-3 4.5M7 5H4a3 3 0 0 0 3 4.5",
  settings:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  calendar: "M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM16 3v4M8 3v4M3 10h18",
  grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  chart: "M6 20v-6M12 20V8M18 20V4",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01",
  check: "M5 12.5l4.5 4.5L19 7",
  close: "M6 6l12 12M18 6L6 18",
  send: "M4 12l16-8-6 16-2.5-6.5z",
  users: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 7M22 21a7 7 0 0 0-4.5-6.5",
  story: "M4 5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2zM4 19V5M8 7h8M8 11h6",
  lock: "M6 11h12v10H6zM8 11V8a4 4 0 0 1 8 0v3",
  sparkle: "M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z",
  discussion: "M4 5h16v11H9l-5 4z",
} as const;

const FILLED = {
  star: "M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z",
  play: "M8 5v14l11-7z",
  bolt: "M13 2L4 14h7l-1 8 9-12h-7z",
  rook: "M6 21h12v-2H6zM8 18h8l-1-7H9zM7 10h10V4h-2.5v2h-1.5V4h-2v2H9.5V4H7z",
  trophy: "M7 3h10v6a5 5 0 0 1-10 0zM3 4h3v3a3 3 0 0 1-3-3zM18 4h3a3 3 0 0 1-3 3zM10 15h4v3h3v3H7v-3h3z",
} as const;

export type IconName = keyof typeof PATHS | keyof typeof FILLED;

export function Icon({ name, className = "size-5", label }: { name: IconName; className?: string; label?: string }) {
  const filled = name in FILLED;
  const d = filled ? FILLED[name as keyof typeof FILLED] : PATHS[name as keyof typeof PATHS];
  return (
    <svg
      viewBox="0 0 24 24"
      className={`shrink-0 ${className}`}
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path d={d} />
    </svg>
  );
}
