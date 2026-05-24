import type { HTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

import { ShellNav } from "./shell-nav";

export function AppShell({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <div className="relative min-h-screen">
      <div className="relative px-3 py-3 sm:px-4 sm:py-4 lg:px-6">
        <div className="mx-auto max-w-[1480px]">
          <div className="overflow-hidden rounded-2xl border border-[color:var(--border-strong)] bg-[color:var(--shell)] shadow-[var(--shadow-shell)] backdrop-blur-xl">
            <header className="paper-rule border-b border-[color:var(--border)]/90 bg-white/82 backdrop-blur-xl">
              <AppFrame className="flex flex-col gap-4 py-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[color:var(--border-strong)] bg-white text-[color:var(--primary)] shadow-[var(--shadow-sm)]">
                    <span className="font-display text-lg font-semibold">L</span>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--accent)]">
                      Lab Workflow
                    </p>
                    <p className="text-base font-semibold text-[color:var(--foreground)] sm:text-lg">
                      实验报告自动化助手
                    </p>
                  </div>
                </div>

                <ShellNav />

                <div className="hidden items-center gap-3 lg:flex">
                  <div className="rounded-full border border-[color:var(--border)] bg-white/72 px-4 py-2 text-xs font-medium tracking-[0.12em] text-[color:var(--muted)]">
                    Agent Delivery
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
        "rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-solid)]/90 px-5 py-4 shadow-[var(--shadow-sm)] backdrop-blur-xl",
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
        "relative overflow-hidden rounded-xl border border-[color:var(--border-strong)] bg-white/90 p-6 shadow-[var(--shadow-lg)] sm:p-8 lg:p-10",
        className,
      )}
      {...props}
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-[color:var(--primary)]" />
      <div className="relative">{children}</div>
    </div>
  );
}
