import type { HTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

import { ShellNav } from "./shell-nav";

export function AppShell({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-drift absolute left-[-7rem] top-[-6rem] h-72 w-72 rounded-full bg-[color:var(--primary-soft)] blur-3xl" />
        <div className="animate-drift-slow absolute right-[-6rem] top-24 h-80 w-80 rounded-full bg-[color:var(--accent-soft)] blur-3xl" />
        <div className="absolute inset-x-0 top-24 h-px bg-gradient-to-r from-transparent via-[rgba(23,20,17,0.08)] to-transparent" />
      </div>

      <div className="relative px-3 py-3 sm:px-4 sm:py-4 lg:px-6">
        <div className="mx-auto max-w-[1480px]">
          <div className="relative overflow-hidden rounded-[2rem] border border-[color:var(--border-strong)] bg-[color:var(--shell)] shadow-[var(--shadow-shell)] backdrop-blur-xl">
            <div className="absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent" />

            <header className="paper-rule relative border-b border-[color:var(--border)]/90 bg-white/45 backdrop-blur-xl">
              <AppFrame className="flex flex-col gap-4 py-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-[1.4rem] border border-[color:var(--border-strong)] bg-[linear-gradient(145deg,rgba(255,255,255,0.94),rgba(255,245,232,0.86))] text-[color:var(--foreground)] shadow-[var(--shadow-sm)]">
                    <span className="font-display text-xl font-semibold">L</span>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[color:var(--accent)]">
                      Scientific Editorial
                    </p>
                    <p className="text-base font-semibold text-[color:var(--foreground)] sm:text-lg">
                      实验报告自动化助手
                    </p>
                  </div>
                </div>

                <ShellNav />

                <div className="hidden items-center gap-3 lg:flex">
                  <div className="rounded-full border border-[color:var(--border)] bg-white/55 px-4 py-2 text-xs font-medium tracking-[0.16em] text-[color:var(--muted)]">
                    Student Workspace
                  </div>
                </div>
              </AppFrame>
            </header>

            <main className={clsx("relative", className)} {...props}>
              {children}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AppFrame({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "mx-auto w-full max-w-[1280px] px-5 sm:px-7 lg:px-10",
        className,
      )}
      {...props}
    />
  );
}

export function AppSection({
  className,
  ...props
}: HTMLAttributes<HTMLElement>) {
  return <section className={clsx("py-8 sm:py-10", className)} {...props} />;
}

export function AppToolbar({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "rounded-[1.6rem] border border-[color:var(--border)] bg-[color:var(--surface-solid)]/85 px-5 py-4 shadow-[var(--shadow-sm)] backdrop-blur-xl",
        "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
      {...props}
    />
  );
}

export function AppGrid({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx("grid gap-5 sm:grid-cols-2 xl:grid-cols-3", className)}
      {...props}
    />
  );
}

export function HeroPanel({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div
      className={clsx(
        "relative overflow-hidden rounded-[2.2rem] border border-[color:var(--border-strong)] bg-[linear-gradient(180deg,rgba(255,252,247,0.96),rgba(248,240,230,0.92))] p-6 shadow-[var(--shadow-lg)] sm:p-8 lg:p-12",
        className,
      )}
      {...props}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(38,71,210,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(202,107,57,0.12),transparent_32%)]" />
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[color:var(--primary)] via-[color:var(--accent)] to-[color:var(--success)]" />
      <div className="absolute right-[-4rem] top-[-4rem] h-44 w-44 rounded-full border border-white/60 bg-white/40 blur-2xl" />
      <div className="absolute bottom-[-5rem] left-[-4rem] h-48 w-48 rounded-full border border-white/55 bg-[color:var(--primary-soft)] blur-3xl" />
      <div className="relative">{children}</div>
    </div>
  );
}
