"use client";

import { useCallback, useEffect, useState } from "react";
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
import type { AgentTraceArtifact, AgentTraceStep } from "@/lib/agent/agent-trace";
import type { QualityEvaluationResult } from "@/lib/agent/quality-evaluation";

interface WorkbenchProps {
  taskId: string;
  analysis: ParsedRequirement | null;
  initialCode: string;
  initialStdout: string;
  initialStderr: string;
  initialReport: string;
  taskInputSummary: string;
  initialScreenshotRequired: boolean;
  initialScreenshotMissing: boolean;
  initialScreenshotEvidenceCount: number;
}

type WorkbenchRunResult = RunResult & {
  exitCode?: number | null;
  timedOut?: boolean;
  message?: string;
  screenshots?: Array<{
    type?: string;
    source?: string;
  }>;
  screenshotRequired?: boolean;
  screenshotMissing?: boolean;
  screenshotWarning?: string | null;
  screenshotMissingReason?: string | null;
};

type CopyTarget = "code" | "report" | "stdout" | "stderr" | "debug";

type AgentRunMode = "full" | "run_only" | "screenshot_only";

type AgentRunUiState = {
  isRunning: boolean;
  runId?: string;
  status: "idle" | "running" | "success" | "failed" | "partial";
  workflowType?: string;
  traceSteps: AgentTraceStep[];
  quality?: QualityEvaluationResult | null;
  artifacts: AgentTraceArtifact[];
  errors: string[];
  warnings: string[];
};

type AgentRunResponse = {
  taskId: string;
  runId?: string;
  status?: "success" | "failed" | "partial" | "running";
  workflowType?: string;
  trace?: AgentTraceStep[];
  steps?: AgentTraceStep[];
  quality?: QualityEvaluationResult | null;
  artifacts?: AgentTraceArtifact[];
  errors?: string[];
  warnings?: string[];
  error?: string;
};

type ExportDocxState = {
  status: "idle" | "exporting" | "success" | "failed";
  message?: string;
  downloadUrl?: string;
  quality?: QualityEvaluationResult | null;
};

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

function isFrontendLikeTask(analysis: ParsedRequirement | null, code: string) {
  const analysisText = JSON.stringify(analysis ?? {}).toLowerCase();
  const codeText = code.toLowerCase();
  return (
    /frontend|html|css|javascript|react|web page|browser|网页|页面|前端/.test(
      analysisText,
    ) ||
    /<!doctype|<html|<style|<script|react/.test(codeText)
  );
}

function summarizeUiError(value: unknown) {
  const raw = typeof value === "string" ? value : JSON.stringify(value ?? "");
  try {
    const parsed = JSON.parse(raw) as { message?: string; error?: string; code?: string };
    return parsed.message || parsed.error || parsed.code || "操作失败，请查看调试详情。";
  } catch {
    return raw.length > 300 ? `${raw.slice(0, 300)}...` : raw;
  }
}

function buildFrontendFilesFromCode(code: string) {
  const trimmed = code.trim();
  if (!trimmed) {
    throw new Error("请先粘贴 index.html 或前端文件包 JSON。");
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const files = Array.isArray(parsed)
      ? parsed
      : parsed &&
          typeof parsed === "object" &&
          Array.isArray((parsed as { files?: unknown }).files)
        ? (parsed as { files: unknown[] }).files
        : null;

    if (files) {
      return files
        .filter(
          (file): file is { path: string; content: string } =>
            file !== null &&
            typeof file === "object" &&
            typeof (file as { path?: unknown }).path === "string" &&
            typeof (file as { content?: unknown }).content === "string",
        )
        .map((file) => ({
          path: file.path,
          content: file.content,
        }));
    }
  } catch {
    // Non-JSON content is treated as a single index.html artifact.
  }

  return [{ path: "index.html", content: trimmed }];
}

function summarizeScreenshotSources(
  screenshots?: Array<{
    type?: string;
    source?: string;
  }>,
) {
  if (!screenshots?.length) return "";
  const browserCount = screenshots.filter(
    (screenshot) => screenshot.type === "browser_page_screenshot",
  ).length;
  const commandCount = screenshots.filter(
    (screenshot) => screenshot.type === "command_output_screenshot",
  ).length;
  const parts = [];
  if (browserCount) parts.push(`${browserCount} 张真实网页效果截图`);
  if (commandCount) parts.push(`${commandCount} 张命令行运行截图`);
  return parts.join("，") || `${screenshots.length} 张真实截图`;
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

const traceStepLabels: Record<string, string> = {
  "parse-document": "文档解析",
  analyze: "任务分析",
  plan: "实验计划",
  "generate-code": "代码生成",
  "run-code": "真实运行",
  "debug-once": "Debug 一次",
  "generate-screenshot": "截图证据",
  "generate-report": "报告生成",
  evaluate: "质量检查",
  "save-report": "保存报告",
  "export-docx": "DOCX 导出",
};

function traceStatusTone(status?: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "success") return "success";
  if (status === "failed") return "danger";
  if (status === "running") return "warning";
  return "neutral";
}

function artifactLabel(artifact: AgentTraceArtifact) {
  if (artifact.kind === "command_output_screenshot") return "命令行运行截图";
  if (artifact.kind === "browser_page_screenshot") return "网页效果截图";
  if (artifact.kind === "source_code") return "源代码";
  if (artifact.kind === "stdout") return "stdout";
  if (artifact.kind === "stderr") return "stderr";
  if (artifact.kind === "report") return "报告";
  if (artifact.kind === "docx") return "DOCX";
  return artifact.kind;
}

function traceStatusLabel(status?: string) {
  if (status === "success") return "成功";
  if (status === "failed") return "失败";
  if (status === "running") return "运行中";
  if (status === "skipped") return "跳过";
  return "待执行";
}

function truncateInline(value?: string, maxLength = 92) {
  if (!value) return "";
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function traceArtifactSummary(step: AgentTraceStep) {
  const count = step.artifacts?.length ?? 0;
  if (count === 0) return "无证据文件";
  const screenshotCount =
    step.artifacts?.filter((artifact) => artifact.kind.includes("screenshot")).length ?? 0;
  if (screenshotCount > 0) return `${screenshotCount} 张截图证据`;
  return `${count} 个证据文件`;
}

function shouldOpenTraceStep(step: AgentTraceStep) {
  return step.status === "failed" || step.status === "running";
}

export function Workbench({
  taskId,
  analysis,
  initialCode,
  initialStdout,
  initialStderr,
  initialReport,
  taskInputSummary,
  initialScreenshotRequired,
  initialScreenshotMissing,
  initialScreenshotEvidenceCount,
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
  const [screenshotRequired, setScreenshotRequired] = useState(
    initialScreenshotRequired,
  );
  const [screenshotMissing, setScreenshotMissing] = useState(
    initialScreenshotMissing,
  );
  const [screenshotEvidenceCount, setScreenshotEvidenceCount] = useState(
    initialScreenshotEvidenceCount,
  );
  const [screenshotWarning, setScreenshotWarning] = useState<string | null>(null);
  const [screenshotSourceSummary, setScreenshotSourceSummary] = useState(
    initialScreenshotEvidenceCount > 0 ? "已保存真实截图证据" : "",
  );
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
  const [agentRun, setAgentRun] = useState<AgentRunUiState>({
    isRunning: false,
    status: "idle",
    traceSteps: [],
    artifacts: [],
    errors: [],
    warnings: [],
  });
  const [exportDocx, setExportDocx] = useState<ExportDocxState>({
    status: "idle",
  });

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

  const applyAgentRunPayload = useCallback((payload: AgentRunResponse, running = false) => {
    const traceSteps = payload.trace ?? payload.steps ?? [];
    const artifacts =
      payload.artifacts ??
      traceSteps.flatMap((step) => step.artifacts ?? []);
    const screenshotArtifacts = artifacts.filter(
      (artifact) =>
        artifact.kind === "command_output_screenshot" ||
        artifact.kind === "browser_page_screenshot",
    );

    if (screenshotArtifacts.length > 0) {
      setScreenshotEvidenceCount((current) =>
        Math.max(current, screenshotArtifacts.length),
      );
      setScreenshotMissing(false);
      setScreenshotSourceSummary(
        `${screenshotArtifacts.length} 张真实截图证据已写入 trace`,
      );
    }

    setAgentRun({
      isRunning: running,
      runId: payload.runId,
      status: payload.status ?? (running ? "running" : "partial"),
      workflowType: payload.workflowType,
      traceSteps,
      quality: payload.quality ?? null,
      artifacts,
      errors: (payload.errors ?? (payload.error ? [payload.error] : [])).map(summarizeUiError),
      warnings: payload.warnings ?? [],
    });
  }, []);

  const fetchAgentTrace = useCallback(
    async (runId?: string) => {
      const query = runId ? `?runId=${encodeURIComponent(runId)}` : "";
      const response = await fetch(`/api/tasks/${taskId}/agent/trace${query}`);
      const payload = await readJsonSafely<AgentRunResponse & { error?: string }>(
        response.clone(),
      );

      if (!response.ok) {
        throw new Error(await getFriendlyApiErrorMessage(response, "Trace 刷新失败。"));
      }
      if (!payload) {
        throw new Error("Trace 响应为空。");
      }

      applyAgentRunPayload(payload, payload.status === "running");
      return payload;
    },
    [applyAgentRunPayload, taskId],
  );

  useEffect(() => {
    if (!agentRun.isRunning) return;

    const timer = window.setInterval(() => {
      void fetchAgentTrace(agentRun.runId).catch(() => undefined);
    }, 2500);

    return () => window.clearInterval(timer);
  }, [agentRun.isRunning, agentRun.runId, fetchAgentTrace]);

  async function refreshTrace() {
    try {
      setPending("agent-trace");
      setError(null);
      await fetchAgentTrace(agentRun.runId);
    } catch (actionError) {
      setError(toUserFriendlyErrorMessage(actionError, "Trace 刷新失败。"));
    } finally {
      setPending(null);
    }
  }

  async function runAgentMode(mode: AgentRunMode, forceRerun = false) {
    setError(null);
    setPending(`agent-${mode}`);
    setExecutionSteps(createWaitingAgentExecutionSteps());
    setAgentRun((current) => ({
      ...current,
      isRunning: true,
      status: "running",
      errors: [],
      warnings: [],
    }));

    try {
      const response = await fetch(`/api/tasks/${taskId}/agent/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          allowDebugOnce: mode !== "screenshot_only",
          allowBrowserScreenshot: mode !== "run_only",
          allowCommandScreenshot: true,
          allowDocxExport: false,
          forceRerun,
          dryRun: false,
        }),
      });
      const payload = await readJsonSafely<AgentRunResponse & { error?: string }>(
        response.clone(),
      );

      if (!response.ok) {
        throw new Error(await getFriendlyApiErrorMessage(response, "Agent 全流程执行失败。"));
      }
      if (!payload) {
        throw new Error("Agent 全流程响应为空。");
      }

      applyAgentRunPayload(payload, payload.status === "running");
      await fetchAgentTrace(payload.runId).catch(() => undefined);
      router.refresh();
    } catch (actionError) {
      const message = toUserFriendlyErrorMessage(actionError, "Agent 全流程执行失败。");
      setError(message);
      setAgentRun((current) => ({
        ...current,
        isRunning: false,
        status: "failed",
        errors: [message],
      }));
      setStepStatus("done", "error", message);
    } finally {
      setPending(null);
    }
  }

  function applyAgentResult(payload: AgentWorkflowResult | null) {
    if (!payload) return;

    const syncScreenshotState = (result: WorkbenchRunResult | null | undefined) => {
      if (!result) return;
      if (typeof result.screenshotRequired === "boolean") {
        setScreenshotRequired(result.screenshotRequired);
      }
      if (typeof result.screenshotMissing === "boolean") {
        setScreenshotMissing(result.screenshotMissing);
      }
      if (Array.isArray(result.screenshots)) {
        const count = result.screenshots.length;
        setScreenshotEvidenceCount((current) => Math.max(current, count));
        setScreenshotSourceSummary(summarizeScreenshotSources(result.screenshots));
        if (count > 0) {
          setScreenshotMissing(false);
        }
      }
      if (result.screenshotWarning !== undefined) {
        setScreenshotWarning(result.screenshotWarning ?? null);
      }
    };

    if (payload.generatedCode?.code) {
      setCode(payload.generatedCode.code);
    }
    if (payload.firstRun) {
      const first = payload.firstRun as WorkbenchRunResult;
      setFirstRun(first);
      syncScreenshotState(first);
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
      syncScreenshotState(final);
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
      if (typeof result?.screenshotRequired === "boolean") {
        setScreenshotRequired(result.screenshotRequired);
      }
      if (typeof result?.screenshotMissing === "boolean") {
        setScreenshotMissing(result.screenshotMissing);
      }
      if (Array.isArray(result?.screenshots)) {
        setScreenshotEvidenceCount((current) =>
          Math.max(current, result.screenshots?.length ?? 0),
        );
        setScreenshotSourceSummary(summarizeScreenshotSources(result.screenshots));
      }
      setScreenshotWarning(result?.screenshotWarning ?? null);

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

  async function runBrowserScreenshot() {
    setStepStatus("code", "success");
    markRunning("run", "正在用真实 Chromium 浏览器渲染页面并截图...");

    try {
      const frontendFiles = buildFrontendFilesFromCode(code);
      const payload = await post<WorkbenchRunResult>(
        `/api/tasks/${taskId}/run-code`,
        {
          runMode: "frontend_browser",
          frontendFiles,
          entryFile: "index.html",
          viewport: { width: 1280, height: 720 },
          fullPage: true,
        },
        "真实网页效果截图生成失败，请检查入口文件和前端代码。",
      );

      const result = payload;
      setFinalRun(result);
      setStdout(result?.stdout || "");
      setStderr(result?.stderr || "");
      if (typeof result?.screenshotRequired === "boolean") {
        setScreenshotRequired(result.screenshotRequired);
      }
      if (typeof result?.screenshotMissing === "boolean") {
        setScreenshotMissing(result.screenshotMissing);
      }
      if (Array.isArray(result?.screenshots)) {
        const summary = summarizeScreenshotSources(result.screenshots);
        setScreenshotEvidenceCount((current) =>
          current + (result.screenshots?.length ?? 0),
        );
        setScreenshotSourceSummary(summary);
        if (result.screenshots.length > 0) {
          setScreenshotMissing(false);
        }
      }
      setScreenshotWarning(result?.screenshotWarning ?? null);

      if (!result?.success) {
        const message = result?.message || result?.stderr || "真实网页效果截图生成失败。";
        setError(message);
        setStepStatus("run", "error", message);
        return result;
      }

      setStepStatus("run", "success", "真实网页效果截图已生成并保存。");
      return result;
    } catch (actionError) {
      const message = toUserFriendlyErrorMessage(
        actionError,
        "真实网页效果截图生成失败，请检查入口文件和前端代码。",
      );
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
      const response = await fetch(`/api/tasks/${taskId}/agent/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "full",
          allowDebugOnce: true,
          allowBrowserScreenshot: true,
          allowCommandScreenshot: true,
          allowDocxExport: false,
          forceRerun: false,
          dryRun: false,
        }),
      });
      const payload = await readJsonSafely<AgentRunResponse & { error?: string }>(response.clone());
      if (!response.ok) {
        throw new Error(await getFriendlyApiErrorMessage(response, "系统出现未知错误，请稍后重试。"));
      }
      if (!payload) {
        throw new Error("Agent 全流程响应为空。");
      }
      applyAgentRunPayload(payload, payload.status === "running");
      await fetchAgentTrace(payload.runId).catch(() => undefined);
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

  async function exportDocxViaPost() {
    setError(null);
    setExportDocx({ status: "exporting", quality: agentRun.quality ?? null });
    try {
      const response = await fetch(
        `/api/tasks/${taskId}/export-docx?mode=auto`,
        {
          method: "POST",
        },
      );
      const payload = await readJsonSafely<{
        success?: boolean;
        error?: string;
        downloadUrl?: string;
        fileName?: string;
        quality?: QualityEvaluationResult | null;
      }>(response.clone());

      if (!response.ok) {
        const message = await getFriendlyApiErrorMessage(response, "DOCX 导出失败。");
        setExportDocx({
          status: "failed",
          message,
          quality: payload?.quality ?? agentRun.quality ?? null,
        });
        throw new Error(message);
      }

      setExportDocx({
        status: "success",
        message: payload?.fileName
          ? `DOCX 已通过质量闸门：${payload.fileName}`
          : "DOCX 已通过质量闸门，可以下载。",
        downloadUrl: payload?.downloadUrl ?? `/api/tasks/${taskId}/export-docx?mode=auto`,
        quality: payload?.quality ?? agentRun.quality ?? null,
      });
      await fetchAgentTrace(agentRun.runId).catch(() => undefined);
      router.refresh();
    } catch (actionError) {
      const message = toUserFriendlyErrorMessage(actionError, "DOCX 导出失败。");
      setError(message);
      setExportDocx((current) => ({
        ...current,
        status: "failed",
        message,
      }));
    }
  }

  async function copyText(type: CopyTarget, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(type);
    window.setTimeout(() => setCopied(null), 1800);
  }

  const isBusy = pending !== null;
  const isFrontendTask = isFrontendLikeTask(analysis, code);
  void applyAgentResult;

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
              <Badge tone="primary">Agent 执行流</Badge>
              <Badge tone={analysis ? "success" : "warning"}>
                {analysis ? "分析已就绪" : "等待分析"}
              </Badge>
            </div>
            <CardTitle className="text-2xl">一键执行实验交付链路</CardTitle>
            <CardDescription>
              系统会按“任务分析 → 代码生成 → 真实运行 → 真实截图 → 报告草稿 → 质量检查”的顺序执行。
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="lg"
              onClick={runAgentFlow}
              disabled={!analysis || isBusy || agentRun.isRunning}
            >
              {pending === "agent-flow" ? "Agent 执行中..." : "开始全流程"}
            </Button>
            <Button
              tone="secondary"
              size="lg"
              onClick={() => runAgentMode("full", true)}
              disabled={!analysis || isBusy || agentRun.isRunning}
            >
              重新运行全流程
            </Button>
            <Button
              tone="secondary"
              size="lg"
              onClick={() => runAgentMode("run_only", true)}
              disabled={!analysis || isBusy || agentRun.isRunning}
            >
              只重新运行代码
            </Button>
            <Button
              tone="secondary"
              size="lg"
              onClick={() => runAgentMode("screenshot_only", true)}
              disabled={!analysis || isBusy || agentRun.isRunning}
            >
              只重新生成截图
            </Button>
            <Button tone="ghost" size="lg" onClick={refreshTrace} disabled={isBusy}>
              刷新 Trace
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
                默认生成可运行的 Python 代码；如果任务包含数据文件，会优先使用真实文件名读取。
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
            <div className="flex flex-wrap gap-2">
            <Button onClick={() => runCode()} disabled={!code.trim() || isBusy}>
              {pending?.includes("run-code") ? "运行中..." : "运行代码"}
            </Button>
              {isFrontendTask ? (
                <Button
                  tone="secondary"
                  onClick={runBrowserScreenshot}
                  disabled={!code.trim() || isBusy}
                >
                  {pending?.includes("run-code")
                    ? "截图中..."
                    : "生成真实网页效果截图"}
                </Button>
              ) : null}
            </div>
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

          {screenshotRequired || screenshotEvidenceCount > 0 || isFrontendTask ? (
            <div className="rounded-[1rem] border border-[color:var(--border)] bg-white/72 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">真实运行截图</p>
                <Badge tone={!screenshotMissing && screenshotEvidenceCount > 0 ? "success" : "warning"}>
                  {!screenshotMissing && screenshotEvidenceCount > 0
                    ? "已生成真实运行截图"
                    : "截图缺失"}
                </Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                {!screenshotMissing && screenshotEvidenceCount > 0
                  ? `已保存 ${screenshotEvidenceCount} 张基于真实 run-code 结果生成的运行证据截图，导出原格式 DOCX 时会插入任务下方。`
                  : "任务要求运行截图，请先运行代码并生成真实运行证据截图；系统不会伪造截图。"}
              </p>
              {screenshotSourceSummary ? (
                <p className="mt-2 text-xs leading-5 text-[color:var(--foreground-soft)]">
                  {screenshotSourceSummary}
                </p>
              ) : isFrontendTask ? (
                <p className="mt-2 text-xs leading-5 text-[color:var(--foreground-soft)]">
                  当前任务看起来包含前端/网页内容，可点击“生成真实网页效果截图”创建浏览器渲染 PNG。
                </p>
              ) : null}
              {screenshotWarning ? (
                <p className="mt-2 text-xs leading-5 text-[color:var(--danger)]">
                  {screenshotWarning}
                </p>
              ) : null}
            </div>
          ) : null}

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
            当前本地流程会真实运行 Python / 浏览器截图；生产级长任务建议后续迁移到独立 Runner Worker。
          </div>
        </Card>
      </div>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>真实 Trace 控制台</CardTitle>
            <CardDescription className="mt-2">
              展示 `/agent/trace` 返回的真实执行步骤、证据、质量评分和错误信息。
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone={traceStatusTone(agentRun.status)}>
              {agentRun.status === "idle" ? "未开始" : agentRun.status}
            </Badge>
            {agentRun.workflowType ? <Badge tone="primary">{agentRun.workflowType}</Badge> : null}
            <Button tone="secondary" onClick={refreshTrace} disabled={isBusy}>
              刷新 Trace
            </Button>
          </div>
        </div>

        {agentRun.quality ? (
          <div className="rounded-[1rem] border border-[color:var(--border)] bg-white/72 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold">质量评分</p>
              <Badge tone={agentRun.quality.passed ? "success" : "danger"}>
                {agentRun.quality.score}/100
              </Badge>
              <Badge tone={agentRun.quality.passed ? "success" : "warning"}>
                {agentRun.quality.passed ? "质量通过" : "质量未通过"}
              </Badge>
            </div>
            {agentRun.quality.blockingIssues.length > 0 ? (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-[color:var(--danger)]">
                {agentRun.quality.blockingIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            ) : null}
            {agentRun.quality.warnings.length > 0 ? (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-[color:var(--warning)]">
                {agentRun.quality.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-3">
          {(agentRun.traceSteps.length > 0
            ? agentRun.traceSteps
            : [
                "parse-document",
                "analyze",
                "plan",
                "generate-code",
                "run-code",
                "debug-once",
                "generate-screenshot",
                "generate-report",
                "evaluate",
                "save-report",
                "export-docx",
              ].map(
                (step) =>
                  ({
                    id: step,
                    taskId,
                    step,
                    status: "pending",
                    startedAt: "",
                  }) as AgentTraceStep,
              )
          ).map((step) => (
            <details
              key={step.id}
              open={shouldOpenTraceStep(step)}
              className="rounded-[1rem] border border-[color:var(--border)] bg-white/68"
            >
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">
                    {traceStepLabels[step.step] ?? step.step}
                  </span>
                  <Badge tone={traceStatusTone(step.status)}>
                    {traceStatusLabel(step.status)}
                  </Badge>
                  <span className="text-xs text-[color:var(--muted)]">
                    {traceArtifactSummary(step)}
                  </span>
                </span>
                <span className="max-w-full truncate text-xs text-[color:var(--foreground-soft)] md:max-w-[420px]">
                  {truncateInline(step.outputSummary || step.inputSummary || step.error)}
                </span>
              </summary>
              <div className="border-t border-[color:var(--border)] px-4 py-3">
                {typeof step.durationMs === "number" ? (
                  <p className="text-xs text-[color:var(--muted)]">
                    耗时：{step.durationMs}ms
                  </p>
                ) : null}
                {step.inputSummary ? (
                  <p className="mt-2 text-xs leading-5 text-[color:var(--foreground-soft)]">
                    输入：{step.inputSummary}
                  </p>
                ) : null}
                {step.outputSummary ? (
                  <p className="mt-2 text-xs leading-5 text-[color:var(--foreground-soft)]">
                    输出：{step.outputSummary}
                  </p>
                ) : null}
                {step.error ? (
                  <p className="mt-2 text-xs leading-5 text-[color:var(--danger)]">
                    错误：{step.error}
                  </p>
                ) : null}
                {step.artifacts?.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {step.artifacts.map((artifact, index) => (
                      <Badge
                        key={`${step.id}-${artifact.kind}-${index}`}
                        tone={
                          artifact.kind.includes("screenshot") && !artifact.storagePath
                            ? "warning"
                            : "success"
                        }
                      >
                        {artifactLabel(artifact)}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            </details>
          ))}
        </div>

        {agentRun.errors.length > 0 ? (
          <div className="rounded-[1rem] border border-[color:var(--danger)]/30 bg-[color:var(--danger-soft)] p-4 text-sm leading-6 text-[color:var(--danger)]">
            {agentRun.errors.join(" / ")}
          </div>
        ) : null}
        {agentRun.warnings.length > 0 ? (
          <div className="rounded-[1rem] border border-[color:var(--warning)]/30 bg-[color:var(--warning-soft)] p-4 text-sm leading-6 text-[color:var(--warning)]">
            {agentRun.warnings.join(" / ")}
          </div>
        ) : null}
      </Card>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>报告草稿</CardTitle>
            <CardDescription className="mt-2">
              报告包含实验名称、目的、环境、原理、步骤、代码、运行结果、分析、总结和限制说明。
              DOCX 导出默认保留原任务书格式，仅在任务下方插入生成内容；如果原文件是 .doc 或非标准 .docx，请上传标准 .docx 模板。
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
              <Button onClick={exportDocxViaPost} disabled={exportDocx.status === "exporting"}>
                {exportDocx.status === "exporting" ? "导出中..." : "导出 DOCX"}
              </Button>
            ) : null}
            {exportDocx.downloadUrl ? (
              <ButtonLink href={exportDocx.downloadUrl} tone="secondary">
                下载已导出的 DOCX
              </ButtonLink>
            ) : null}
            {report.trim() ? (
              <ButtonLink href={`/api/tasks/${taskId}/export-docx?mode=generated_report_docx`} tone="ghost">
                生成新版 DOCX（非原格式）
              </ButtonLink>
            ) : null}
          </div>
        </div>
        <div className="rounded-[1rem] border border-[color:var(--border)] bg-white/70 p-4 text-xs leading-5 text-[color:var(--foreground-soft)]">
          原格式导出会保留老师任务书内容、封面、页眉页脚和原始任务要求，只追加
          【代码】、【运行截图】等内容。若任务要求截图但当前缺少真实截图，导出的 DOCX 会明确标记
          【截图缺失】，不会伪造截图。
        </div>
        {exportDocx.status !== "idle" ? (
          <div className="rounded-[1rem] border border-[color:var(--border)] bg-white/72 p-4 text-sm leading-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">DOCX 导出：</span>
              <Badge
                tone={
                  exportDocx.status === "success"
                    ? "success"
                    : exportDocx.status === "failed"
                      ? "danger"
                      : "warning"
                }
              >
                {exportDocx.status}
              </Badge>
            </div>
            {exportDocx.message ? (
              <p className="mt-2 text-[color:var(--foreground-soft)]">
                {exportDocx.message}
              </p>
            ) : null}
            {exportDocx.quality ? (
              <p className="mt-2 text-[color:var(--foreground-soft)]">
                质量闸门：{exportDocx.quality.score}/100，
                {exportDocx.quality.passed ? "通过" : "未通过"}
              </p>
            ) : null}
          </div>
        ) : null}
        <details className="rounded-[1rem] border border-[color:var(--border)] bg-white/68">
          <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3">
            <span className="text-sm font-semibold">报告草稿编辑区</span>
            <span className="text-xs text-[color:var(--muted)]">
              {report.trim()
                ? `已生成约 ${report.trim().length} 字，点击展开编辑全文`
                : "暂无报告草稿，点击展开查看编辑框"}
            </span>
          </summary>
          <div className="border-t border-[color:var(--border)] p-4">
            <textarea
              className={`${boxClass} min-h-[360px] resize-y font-mono`}
              value={report}
              onChange={(event) => setReport(event.target.value)}
              placeholder="点击“一键生成并验证报告”或“生成报告草稿”后，可在这里编辑。"
            />
          </div>
        </details>
      </Card>
    </div>
  );
}
