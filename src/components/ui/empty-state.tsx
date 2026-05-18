import type { ReactNode } from "react";

import { ButtonLink } from "./button";
import { Card } from "./card";

export interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  icon?: ReactNode;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  icon,
}: EmptyStateProps) {
  return (
    <Card className="flex flex-col items-start gap-4 p-6 sm:p-8">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--primary-soft)] text-[color:var(--primary)]">
        {icon ?? (
          <span className="text-lg font-semibold" aria-hidden="true">
            i
          </span>
        )}
      </div>
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-[color:var(--foreground)]">{title}</h3>
        <p className="max-w-xl text-sm leading-6 text-[color:var(--muted)]">{description}</p>
      </div>
      {actionLabel && actionHref ? (
        <ButtonLink href={actionHref} size="md" tone="primary">
          {actionLabel}
        </ButtonLink>
      ) : null}
    </Card>
  );
}
