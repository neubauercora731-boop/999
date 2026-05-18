"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Badge, Button, ButtonLink, Card, CardDescription, CardTitle } from "@/components/ui";
import {
  agentExecutionSteps,
  createWaitingAgentExecutionSteps,
  ExecutionStatusPanel,
  type ExecutionStep,
} from "@/components/task/execution-status-panel";
import type { AgentWorkflowResult, DebugResult, RunResult } from "@/lib/agent/types";
import type { ParsedRequirement } from "@/lib/ai/types";
import {
  getFriendlyApiErrorMessage,
  readJsonSafely,
  toUserFriendlyErrorMessage,
} from "@/lib/utils";

interface WorkbenchProps {
  taskId: string;
  analysis: ParsedRequirement | null;
  initialCode: string;
  initialStdout: string;
  initialStderr: string;
  initialReport: string;
  taskInputSummary: string;
}

type WorkbenchRunResult = RunResult & {
  exitCode?: number | null;
  timedOut?: boolean;
  message?: string;
};

type CopyTarget = "code" | "report" | "stdout" | "stderr" | "debug";

const boxClass =
  "w-full rounded-[1rem] border border-[color:var(--border)] bg-white/80 px-4 py-3 text-sm outline-none focus:border-[color:var(--border-strong)] focus:ring-4 focus:ring-[color:var(--ring)]";

function initialExecutionSteps({
  hasAnalysis,
  hasCode,
  hasRun,
  hasReport,
}: {
  hasAnalysis: boolean;
  hasCode: boolean;
  hasRun: boolean;
  hasReport: boolean;
}): ExecutionStep[] {
  return agentExecutionSteps.map((step) => {
    if ((step.id === "analyze" || step.id === "plan") && hasAnalysis) {
      return { ...step, status: "success" };
    }
    if (step.id === "code" && hasCode) {
      return { ...step, status: "success" };
    }
    if (step.id === "run" && hasRun) {
      return { ...step, status: "success" };
    }
    if ((step.id === "report" || step.id === "save" || step.id === "done") && hasReport) {
      return { ...step, status: "success" };
    }
    return { ...step, status: "waiting" };
  });
}

function runDetail(result: WorkbenchRunResult | null) {
  if (!result) return "暂未运行。";
  if (result.success) {
    return `运行成功，耗时 ${result.runtimeMs || 0}ms。`;
  }
  if (result.errorType === "environment_error") {
    return "当前线上环境暂不支持真实 Python 运行，已生成未验证版本报告。";
  }
  if (result.errorType === "timeout") {
    return "代码运行超时，可能存在死循环或任务过长。";
  }
  if (result.errorType === "security_blocked") {
    return "代码包含潜在危险操作，系统已阻止运行。";
  }
  return "代码运行失败，请展开技术详情查看 stderr。";
}

function stageToStep(stage: string) {
  const map: Record<string, string> = {
    analyze: "analyze",
    generate_code: "code",
    run_code: "run",
    debug_code: "debug",
    rerun_code: "rerun",
    generate_report: "report",
    completed: "done",
  };

  return map[stage] ?? "done";
}

export function Workbench({
  taskId,
  analysis,
  initialCode,
  initialStdout,
  initialStderr,
  initialReport,
  taskInputSummary,
}: WorkbenchProps) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [stdout, setStdout] = useState(initialStdout);
  const [stderr, setStderr] = useState(initialStderr);
  const [report, setReport] = useState(initialReport);
  const [firstRun, setFirstRun] = useState<WorkbenchRunResult | null>(null);
  const [finalRun, setFinalRun] = useState<WorkbenchRunResult | null>(
    initialStdout || initialStderr
      ? {
          success: Boolean(initialStdout && !initialStderr),
          stdout: initialStdout,
          stderr: initialStderr,
          runtimeMs: 0,
          errorType: initialStderr ? "runtime_error" : undefined,
        }
      : null,
  );
  const [debugResult, setDebugResult] = useState<DebugResult | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<CopyTarget | null>(null);
  const [executionSteps, setExecutionSteps] = useState<ExecutionStep[]>(
    initialExecutionSteps({
      hasAnalysis: Boolean(analysis),
      hasCode: Boolean(initialCode),
      hasRun: Boolean(initialStdout || initialStderr),
      hasReport: Boolean(initialReport),
    }),
  );

  function setStepStatus(id: string, status: ExecutionStep["status"], detail?: string) {
    setExecutionSteps((current) =>
      current.map((step) =>
        step.id === id
          ? {
              ...step,
              status,
              detail,
            }
          : step,
      ),
    );
  }

  function markRunning(id: string, detail?: string) {
    setExecutionSteps((current) =>
      current.map((step) =>
        step.id === id
          ? { ...step, status: "running", detail }
          : step.status === "running"
            ? { ...step, status: "waiting", detail: undefined }
            : step,
      ),
    );
  }

  function startOptimisticAgentProgress() {
    const sequence: Array<[number, string, ExecutionStep["status"], string | undefined]> = [
      [0, "analyze", "running", "正在分析任务要求..."],
      [700, "analyze", "success", "任务要求已读取。"],
      [800, "plan", "running", "正在拆解实验步骤..."],
      [1500, "plan", "success", "执行计划已形成。"],
      [1600, "code", "running", "正在生成 main.py..."],
      [3300, "code", "success", "代码生成请求已提交。"],
      [3400, "run", "running", "正在运行并捕获 stdout/stderr..."],
      [5200, "debug", "running", "如果首次运行失败，将自动修复一次。"],
      [7000, "report", "running", "正在整理报告草稿..."],
    ];

    const timers = sequence.map(([delay, id, status, detail]) =>
      window.setTimeout(() => setStepStatus(id, status, detail), delay),
    );

    return () => timers.forEach(window.clearTimeout);
  }

  async function post<T>(endpoint: string, body: unknown = {}, fallbackMessage = "操作失败。") {
    setPending(endpoint);
    setError(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await readJsonSafely<T & { error?: string }>(response.clone());
      if (!response.ok) {
        throw new Error(await getFriendlyApiErrorMessage(response, fallbackMessage));
      }
      router.refresh();
      return payload;
    } catch (actionError) {
      const message = toUserFriendlyErrorMessage(actionError, fallbackMessage);
      setError(message);
      throw new Error(message);
    } finally {
      setPending(null);
    }
  }

  function applyAgentResult(payload: AgentWorkflowResult | null) {
    if (!payload) return;

    if (payload.generatedCode?.code) {
      setCode(payload.generatedCode.code);
    }
    if (payload.firstRun) {
      setFirstRun(payload.firstRun as WorkbenchRunResult);
    }
    if (payload.debugResult) {
      setDebugResult(payload.debugResult);
      if (payload.debugResult.fixedCode) {
        setCode(payload.debugResult.fixedCode);
      }
    }
    if (payload.finalRun) {
      const final = payload.finalRun as WorkbenchRunResult;
      setFinalRun(final);
      setStdout(final.stdout || "");
      setStderr(final.stderr || "");
    }
    if (payload.reportMarkdown) {
      setReport(payload.reportMarkdown);
    }

    const next = createWaitingAgentExecutionSteps();
    const set = (id: string, status: ExecutionStep["status"], detail?: string) => {
      const index = next.findIndex((step) => step.id === id);
      if (index >= 0) next[index] = { ...next[index], status, detail };
    };

    set("analyze", payload.plan ? "success" : "waiting", payload.plan?.title);
    set("plan", payload.plan ? "success" : "waiting", payload.plan?.steps?.join(" / "));
    set("code", payload.generatedCode ? "success" : "waiting", payload.generatedCode?.filename);

    if (payload.firstRun) {
      set(
        "run",
        payload.firstRun.success || payload.firstRun.errorType === "environment_error"
          ? "success"
          : "error",
        runDetail(payload.firstRun as WorkbenchRunResult),
      );
    }

    if (payload.firstRun && !payload.firstRun.success && payload.firstRun.errorType !== "environment_error") {
      set(
        "debug",
        payload.debugResult?.fixed ? "success" : "error",
        payload.debugResult?.fixed
          ? "代码已修复，正在重新运行。"
          : payload.debugResult?.reason || "自动修复失败。",
      );
    } else if (payload.firstRun) {
      set("debug", "success", "本次未触发自动修复。");
    }

    if (payload.debugResult?.fixed && payload.finalRun) {
      set(
        "rerun",
        payload.finalRun.success ? "success" : "error",
        runDetail(payload.finalRun as WorkbenchRunResult),
      );
    } else if (payload.firstRun) {
      set("rerun", "success", "本次无需重新运行。");
    }

    if (payload.reportMarkdown) {
      set("report", "success", "报告草稿已生成。");
      set("save", "success", "报告草稿和运行证据已保存。");
    }

    set(
      "done",
      payload.success ? "success" : "error",
      payload.success ? "一键流程已完成。" : payload.errorMessage || "流程未完全成功。",
    );

    if (!payload.success) {
      const failedStep = stageToStep(payload.stage);
      set(failedStep, "error", payload.errorMessage || "该阶段未完全成功。");
      setError(payload.errorMessage || "流程未完全成功，请查看页面结果。");
    }

    setExecutionSteps(next);
  }

  async function generateCode() {
    setStepStatus("analyze", "success");
    setStepStatus("plan", "success");
    markRunning("code", "正在生成 main.py...");

    try {
      const payload = await post<{ code: string }>(
        `/api/tasks/${taskId}/generate-code`,
        {},
        "代码生成失败，请调整任务要求后重试。",
      );
      if (payload?.code) {
        setCode(payload.code);
        setStepStatus("code", "success", "实验代码已生成，可继续编辑后运行。");
      }
      return payload?.code ?? "";
    } catch (actionError) {
      const message = toUserFriendlyErrorMessage(actionError, "代码生成失败，请调整任务要求后重试。");
      setStepStatus("code", "error", message);
      return "";
    }
  }

  async function runCode(codeToRun = code) {
    setStepStatus("code", "success");
    markRunning("run", "正在运行并保存 stdout/stderr...");

    try {
      const payload = await post<WorkbenchRunResult>(
        `/api/tasks/${taskId}/run-code`,
        { code: codeToRun },
        "代码运行失败，请查看错误信息。",
      );

      const result = payload;
      setFinalRun(result);
      setStdout(result?.stdout || "");
      setStderr(result?.stderr || "");

      if (!result?.success) {
        const message = runDetail(result);
        setError(message);
        setStepStatus(
          "run",
          result?.errorType === "environment_error" ? "success" : "error",
          message,
        );
        return result;
      }

      setStepStatus("run", "success", runDetail(result));
      return result;
    } catch (actionError) {
      const message = toUserFriendlyErrorMessage(actionError, "代码运行失败，请查看错误信息。");
      setStepStatus("run", "error", message);
      return null;
    }
  }

  async function generateReport() {
    markRunning("report", "正在基于代码和运行结果整理报告...");

    try {
      const payload = await post<{ reportMarkdown: string }>(
        `/api/tasks/${taskId}/generate-report`,
        {},
        "报告生成失败，请重新生成。",
      );
      if (payload?.reportMarkdown) {
        setReport(payload.reportMarkdown);
        setStepStatus("report", "success", "报告草稿已整理。");
        setStepStatus("save", "success", "报告草稿已保存到任务输出。");
        setStepStatus("done", "success", "任务闭环已完成。");
      }
      return payload?.reportMarkdown ?? "";
    } catch (actionError) {
      const message = toUserFriendlyErrorMessage(actionError, "报告生成失败，请重新生成。");
      setStepStatus("report", "error", message);
      return "";
    }
  }

  async function runAgentFlow() {
    setError(null);
    setPending("agent-flow");
    setExecutionSteps(createWaitingAgentExecutionSteps());
    const stopProgress = startOptimisticAgentProgress();

    try {
      const response = await fetch(`/api/tasks/${taskId}/run-agent-workflow`, {
        method: "POST",
      });
      const payload = await readJsonSafely<AgentWorkflowResult & { error?: string }>(response.clone());
      if (!response.ok) {
        throw new Error(await getFriendlyApiErrorMessage(response, "系统出现未知错误，请稍后重试。"));
      }
      applyAgentResult(payload);
      router.refresh();
    } catch (actionError) {
      const message = toUserFriendlyErrorMessage(actionError, "系统出现未知错误，请稍后重试。");
      setError(message);
      setStepStatus("done", "error", message);
    } finally {
      stopProgress();
      setPending(null);
    }
  }

  async function saveReport() {
    try {
      const payload = await post<{ reportMarkdown: string }>(
        `/api/tasks/${taskId}/save-report`,
        { markdown: report },
        "报告保存失败，请稍后重试。",
      );
      if (payload?.reportMarkdown) setReport(payload.reportMarkdown);
    } catch {
      // Error is already shown by post().
    }
  }

  async function copyText(type: CopyTarget, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(type);
    window.setTimeout(() => setCopied(null), 1800);
  }

  const isBusy = pending !== null;

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-[1rem] border border-[color:var(--danger)]/30 bg-[color:var(--danger-soft)] px-4 py-3 text-sm leading-6 text-[color:var(--danger)]">
          {error}
        </div>
      ) : null}

      <Card className="space-y-5 border-[color:var(--primary)]/25 bg-white/92">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl space-y-2">
            <div className="flex flex-wrap gap-2">
              <Badge tone="primary">P1 Agent 执行流</Badge>
              <Badge tone={analysis ? "success" : "warning"}>
                {analysis ? "分析已就绪" : "等待分析"}
              </Badge>
            </div>
            <CardTitle className="text-2xl">一键生成并验证报告</CardTitle>
            <CardDescription>
              系统会按“需求理解 → 任务规划 → 代码生成 → 运行验证 → 报错修复 → 再次运行 → 报告生成 → 结果保存”的顺序执行。
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="lg" onClick={runAgentFlow} disabled={!analysis || isBusy}>
              {pending === "agent-flow" ? "Agent 执行中..." : "一键生成并验证报告"}
            </Button>
            <ButtonLink href="/tasks" tone="secondary" size="lg">
              返回我的任务
            </ButtonLink>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[0.78fr_1.22fr_0.92fr]">
        <Card className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>任务理解</CardTitle>
              <CardDescription className="mt-2">
                正式任务会基于已确认的分析结果生成代码和报告。
              </CardDescription>
            </div>
            <Badge tone={analysis ? "success" : "warning"}>
              {analysis ? "已确认" : "待确认"}
            </Badge>
          </div>
          {analysis ? (
            <div className="space-y-4 text-sm leading-7 text-[color:var(--foreground-soft)]">
              {taskInputSummary ? (
                <div>
                  <p className="font-semibold text-[color:var(--foreground)]">原始任务要求</p>
                  <p className="mt-1 line-clamp-6 rounded-[1rem] border border-[color:var(--border)] bg-white/65 p-3">
                    {taskInputSummary}
                  </p>
                </div>
              ) : null}
              <div>
                <p className="font-semibold text-[color:var(--foreground)]">实验名称</p>
                <p>{analysis.experiment_title}</p>
              </div>
              <div>
                <p className="font-semibold text-[color:var(--foreground)]">实验目的</p>
                <p>{analysis.purpose}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="font-semibold text-[color:var(--foreground)]">任务类型</p>
                  <p>{analysis.task_type || "python_lab"}</p>
                </div>
                <div>
                  <p className="font-semibold text-[color:var(--foreground)]">语言</p>
                  <p>{analysis.language || "Python"}</p>
                </div>
              </div>
              <div>
                <p className="font-semibold text-[color:var(--foreground)]">实验代码任务</p>
                <ol className="mt-2 space-y-2">
                  {analysis.coding_tasks.map((task, index) => (
                    <li key={`${task.task_name}-${index}`}>
                      {index + 1}. {task.task_name}: {task.description}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          ) : (
            <ButtonLink href={`/tasks/${taskId}/analysis`}>去分析任务</ButtonLink>
          )}
        </Card>

        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Python 代码</CardTitle>
              <CardDescription className="mt-2">
                P1 优先生成单文件 main.py，默认使用内置示例数据，不依赖 input()。
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {code.trim() ? (
                <Button tone="secondary" onClick={() => copyText("code", code)}>
                  {copied === "code" ? "已复制" : "复制代码"}
                </Button>
              ) : null}
              <Button onClick={generateCode} disabled={!analysis || isBusy}>
                {pending?.includes("generate-code") ? "生成中..." : "生成代码"}
              </Button>
            </div>
          </div>
          <textarea
            className={`${boxClass} min-h-[420px] resize-y font-mono`}
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="# 生成或粘贴 Python 代码"
          />
        </Card>

        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>最终运行结果</CardTitle>
              <CardDescription className="mt-2">
                stdout 会直接进入报告；stderr 只放在技术详情中。
              </CardDescription>
            </div>
            <Button onClick={() => runCode()} disabled={!code.trim() || isBusy}>
              {pending?.includes("run-code") ? "运行中..." : "运行代码"}
            </Button>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">stdout</p>
              {stdout ? (
                <Button tone="ghost" size="sm" onClick={() => copyText("stdout", stdout)}>
                  {copied === "stdout" ? "已复制" : "复制"}
                </Button>
              ) : null}
            </div>
            <pre className="min-h-48 overflow-auto rounded-[1rem] bg-[#111] p-4 text-xs leading-6 text-white">
              {stdout || "暂无 stdout"}
            </pre>

            <details className="rounded-[1rem] border border-[color:var(--border)] bg-white/68 p-3">
              <summary className="cursor-pointer text-sm font-semibold">
                技术详情 stderr
              </summary>
              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="text-xs text-[color:var(--muted)]">
                  这里保留原始错误信息，便于手动排查。
                </p>
                {stderr ? (
                  <Button tone="ghost" size="sm" onClick={() => copyText("stderr", stderr)}>
                    {copied === "stderr" ? "已复制" : "复制"}
                  </Button>
                ) : null}
              </div>
              <pre className="mt-3 min-h-28 overflow-auto rounded-[1rem] bg-[#2b1115] p-4 text-xs leading-6 text-white">
                {stderr || "无错误输出"}
              </pre>
            </details>
          </div>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.72fr_1.28fr]">
        <ExecutionStatusPanel
          title="Agent 执行进度"
          description="正式任务会展示每个阶段的状态；失败时停在对应步骤，并保留可排查信息。"
          steps={executionSteps}
        />

        <Card className="space-y-4">
          <div>
            <CardTitle>运行证据</CardTitle>
            <CardDescription className="mt-2">
              首次运行、自动修复和最终运行会分开保存，报告只引用真实运行结果。
            </CardDescription>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-[1rem] border border-[color:var(--border)] bg-white/70 p-4">
              <p className="text-sm font-semibold">首次运行</p>
              <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                {runDetail(firstRun)}
              </p>
            </div>
            <div className="rounded-[1rem] border border-[color:var(--border)] bg-white/70 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">自动修复</p>
                {debugResult ? (
                  <Badge tone={debugResult.fixed ? "success" : "danger"}>
                    {debugResult.fixed ? "已修复" : "未修复"}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                {debugResult?.reason || "尚未触发。"}
              </p>
              {debugResult?.changedPoints.length ? (
                <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-5 text-[color:var(--foreground-soft)]">
                  {debugResult.changedPoints.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="rounded-[1rem] border border-[color:var(--border)] bg-white/70 p-4">
              <p className="text-sm font-semibold">最终运行</p>
              <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                {runDetail(finalRun)}
              </p>
            </div>
          </div>

          <div className="rounded-[1rem] border border-[color:var(--border)] bg-white/64 p-4 text-sm leading-7 text-[color:var(--foreground-soft)]">
            Vercel 可能不适合长期运行 Python 子进程。当前 P1 版本会优雅降级；生产级代码执行建议后续接入 Docker Runner Worker。
          </div>
        </Card>
      </div>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>报告草稿</CardTitle>
            <CardDescription className="mt-2">
              报告包含实验名称、目的、环境、原理、步骤、代码、运行结果、分析、总结和限制说明。
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button tone="secondary" onClick={generateReport} disabled={!analysis || isBusy}>
              {pending?.includes("generate-report") ? "生成中..." : "生成报告草稿"}
            </Button>
            {report.trim() ? (
              <Button tone="secondary" onClick={() => copyText("report", report)}>
                {copied === "report" ? "已复制" : "复制报告"}
              </Button>
            ) : null}
            <Button tone="secondary" onClick={saveReport} disabled={!report.trim() || isBusy}>
              保存草稿
            </Button>
            {report.trim() ? (
              <ButtonLink href={`/api/tasks/${taskId}/export-docx`}>导出 DOCX</ButtonLink>
            ) : null}
          </div>
        </div>
        <textarea
          className={`${boxClass} min-h-[460px] resize-y font-mono`}
          value={report}
          onChange={(event) => setReport(event.target.value)}
          placeholder="点击“一键生成并验证报告”或“生成报告草稿”后，可在这里编辑。"
        />
      </Card>
    </div>
  );
}
