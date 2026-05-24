"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge, Button, Card, CardDescription, CardTitle } from "@/components/ui";
import {
  getFriendlyApiErrorMessage,
  readJsonSafely,
  toUserFriendlyErrorMessage,
} from "@/lib/utils";

type UploadKey = "task_book" | "template" | "screenshot" | "data" | "code";
type UploadMap = Record<UploadKey, File[]>;

const inputClass =
  "w-full rounded-lg border border-[color:var(--border)] bg-white/82 px-4 py-3 text-sm outline-none focus:border-[color:var(--border-strong)] focus:ring-4 focus:ring-[color:var(--ring)]";

function stem(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "");
}

function FilePicker({
  label,
  hint,
  accept,
  multiple,
  files,
  onChange,
}: {
  label: string;
  hint: string;
  accept?: string;
  multiple?: boolean;
  files: File[];
  onChange: (files: FileList | null) => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-[color:var(--border)] bg-white/66 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-[color:var(--foreground)]">{label}</p>
          <p className="mt-1 text-sm leading-6 text-[color:var(--muted)]">{hint}</p>
        </div>
        <Badge tone={files.length ? "success" : "neutral"}>{files.length}</Badge>
      </div>
      <input
        className={inputClass}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={(event) => onChange(event.target.files)}
      />
      {files.length ? (
        <ul className="space-y-2 text-sm leading-6 text-[color:var(--foreground-soft)]">
          {files.map((file) => (
            <li key={`${file.name}-${file.size}`} className="truncate">
              {file.name}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

async function uploadFiles(taskId: string, fileType: UploadKey, files: File[]) {
  for (const file of files) {
    const formData = new FormData();
    formData.append("taskId", taskId);
    formData.append("fileType", fileType);
    formData.append("file", file);

    const response = await fetch("/api/upload", { method: "POST", body: formData });
    if (!response.ok) {
      throw new Error(await getFriendlyApiErrorMessage(response, `${file.name} 上传失败。`));
    }
  }
}

export function NewTaskForm() {
  const router = useRouter();
  const [requirementText, setRequirementText] = useState("");
  const [notes, setNotes] = useState("");
  const [uploads, setUploads] = useState<UploadMap>({
    task_book: [],
    template: [],
    screenshot: [],
    data: [],
    code: [],
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(
    () =>
      stem(
        uploads.task_book[0]?.name ||
          uploads.template[0]?.name ||
          requirementText.slice(0, 28) ||
          "实验报告任务",
      ),
    [requirementText, uploads],
  );
  const fileCount = Object.values(uploads).reduce((sum, files) => sum + files.length, 0);

  function setFiles(key: UploadKey, files: FileList | null) {
    setUploads((current) => ({ ...current, [key]: files ? Array.from(files) : [] }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!uploads.task_book.length && !requirementText.trim()) {
      setError("请先输入实验任务要求，或上传任务书文件。");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          experimentName: "",
          courseName: "",
          requirementText,
          taskBookText: "",
          notes,
          templateInstructions: "",
        }),
      });
      const payload = await readJsonSafely<{ task?: { id: string }; error?: string }>(
        response.clone(),
      );
      if (!response.ok || !payload?.task?.id) {
        throw new Error(await getFriendlyApiErrorMessage(response, "创建任务失败。"));
      }

      await uploadFiles(payload.task.id, "task_book", uploads.task_book);
      await uploadFiles(payload.task.id, "template", uploads.template);
      await uploadFiles(payload.task.id, "screenshot", uploads.screenshot);
      await uploadFiles(payload.task.id, "data", uploads.data);
      await uploadFiles(payload.task.id, "code", uploads.code);

      router.push(`/tasks/${payload.task.id}/analysis`);
      router.refresh();
    } catch (submitError) {
      setError(toUserFriendlyErrorMessage(submitError, "提交失败，请稍后重试。"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]" onSubmit={submit}>
      <div className="space-y-5">
        <Card className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>新建实验任务</CardTitle>
              <CardDescription className="mt-2">
                上传老师任务书、数据文件和补充材料。系统会先识别文件角色，
                再进入解析和 Agent 工作台。
              </CardDescription>
            </div>
            <Badge tone="accent">{fileCount} 个文件</Badge>
          </div>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-[color:var(--foreground)]">
              实验任务要求（可选）
            </span>
            <textarea
              className={`${inputClass} min-h-44 resize-y`}
              value={requirementText}
              onChange={(event) => setRequirementText(event.target.value)}
              placeholder="可以直接粘贴老师要求；如果已上传任务书，也可以留空。"
            />
          </label>
          <FilePicker
            label="任务书 / 老师原始文档"
            hint="支持 docx、doc、txt、md。CSV/XLSX 不会作为任务书解析，会作为数据集进入后续流程。"
            accept=".docx,.doc,.txt,.md,.pdf,.png,.jpg,.jpeg"
            files={uploads.task_book}
            onChange={(files) => setFiles("task_book", files)}
          />
          <FilePicker
            label="报告模板（可选）"
            hint="支持标准 .docx 模板。若任务书本身就是模板，通常不用重复上传。"
            accept=".docx"
            files={uploads.template}
            onChange={(files) => setFiles("template", files)}
          />
        </Card>

        <Card className="space-y-4">
          <CardTitle>补充材料</CardTitle>
          <CardDescription>
            这些文件不会被当作任务书解析，但会在代码生成、运行或报告整理时作为上下文使用。
          </CardDescription>
          <div className="grid gap-4 lg:grid-cols-3">
            <FilePicker
              label="截图材料"
              hint="已有真实截图或参考图片。系统不会把 AI 图片当作真实运行截图。"
              accept=".png,.jpg,.jpeg"
              multiple
              files={uploads.screenshot}
              onChange={(files) => setFiles("screenshot", files)}
            />
            <FilePicker
              label="数据文件"
              hint="CSV、Excel、JSON 等实验数据，会进入代码生成和运行目录。"
              multiple
              files={uploads.data}
              onChange={(files) => setFiles("data", files)}
            />
            <FilePicker
              label="已有代码"
              hint="py、js、html、css、txt 等文件可作为参考或待运行材料。"
              multiple
              files={uploads.code}
              onChange={(files) => setFiles("code", files)}
            />
          </div>
        </Card>
      </div>

      <Card className="space-y-4 self-start">
        <CardTitle>创建后会发生什么</CardTitle>
        <ol className="space-y-2 text-sm leading-7 text-[color:var(--foreground-soft)]">
          <li>1. 进入分析页，确认系统识别出的文件角色。</li>
          <li>2. 选择任务书，执行 document-ingestion 解析。</li>
          <li>3. 确认 AI 分析结果，再进入工作台。</li>
          <li>4. 工作台生成代码、真实运行、生成截图和 Trace。</li>
          <li>5. 导出 DOCX 时默认保留原模板，仅在任务下方追加内容。</li>
        </ol>
        <textarea
          className={`${inputClass} min-h-36 resize-y`}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="补充说明，例如：按老师模板填写；截图必须来自真实运行；CSV 文件在附件里。"
        />
        {error ? (
          <div className="rounded-lg border border-[color:var(--danger)]/30 bg-[color:var(--danger-soft)] px-4 py-3 text-sm text-[color:var(--danger)]">
            {error}
          </div>
        ) : null}
        <Button className="w-full" size="lg" type="submit" disabled={submitting}>
          {submitting ? "正在创建任务..." : "创建任务并进入解析"}
        </Button>
      </Card>
    </form>
  );
}
