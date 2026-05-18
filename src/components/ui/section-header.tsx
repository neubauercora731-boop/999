import type { ReactNode } from "react";

import { Badge } from "./badge";

export interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  badge?: string;
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
  badge,
}: SectionHeaderProps) {
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-3">
        {eyebrow ? (
          <div className="flex items-center gap-3">
            <span className="h-px w-10 bg-[color:var(--accent)]" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[color:var(--accent)]">
              {eyebrow}
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-3xl font-semibold tracking-[-0.04em] text-[color:var(--foreground)] sm:text-4xl">
            {title}
          </h2>
          {badge ? <Badge tone="primary">{badge}</Badge> : null}
        </div>

        {description ? (
          <p className="max-w-3xl text-sm leading-7 text-[color:var(--muted)] sm:text-base">
            {description}
          </p>
        ) : null}
      </div>

      {action ? <div className="flex shrink-0 items-center gap-3">{action}</div> : null}
    </div>
  );
}
