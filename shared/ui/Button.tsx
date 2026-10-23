import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:brightness-110",
  ghost: "border border-line text-ink hover:bg-surface-2",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`rounded-card px-4 py-2 font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
