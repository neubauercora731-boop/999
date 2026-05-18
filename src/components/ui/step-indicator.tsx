import clsx from "clsx";

export interface StepIndicatorProps {
  steps: string[];
  activeStep: number;
  completedSteps?: number;
}

export function StepIndicator({
  steps,
  activeStep,
  completedSteps = activeStep,
}: StepIndicatorProps) {
  return (
    <ol className="grid gap-3 lg:grid-cols-5">
      {steps.map((step, index) => {
        const isActive = index === activeStep;
        const isComplete = index < completedSteps;
        const isFuture = !isActive && !isComplete;

        return (
          <li key={step} className="relative">
            {index < steps.length - 1 ? (
              <span className="absolute left-[calc(50%+2.2rem)] right-[-0.9rem] top-5 hidden h-px bg-gradient-to-r from-[color:var(--border-strong)] to-transparent lg:block" />
            ) : null}

            <div
              className={clsx(
                "rounded-[1.5rem] border px-4 py-4 shadow-[var(--shadow-sm)] transition-all duration-300",
                isActive
                  ? "border-[color:var(--border-strong)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(236,241,255,0.88))]"
                  : isComplete
                    ? "border-[color:var(--border)] bg-[color:var(--surface-strong)]"
                    : "border-[color:var(--border)] bg-white/45",
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={clsx(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                    isComplete
                      ? "bg-[color:var(--primary)] text-[color:var(--primary-foreground)]"
                      : isActive
                        ? "border border-[color:var(--border-strong)] bg-white text-[color:var(--primary)]"
                        : "border border-[color:var(--border)] bg-white/75 text-[color:var(--muted)]",
                  )}
                >
                  {isComplete ? "✓" : String(index + 1).padStart(2, "0")}
                </div>

                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-semibold leading-6 text-[color:var(--foreground)]">
                    {step}
                  </p>
                  <p
                    className={clsx(
                      "text-[11px] font-semibold tracking-[0.18em]",
                      isActive
                        ? "text-[color:var(--primary)]"
                        : isFuture
                          ? "text-[color:var(--muted)]"
                          : "text-[color:var(--success)]",
                    )}
                  >
                    {isActive ? "CURRENT" : isFuture ? "PENDING" : "DONE"}
                  </p>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
