"use client";

import { useEffect, useState } from "react";

import {
  Badge,
  Button,
  ButtonLink,
  Card,
  CardDescription,
  CardTitle,
} from "@/components/ui";
import {
  defaultExecutionSteps,
  ExecutionStatusPanel,
  type ExecutionStep,
} from "@/components/task/execution-status-panel";
import {
  demoAnalysisSteps,
  demoPythonCode,
  demoReport,
  demoRunResult,
  demoTaskRequirement,
} from "@/lib/demo/lab-demo";

function getDemoSteps(started: boolean, phase: number): ExecutionStep[] {
  const sequence = ["understand", "plan", "code", "run", "report", "done"];

  return defaultExecutionSteps.map((step) => {
    const index = sequence.indexOf(step.id);

    if (!started) {
      return { ...step, status: "waiting" };
    }

    if (phase >= 6 || index < phase) {
      return {
        ...step,
        status: "success",
        detail:
          step.id === "done" && phase >= 6
            ? "体验流程已完成。正式登录后可以保存任务历史和继续编辑报告。"
            : undefined,
      };
    }

    if (index === phase) {
      return { ...step, status: "running" };
    }

    return { ...step, status: "waiting" };
  });
}

export function DemoWorkflow() {
  const [started, setStarted] = useState(false);
  const [phase, setPhase] = useState(0);
  const [copied, setCopied] = useState<"code" | "report" | null>(null);
  const steps = getDemoSteps(started, phase);

  useEffect(() => {
    if (!started || phase >= 6) {
      return;
    }

    const timer = window.setTimeout(() => {
      setPhase((current) => Math.min(current + 1, 6));
    }, phase === 0 ? 650 : 850);

    return () => window.clearTimeout(timer);
  }, [phase, started]);

  function startDemo() {
    setStarted(true);
    setPhase(0);
    setCopied(null);
  }

  async function copyText(type: "code" | "report", text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    window.setTimeout(() => setCopied(null), 1800);
  }

  const isComplete = phase >= 6;

  return (
    <div className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
      <div className="space-y-5">
        <Card className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge tone="primary">免登录 Demo</Badge>
            <Badge tone="accent">Mock 数据</Badge>
          </div>
          <div>
            <CardTitle className="text-2xl">体验模式</CardTitle>
            <CardDescription className="mt-2">
              当前为体验模式，不保存到数据库。登录后可以创建正式任务、保存历史和继续编辑报告。
            </CardDescription>
          </div>
          <div className="rounded-[1.1rem] border border-[color:var(--border)] bg-white/70 p-4">
            <p className="text-sm font-semibold text-[color:var(--foreground)]">
              默认任务要求
            </p>
            <p className="mt-2 text-sm leading-7 text-[color:var(--foreground-soft)]">
              {demoTaskRequirement}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={startDemo}>
              {started && !isComplete ? "重新演示" : "开始 Demo 流程"}
            </Button>
            <ButtonLink href="/auth" tone="secondary">
              登录保存任务
            </ButtonLink>
          </div>
        </Card>

        <ExecutionStatusPanel steps={steps} />
      </div>

      <div className="space-y-5">
        <Card className="space-y-4">
          <CardTitle>AI 拆解步骤</CardTitle>
          <div className="grid gap-3">
            {demoAnalysisSteps.map((step, index) => (
              <div
                key={step}
                className="rounded-[1rem] border border-[color:var(--border)] bg-white/65 px-4 py-3 text-sm leading-6"
              >
                <span className="mr-3 text-[color:var(--accent)]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {step}
              </div>
            ))}
          </div>
        </Card>

        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>生成的 Python 代码</CardTitle>
              <CardDescription className="mt-2">
                Demo 展示稳定示例，正式任务会根据你的要求生成代码。
              </CardDescription>
            </div>
            <Button
              tone="secondary"
              onClick={() => copyText("code", demoPythonCode)}
            >
              {copied === "code" ? "已复制" : "复制代码"}
            </Button>
          </div>
          <pre className="max-h-[420px] overflow-auto rounded-[1rem] bg-[#111111] p-4 font-mono text-xs leading-6 text-white">
            {demoPythonCode}
          </pre>
        </Card>

        <div className="grid gap-5 lg:grid-cols-[0.86fr_1.14fr]">
          <Card className="space-y-4">
            <CardTitle>模拟运行结果</CardTitle>
            <pre className="min-h-40 overflow-auto rounded-[1rem] bg-[#111111] p-4 font-mono text-xs leading-6 text-white">
              {demoRunResult}
            </pre>
          </Card>

          <Card className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>实验报告文本</CardTitle>
              <Button
                tone="secondary"
                onClick={() => copyText("report", demoReport)}
              >
                {copied === "report" ? "已复制" : "复制报告"}
              </Button>
            </div>
            <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap rounded-[1rem] border border-[color:var(--border)] bg-white/74 p-4 font-mono text-xs leading-6 text-[color:var(--foreground-soft)]">
              {demoReport}
            </pre>
          </Card>
        </div>
      </div>
    </div>
  );
}
