import type { HTMLAttributes } from "react";
import clsx from "clsx";

type BadgeTone =
  | "neutral"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "accent";

const toneClasses: Record<BadgeTone, string> = {
  neutral:
    "border-[color:var(--border)] bg-white/58 text-[color:var(--foreground-soft)]",
  primary:
    "border-transparent bg-[color:var(--primary-soft)] text-[color:var(--primary)]",
  success:
    "border-transparent bg-[color:var(--success-soft)] text-[color:var(--success)]",
  warning:
    "border-transparent bg-[color:var(--warning-soft)] text-[color:var(--warning)]",
  danger:
    "border-transparent bg-[color:var(--danger-soft)] text-[color:var(--danger)]",
  accent:
    "border-transparent bg-[color:var(--accent-soft)] text-[color:var(--accent)]",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-semibold tracking-[0.12em]",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}
