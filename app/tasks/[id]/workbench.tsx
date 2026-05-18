"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Badge, Button, ButtonLink, Card, CardDescription, CardTitle } from "@/components/ui";
import {
  createWaitingExecutionSteps,
  defaultExecutionSteps,
  ExecutionStatusPanel,
  type ExecutionStep,
} from "@/components/task/execution-status-panel";
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
  return defaultExecutionSteps.map((step) => {
    if ((step.id === "understand" || step.id === "plan") && hasAnalysis) {
      return { ...step, status: "success" };
    }
    if (step.id === "code" && hasCode) {
      return { ...step, status: "success" };
    }
    if (step.id === "run" && hasRun) {
      return { ...step, status: "success" };
    }
    if (step.id === "report" && hasReport) {
      return { ...step, status: "success" };
    }
    if (step.id === "done" && hasReport) {
      return { ...step, status: "success" };
    }
    return { ...step, status: "waiting" };
  });
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
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"code" | "report" | null>(null);
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

  function markRunning(id: string) {
    setExecutionSteps((current) =>
      current.map((step) =>
        step.id === id
          ? { ...step, status: "running", detail: undefined }
          : step.status === "running"
            ? { ...step, status: "waiting", detail: undefined }
            : step,
      ),
    );
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

  async function generateCode() {
    setStepStatus("understand", "success");
    setStepStatus("plan", "success");
    markRunning("code");

    try {
      const payload = await post<{ code: string }>(
        `/api/tasks/${taskId}/generate-code`,
        {},
        "AI 生成失败，请检查 API Key、余额或网络状态。",
      );
      if (payload?.code) {
        setCode(payload.code);
        setStepStatus("code", "success", "实验代码已生成，可继续编辑后运行。");
      }
      return payload?.code ?? "";
    } catch (actionError) {
      const message = toUserFriendlyErrorMessage(
        actionError,
        "AI 生成失败，请检查 API Key、余额或网络状态。",
      );
      setStepStatus("code", "error", message);
      return "";
    }
  }

  async function runCode(codeToRun = code) {
    setStepStatus("code", "success");
    markRunning("run");

    try {
      const payload = await post<{
      stdout: string;
      stderr: string;
      exitCode: number | null;
      timedOut: boolean;
      }>(`/api/tasks/${taskId}/run-code`, { code: codeToRun }, "代码运行失败，请查看错误信息。");

      setStdout(payload?.stdout || "");
      const stderrText = [
        payload?.stderr,
        payload?.timedOut ? "代码运行超时，可能存在死循环或任务过长。" : "",
        payload?.exitCode && payload.exitCode !== 0 ? `退出码：${payload.exitCode}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      setStderr(stderrText);

      if (payload?.timedOut) {
        setError("代码运行超时，可能存在死循环或任务过长。");
        setStepStatus("run", "error", "代码运行超时，可能存在死循环或任务过长。");
        return false;
      }

      if (payload?.exitCode && payload.exitCode !== 0) {
        setError("代码运行失败，请查看错误信息。");
        setStepStatus("run", "error", "代码运行失败，请查看错误信息。");
        return false;
      }

      setStepStatus("run", "success", "代码运行完成，stdout/stderr 已保存为结果证据。");
      return true;
    } catch (actionError) {
      const message = toUserFriendlyErrorMessage(actionError, "代码运行失败，请查看错误信息。");
      setStepStatus("run", "error", message);
      return false;
    }
  }

  async function generateReport() {
    markRunning("report");

    try {
      const payload = await post<{ reportMarkdown: string }>(
        `/api/tasks/${taskId}/generate-report`,
        {},
        "AI 生成失败，请检查 API Key、余额或网络状态。",
      );
      if (payload?.reportMarkdown) {
        setReport(payload.reportMarkdown);
        setStepStatus("report", "success", "报告草稿已整理，可继续编辑或复制。");
        setStepStatus("done", "success", "任务闭环已完成。");
      }
      return payload?.reportMarkdown ?? "";
    } catch (actionError) {
      const message = toUserFriendlyErrorMessage(
        actionError,
        "AI 生成失败，请检查 API Key、余额或网络状态。",
      );
      setStepStatus("report", "error", message);
      return "";
    }
  }

  async function runFullFlow() {
    setError(null);
    setPending("full-flow");
    setExecutionSteps(createWaitingExecutionSteps());
    setStepStatus("understand", "success", "已读取并确认结构化实验要求。");
    setStepStatus("plan", "success", "已拆解为代码、运行和报告整理步骤。");

    try {
      const nextCode = code.trim() ? code : await generateCode();
      if (!nextCode.trim()) return;

      const ran = await runCode(nextCode);
      if (!ran) return;

      await generateReport();
    } finally {
      setPending(null);
    }
  }

  async function saveReport() {
    try {
      const payload = await post<{ reportMarkdown: string }>(
      `/api/tasks/${taskId}/save-report`,
      { markdown: report },
      "保存报告草稿失败。",
      );
      if (payload?.reportMarkdown) setReport(payload.reportMarkdown);
    } catch {
      // Error is already shown by post().
    }
  }

  async function copyText(type: "code" | "report", value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(type);
    window.setTimeout(() => setCopied(null), 1800);
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-[1rem] border border-[color:var(--danger)]/30 bg-[color:var(--danger-soft)] px-4 py-3 text-sm text-[color:var(--danger)]">
          {error}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[0.78fr_1.22fr_0.92fr]">
        <Card className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>实验步骤</CardTitle>
              <CardDescription className="mt-2">
                解析结果需由用户确认，生成内容也需要用户编辑。
              </CardDescription>
            </div>
            <Badge tone={analysis ? "success" : "warning"}>
              {analysis ? "已解析" : "待解析"}
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
              <div>
                <p className="font-semibold text-[color:var(--foreground)]">Python 任务</p>
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
            <ButtonLink href={`/tasks/${taskId}/analysis`}>去解析任务</ButtonLink>
          )}
        </Card>

        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Python 代码</CardTitle>
              <CardDescription className="mt-2">
                P0 使用后端受限子进程运行，超时 10 秒，并拦截危险操作。
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {code.trim() ? (
                <Button tone="secondary" onClick={() => copyText("code", code)}>
                  {copied === "code" ? "已复制" : "复制代码"}
                </Button>
              ) : null}
              <Button onClick={generateCode} disabled={!analysis || pending !== null}>
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
              <CardTitle>运行输出</CardTitle>
              <CardDescription className="mt-2">
                stdout/stderr 会保存为运行证据；失败不会白屏。
              </CardDescription>
            </div>
            <Button onClick={() => runCode()} disabled={!code.trim() || pending !== null}>
              {pending?.includes("run-code") ? "运行中..." : "运行代码"}
            </Button>
          </div>
          <div className="space-y-3">
            <div>
              <p className="mb-2 text-sm font-semibold">stdout</p>
              <pre className="min-h-48 overflow-auto rounded-[1rem] bg-[#111] p-4 text-xs leading-6 text-white">
                {stdout || "暂无输出"}
              </pre>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold">stderr</p>
              <pre className="min-h-28 overflow-auto rounded-[1rem] bg-[#2b1115] p-4 text-xs leading-6 text-white">
                {stderr || "无错误输出"}
              </pre>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.72fr_1.28fr]">
        <ExecutionStatusPanel steps={executionSteps} />

        <Card className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>一键生成实验报告</CardTitle>
              <CardDescription className="mt-2">
                按“生成代码 → 运行验证 → 整理报告”的顺序执行。每一步都会显示状态；失败时可以修改任务或重新生成。
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={runFullFlow} disabled={!analysis || pending !== null}>
                {pending === "full-flow" ? "正在执行..." : "生成实验报告"}
              </Button>
              <ButtonLink href="/tasks" tone="secondary">
                返回我的任务
              </ButtonLink>
            </div>
          </div>
        </Card>
      </div>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>报告草稿</CardTitle>
            <CardDescription className="mt-2">
              草稿按实验名称、目的、环境、步骤、代码、运行结果、分析和总结组织，可编辑后导出。
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button tone="secondary" onClick={generateReport} disabled={!analysis || pending !== null}>
              {pending?.includes("generate-report") ? "生成中..." : "生成报告草稿"}
            </Button>
            {report.trim() ? (
              <Button tone="secondary" onClick={() => copyText("report", report)}>
                {copied === "report" ? "已复制" : "复制报告"}
              </Button>
            ) : null}
            <Button tone="secondary" onClick={saveReport} disabled={!report.trim() || pending !== null}>
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
          placeholder="点击“生成报告草稿”后可在这里编辑。"
        />
      </Card>
    </div>
  );
}
