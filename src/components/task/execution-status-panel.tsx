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
  waiting: { label: "未开始", tone: "neutral" },
  running: { label: "进行中", tone: "primary" },
  success: { label: "已完成", tone: "success" },
  error: { label: "失败", tone: "danger" },
};

export const defaultExecutionSteps = [
  {
    id: "understand",
    title: "理解实验要求",
    description: "读取任务目标、报告章节、交付边界和截图要求。",
  },
  {
    id: "plan",
    title: "拆解任务步骤",
    description: "把实验要求整理成可执行的代码、运行和报告步骤。",
  },
  {
    id: "code",
    title: "生成实验代码",
    description: "生成可运行、可解释的实验代码。",
  },
  {
    id: "run",
    title: "真实运行并验证结果",
    description: "捕获 stdout、stderr、exitCode 和 runtime 作为证据。",
  },
  {
    id: "report",
    title: "整理实验报告",
    description: "基于任务、代码、运行结果和截图证据整理报告草稿。",
  },
  {
    id: "done",
    title: "完成交付准备",
    description: "用户可以继续编辑、保存或导出 DOCX。",
  },
] as const;

export function createWaitingExecutionSteps(): ExecutionStep[] {
  return defaultExecutionSteps.map((step) => ({
    ...step,
    status: "waiting",
  }));
}

export const agentExecutionSteps = [
  {
    id: "analyze",
    title: "任务分析",
    description: "读取原始要求、上传材料和已确认的结构化信息。",
  },
  {
    id: "plan",
    title: "执行计划",
    description: "拆成代码生成、真实运行、截图证据、报告整理和导出步骤。",
  },
  {
    id: "code",
    title: "代码生成",
    description: "优先生成单文件 main.py，避免不必要的交互输入。",
  },
  {
    id: "run",
    title: "真实运行",
    description: "捕获 stdout、stderr、耗时、错误类型和截图证据。",
  },
  {
    id: "debug",
    title: "自动修复一次",
    description: "首次运行失败时，根据错误信息尝试生成完整修复代码。",
  },
  {
    id: "rerun",
    title: "重新运行",
    description: "如果修复成功，再运行修复后的代码并保留结果。",
  },
  {
    id: "report",
    title: "报告草稿",
    description: "报告必须引用真实 stdout 和截图状态。",
  },
  {
    id: "save",
    title: "保存结果",
    description: "保存代码、运行证据、调试说明和报告草稿。",
  },
  {
    id: "done",
    title: "交付准备完成",
    description: "可以进行质量检查并导出 DOCX。",
  },
] as const;

export function createWaitingAgentExecutionSteps(): ExecutionStep[] {
  return agentExecutionSteps.map((step) => ({
    ...step,
    status: "waiting",
  }));
}

export function ExecutionStatusPanel({
  title = "Agent 执行进度",
  description = "系统会把任务拆成清晰步骤；失败时停在对应步骤并保留原因。",
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
                "grid gap-3 rounded-lg border px-4 py-4 transition",
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
                <p className="rounded-lg bg-white/70 px-3 py-2 text-sm leading-6 text-[color:var(--foreground-soft)]">
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
