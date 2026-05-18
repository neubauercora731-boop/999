import clsx from "clsx";

import { Badge, Card, CardDescription, CardTitle } from "@/components/ui";

export type ExecutionStepStatus = "waiting" | "running" | "success" | "error";

export interface ExecutionStep {
  id: string;
  title: string;
  description?: string;
  status: ExecutionStepStatus;
  detail?: string;
}

const statusMeta: Record<
  ExecutionStepStatus,
  { label: string; tone: "neutral" | "primary" | "success" | "danger" }
> = {
  waiting: { label: "等待中", tone: "neutral" },
  running: { label: "执行中", tone: "primary" },
  success: { label: "已完成", tone: "success" },
  error: { label: "失败", tone: "danger" },
};

export const defaultExecutionSteps = [
  {
    id: "understand",
    title: "正在理解实验要求...",
    description: "读取任务目标、报告章节和交付边界。",
  },
  {
    id: "plan",
    title: "正在拆解任务步骤...",
    description: "把实验要求整理为可执行的代码与报告步骤。",
  },
  {
    id: "code",
    title: "正在生成实验代码...",
    description: "生成可运行、可解释的 Python 实验代码。",
  },
  {
    id: "run",
    title: "正在运行代码并验证结果...",
    description: "保留 stdout/stderr 作为实验结果证据。",
  },
  {
    id: "report",
    title: "正在整理实验报告...",
    description: "把任务要求、代码、结果和分析整理为报告草稿。",
  },
  {
    id: "done",
    title: "已完成",
    description: "用户可以继续编辑、复制或导出报告。",
  },
] as const;

export function createWaitingExecutionSteps(): ExecutionStep[] {
  return defaultExecutionSteps.map((step) => ({
    ...step,
    status: "waiting",
  }));
}

export function ExecutionStatusPanel({
  title = "AI 执行进度",
  description = "系统会把任务拆成清楚的执行步骤，失败时停在对应步骤并给出原因。",
  steps,
}: {
  title?: string;
  description?: string;
  steps: ExecutionStep[];
}) {
  return (
    <Card className="space-y-5">
      <div className="space-y-2">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </div>

      <div className="space-y-3">
        {steps.map((step, index) => {
          const meta = statusMeta[step.status];

          return (
            <div
              key={step.id}
              className={clsx(
                "grid gap-3 rounded-[1.1rem] border px-4 py-4 transition",
                step.status === "running"
                  ? "border-[color:var(--primary)]/35 bg-[color:var(--primary-soft)]"
                  : "border-[color:var(--border)] bg-white/64",
                step.status === "error" &&
                  "border-[color:var(--danger)]/35 bg-[color:var(--danger-soft)]",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span
                    className={clsx(
                      "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      step.status === "success" &&
                        "bg-[color:var(--success)] text-white",
                      step.status === "running" &&
                        "bg-[color:var(--primary)] text-white",
                      step.status === "error" &&
                        "bg-[color:var(--danger)] text-white",
                      step.status === "waiting" &&
                        "border border-[color:var(--border)] bg-white text-[color:var(--muted)]",
                    )}
                  >
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-semibold text-[color:var(--foreground)]">
                      {step.title}
                    </p>
                    {step.description ? (
                      <p className="mt-1 text-sm leading-6 text-[color:var(--muted)]">
                        {step.description}
                      </p>
                    ) : null}
                  </div>
                </div>
                <Badge tone={meta.tone}>{meta.label}</Badge>
              </div>

              {step.detail ? (
                <p className="rounded-[0.9rem] bg-white/62 px-3 py-2 text-sm leading-6 text-[color:var(--foreground-soft)]">
                  {step.detail}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
