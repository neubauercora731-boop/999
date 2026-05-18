"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui";
import {
  getFriendlyApiErrorMessage,
  toUserFriendlyErrorMessage,
} from "@/lib/utils";

export function TaskListActions({
  taskId,
  taskTitle,
}: {
  taskId: string;
  taskTitle: string;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteTask() {
    const confirmed = window.confirm(`确定删除“${taskTitle}”吗？删除后任务历史不可恢复。`);
    if (!confirmed) return;

    setDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(await getFriendlyApiErrorMessage(response, "删除任务失败。"));
      }
      router.refresh();
    } catch (deleteError) {
      setError(toUserFriendlyErrorMessage(deleteError, "删除任务失败。"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="mt-auto flex flex-wrap gap-3">
        <Link
          href={`/tasks/${taskId}`}
          className="inline-flex h-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--primary),var(--primary-deep))] px-5 text-sm font-medium text-white transition hover:-translate-y-0.5"
        >
          查看详情
        </Link>
        <Link
          href={`/tasks/${taskId}/analysis`}
          className="inline-flex h-11 items-center justify-center rounded-full border border-[color:var(--border-strong)] bg-white/75 px-5 text-sm font-medium transition hover:bg-white"
        >
          解析确认
        </Link>
        <Button tone="danger" onClick={deleteTask} disabled={deleting}>
          {deleting ? "删除中..." : "删除任务"}
        </Button>
      </div>
      {error ? (
        <p className="rounded-[1rem] border border-[color:var(--danger)]/30 bg-[color:var(--danger-soft)] px-4 py-3 text-sm text-[color:var(--danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
