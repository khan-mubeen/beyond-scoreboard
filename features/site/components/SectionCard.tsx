import type { ReactNode } from "react";

/** the white card most site sections sit in: a header row, then the body */
export function SectionCard({
  title,
  action,
  children,
  id,
  className = "",
  bodyClassName = "p-5",
  frame = "plain",
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  id?: string;
  className?: string;
  bodyClassName?: string;
  /** feature: your call! and watch together (accent bar); active: the open / just-joined highlight */
  frame?: "plain" | "feature" | "active";
}) {
  const look = frame === "active" ? "feature-active" : frame === "feature" ? "feature-idle" : "border border-line bg-surface shadow-card";
  return (
    <section id={id} className={`scroll-mt-20 rounded-card transition-colors ${look} ${className}`}>
      {title && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="text-[17px] font-semibold">{title}</h2>
          {action}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

/** a small pill: "+20 pts", "Coming soon", "Liiga" */
export function Pill({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "good" | "outline";
  className?: string;
}) {
  const tones = {
    neutral: "bg-surface-2 text-muted",
    accent: "bg-accent-soft text-accent",
    good: "bg-good-soft text-good",
    outline: "border border-line bg-surface text-ink",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/** "View all →" style link-button in red */
export function ActionLink({ children, onClick, href }: { children: ReactNode; onClick?: () => void; href?: string }) {
  const cls = "inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline";
  return href ? (
    <a href={href} className={cls}>
      {children}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  );
}
