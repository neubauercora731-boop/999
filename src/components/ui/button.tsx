import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

type ButtonTone = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const toneClasses: Record<ButtonTone, string> = {
  primary:
    "border border-[rgba(255,255,255,0.14)] bg-[linear-gradient(135deg,var(--primary),var(--primary-deep))] text-[color:var(--primary-foreground)] shadow-[var(--shadow-sm)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]",
  secondary:
    "border border-[color:var(--border-strong)] bg-[rgba(255,252,248,0.88)] text-[color:var(--foreground)] shadow-[0_10px_24px_rgba(27,17,10,0.06)] hover:-translate-y-0.5 hover:bg-white",
  ghost:
    "border border-transparent bg-transparent text-[color:var(--foreground)] hover:border-[color:var(--border)] hover:bg-white/65",
  danger:
    "border border-transparent bg-[color:var(--danger)] text-white shadow-[var(--shadow-sm)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-10 rounded-full px-4 text-sm",
  md: "h-11 rounded-full px-5 text-sm",
  lg: "h-12 rounded-full px-6 text-base",
};

type CommonProps = {
  tone?: ButtonTone;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
};

type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>;
type LinkButtonProps = CommonProps & AnchorHTMLAttributes<HTMLAnchorElement>;

export function Button({
  tone = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={clsx(
        "inline-flex items-center justify-center gap-2 font-medium tracking-[0.01em] transition-all duration-200",
        "disabled:pointer-events-none disabled:opacity-50",
        toneClasses[tone],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  );
}

export function ButtonLink({
  tone = "primary",
  size = "md",
  className,
  ...props
}: LinkButtonProps) {
  return (
    <a
      className={clsx(
        "inline-flex items-center justify-center gap-2 font-medium tracking-[0.01em] transition-all duration-200",
        toneClasses[tone],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  );
}
