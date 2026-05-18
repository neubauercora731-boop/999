"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Badge, Button, ButtonLink, Card, CardDescription, CardTitle } from "@/components/ui";
import type { ParsedRequirement } from "@/lib/ai/types";
import { getApiErrorMessage, readJsonSafely } from "@/lib/utils";

interface WorkbenchProps {
  taskId: string;
  analysis: ParsedRequirement | null;
  initialCode: string;
  initialStdout: string;
  initialStderr: string;
  initialReport: string;
}

const boxClass =
  "w-full rounded-[1rem] border border-[color:var(--border)] bg-white/80 px-4 py-3 text-sm outline-none focus:border-[color:var(--border-strong)] focus:ring-4 focus:ring-[color:var(--ring)]";

export function Workbench({
  taskId,
  analysis,
  initialCode,
  initialStdout,
  initialStderr,
  initialReport,
}: WorkbenchProps) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [stdout, setStdout] = useState(initialStdout);
  const [stderr, setStderr] = useState(initialStderr);
  const [report, setReport] = useState(initialReport);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function post<T>(endpoint: string, body: unknown = {}) {
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
        throw new Error(await getApiErrorMessage(response, "操作失败。"));
      }
      router.refresh();
      return payload;
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "操作失败。");
      return null;
    } finally {
      setPending(null);
    }
  }

  async function generateCode() {
    const payload = await post<{ code: string }>(`/api/tasks/${taskId}/generate-code`);
    if (payload?.code) setCode(payload.code);
  }

  async function runCode() {
    const payload = await post<{
      stdout: string;
      stderr: string;
      exitCode: number | null;
      timedOut: boolean;
    }>(`/api/tasks/${taskId}/run-code`, { code });
    if (payload) {
      setStdout(payload.stdout || "");
      setStderr(
        [
          payload.stderr,
          payload.timedOut ? "运行超时：已按 10 秒限制终止。" : "",
          payload.exitCode && payload.exitCode !== 0 ? `退出码：${payload.exitCode}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      );
    }
  }

  async function generateReport() {
    const payload = await post<{ reportMarkdown: string }>(
      `/api/tasks/${taskId}/generate-report`,
    );
    if (payload?.reportMarkdown) setReport(payload.reportMarkdown);
  }

  async function saveReport() {
    const payload = await post<{ reportMarkdown: string }>(
      `/api/tasks/${taskId}/save-report`,
      { markdown: report },
    );
    if (payload?.reportMarkdown) setReport(payload.reportMarkdown);
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-[1rem] border border-[color:var(--danger)]/30 bg-[color:var(--danger-soft)] px-4 py-3 text-sm text-[color:var(--danger)]">
          {error}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr_0.9fr]">
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
            <Button onClick={generateCode} disabled={!analysis || pending !== null}>
              {pending?.includes("generate-code") ? "生成中..." : "生成代码"}
            </Button>
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
            <Button onClick={runCode} disabled={!code.trim() || pending !== null}>
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
