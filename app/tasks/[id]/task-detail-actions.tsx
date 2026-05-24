"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button, ButtonLink } from "@/components/ui";
import {
  getFriendlyApiErrorMessage,
  readJsonSafely,
  toUserFriendlyErrorMessage,
} from "@/lib/utils";

interface TaskDetailActionsProps {
  taskId: string;
  canCompleteTask: boolean;
  canGenerateOutline: boolean;
  canGenerateReport: boolean;
  canRunCheck: boolean;
  canExportDocx: boolean;
}

const AUTH_REDIRECT_MESSAGE =
  "登录状态已失效，请重新登录后再继续操作。";

export function TaskDetailActions({
  taskId,
  canCompleteTask,
  canGenerateOutline,
  canGenerateReport,
  canRunCheck,
  canExportDocx,
}: TaskDetailActionsProps) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<
    "complete" | "outline" | "report" | "check" | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  const redirectToAuth = (message: string) => {
    setError(message);
    router.replace("/auth");
    router.refresh();
  };

  async function runAction(
    action: "outline" | "report" | "check",
    endpoint: string,
  ) {
    setPendingAction(action);
    setError(null);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: "{}",
      });

      const payload = await readJsonSafely<{ error?: string }>(response.clone());

      if (response.status === 401) {
        redirectToAuth(payload?.error || AUTH_REDIRECT_MESSAGE);
        return;
      }

      if (!response.ok) {
        throw new Error(await getFriendlyApiErrorMessage(response, "操作失败，请稍后重试。"));
      }

      router.refresh();
    } catch (actionError) {
      setError(toUserFriendlyErrorMessage(actionError, "操作失败，请稍后重试。"));
    } finally {
      setPendingAction(null);
    }
  }

  async function runCompleteFlow() {
    setPendingAction("complete");
    setError(null);

    try {
      const response = await fetch(`/api/tasks/${taskId}/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: "{}",
      });

      const payload = await readJsonSafely<{ error?: string }>(response.clone());

      if (response.status === 401) {
        redirectToAuth(payload?.error || AUTH_REDIRECT_MESSAGE);
        return;
      }

      if (!response.ok) {
        throw new Error(
          await getFriendlyApiErrorMessage(response, "完整报告生成失败，请稍后重试。"),
        );
      }

      router.refresh();
    } catch (actionError) {
      setError(toUserFriendlyErrorMessage(actionError, "完整报告生成失败，请稍后重试。"));
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Button tone="secondary" onClick={() => router.push(`/tasks/${taskId}/analysis`)}>
          返回分析页
        </Button>
        <Button onClick={runCompleteFlow} disabled={!canCompleteTask || pendingAction !== null}>
          {pendingAction === "complete" ? "正在完成整份报告..." : "一键完成报告"}
        </Button>
        <Button
          tone="secondary"
          onClick={() => runAction("outline", `/api/tasks/${taskId}/generate-outline`)}
          disabled={!canGenerateOutline || pendingAction !== null}
        >
          {pendingAction === "outline" ? "正在生成大纲..." : "重新生成大纲"}
        </Button>
        <Button
          tone="secondary"
          onClick={() => runAction("report", `/api/tasks/${taskId}/generate-report`)}
          disabled={!canGenerateReport || pendingAction !== null}
        >
          {pendingAction === "report" ? "正在生成正文..." : "重新生成正文"}
        </Button>
        <Button
          tone="ghost"
          onClick={() => runAction("check", `/api/tasks/${taskId}/consistency-check`)}
          disabled={!canRunCheck || pendingAction !== null}
        >
          {pendingAction === "check" ? "正在检查..." : "运行一致性检查"}
        </Button>
        {canExportDocx ? (
          <ButtonLink
            href={`/api/tasks/${taskId}/export-docx?mode=auto`}
            tone="secondary"
          >
            保留原任务书导出 DOCX
          </ButtonLink>
        ) : null}
        {canExportDocx ? (
          <ButtonLink
            href={`/api/tasks/${taskId}/export-docx?mode=generated_report_docx`}
            tone="ghost"
          >
            生成新版 DOCX（非原格式）
          </ButtonLink>
        ) : null}
      </div>

      {canExportDocx ? (
        <p className="text-xs leading-6 text-[color:var(--muted)]">
          默认导出会保留原任务书格式，只在任务下方追加生成内容；如果原文件是 .doc
          且无法安全转换为 .docx，系统会停止并提示上传标准 .docx，不会用新报告冒充原格式填充。
        </p>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-[color:var(--danger)]/30 bg-[color:var(--danger-soft)] px-4 py-3 text-sm text-[color:var(--danger)]">
          {error}
        </div>
      ) : null}
    </div>
  );
}
