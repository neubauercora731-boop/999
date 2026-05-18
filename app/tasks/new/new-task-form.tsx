"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge, Button, Card, CardDescription, CardTitle } from "@/components/ui";
import { getApiErrorMessage, readJsonSafely } from "@/lib/utils";

type UploadKey = "task_book" | "template" | "screenshot" | "data" | "code";
type UploadMap = Record<UploadKey, File[]>;

const inputClass =
  "w-full rounded-[1rem] border border-[color:var(--border)] bg-white/80 px-4 py-3 text-sm outline-none focus:border-[color:var(--border-strong)] focus:ring-4 focus:ring-[color:var(--ring)]";

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
    <div className="space-y-3 rounded-[1.35rem] border border-[color:var(--border)] bg-white/62 p-4">
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
      throw new Error(await getApiErrorMessage(response, `${file.name} 上传失败。`));
    }
  }
}

export function NewTaskForm() {
  const router = useRouter();
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
    () => stem(uploads.task_book[0]?.name || uploads.template[0]?.name || "Python 实验报告任务"),
    [uploads],
  );
  const fileCount = Object.values(uploads).reduce((sum, files) => sum + files.length, 0);

  function setFiles(key: UploadKey, files: FileList | null) {
    setUploads((current) => ({ ...current, [key]: files ? Array.from(files) : [] }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!uploads.task_book.length) {
      setError("请先上传任务书文件。P0 支持 docx、pdf、png、jpg、txt；其中 pdf/图片 OCR 暂为后续能力。");
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
          requirementText: "",
          taskBookText: "",
          notes,
          templateInstructions: "",
        }),
      });
      const payload = await readJsonSafely<{ task?: { id: string }; error?: string }>(
        response.clone(),
      );
      if (!response.ok || !payload?.task?.id) {
        throw new Error(await getApiErrorMessage(response, "创建任务失败。"));
      }

      await uploadFiles(payload.task.id, "task_book", uploads.task_book);
      await uploadFiles(payload.task.id, "template", uploads.template);
      await uploadFiles(payload.task.id, "screenshot", uploads.screenshot);
      await uploadFiles(payload.task.id, "data", uploads.data);
      await uploadFiles(payload.task.id, "code", uploads.code);

      router.push(`/tasks/${payload.task.id}/analysis`);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "提交失败。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]" onSubmit={submit}>
      <div className="space-y-5">
        <Card className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>新建 Python 实验报告任务</CardTitle>
              <CardDescription className="mt-2">
                上传任务书、模板和补充材料。系统只生成学习辅助草稿，不自动提交学校系统，不伪造截图。
              </CardDescription>
            </div>
            <Badge tone="accent">{fileCount} 个文件</Badge>
          </div>
          <FilePicker
            label="任务书文件"
            hint="必填。支持 docx/pdf/png/jpg/txt；pdf/图片当前会保存原件并提示后续 OCR。"
            accept=".docx,.pdf,.png,.jpg,.jpeg,.txt"
            files={uploads.task_book}
            onChange={(files) => setFiles("task_book", files)}
          />
          <FilePicker
            label="实验报告模板"
            hint="可选。当前 P0 导出会使用模板信息，若无模板则使用系统默认模板。"
            accept=".docx"
            files={uploads.template}
            onChange={(files) => setFiles("template", files)}
          />
        </Card>

        <Card className="space-y-4">
          <CardTitle>补充材料</CardTitle>
          <div className="grid gap-4 lg:grid-cols-3">
            <FilePicker
              label="截图"
              hint="只接收真实截图或用户上传材料。"
              accept=".png,.jpg,.jpeg"
              multiple
              files={uploads.screenshot}
              onChange={(files) => setFiles("screenshot", files)}
            />
            <FilePicker
              label="数据文件"
              hint="CSV、Excel、JSON 等实验数据。"
              multiple
              files={uploads.data}
              onChange={(files) => setFiles("data", files)}
            />
            <FilePicker
              label="代码文件"
              hint="已有 py/ipynb/txt 代码可作为参考。"
              multiple
              files={uploads.code}
              onChange={(files) => setFiles("code", files)}
            />
          </div>
        </Card>
      </div>

      <Card className="space-y-4 self-start">
        <CardTitle>P0 闭环边界</CardTitle>
        <ul className="space-y-2 text-sm leading-7 text-[color:var(--foreground-soft)]">
          <li>1. 先解析文本，再由用户确认结构化任务 JSON。</li>
          <li>2. 生成代码、运行代码、生成报告草稿分开操作。</li>
          <li>3. stdout/stderr 会保存为运行证据，失败时展示错误。</li>
          <li>4. 导出前用户可编辑报告草稿。</li>
        </ul>
        <textarea
          className={`${inputClass} min-h-36 resize-y`}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="补充说明，例如：按老师模板章节；不要虚构截图；数据文件在附件里。"
        />
        {error ? (
          <div className="rounded-[1rem] border border-[color:var(--danger)]/30 bg-[color:var(--danger-soft)] px-4 py-3 text-sm text-[color:var(--danger)]">
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
