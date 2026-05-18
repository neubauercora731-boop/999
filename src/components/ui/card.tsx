import type { HTMLAttributes } from "react";
import clsx from "clsx";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "rounded-[1.65rem] border border-[color:var(--border)] bg-[color:var(--surface-solid)]/88 p-5 shadow-[var(--shadow-sm)] backdrop-blur-xl transition-all duration-300",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={clsx(
        "text-lg font-semibold tracking-[-0.02em] text-[color:var(--foreground)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={clsx(
        "text-sm leading-6 text-[color:var(--muted)]",
        className,
      )}
      {...props}
    />
  );
}
