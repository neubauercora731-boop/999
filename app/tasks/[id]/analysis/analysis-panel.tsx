"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge, Button, Card, CardDescription, CardTitle, StepIndicator } from "@/components/ui";
import type { ParsedRequirement } from "@/lib/ai/types";
import { fileRoleLabels, type FileRole } from "@/lib/agent/document-ingestion/file-role";
import {
  getFriendlyApiErrorMessage,
  readJsonSafely,
  toUserFriendlyErrorMessage,
} from "@/lib/utils";

interface AnalysisPanelProps {
  taskId: string;
  initialParsedRequirement: ParsedRequirement | null;
  initialAnalysisStatus: string;
  fileCount: number;
  files: DocumentParsingFile[];
}

interface DocumentParsingFile {
  id: string;
  fileType: string;
  fileName: string;
  mimeType: string | null;
  fileSize: number | null;
  hasParsedText: boolean;
  role: FileRole;
  roleConfidence: number;
  roleReason: string;
  parseSupported: boolean;
  structuredTask: Record<string, unknown> | null;
  normalizedTextPreview: string | null;
  warnings: string[];
}

interface StructuredDocumentTask {
  title?: string;
  courseName?: string;
  taskType?: string;
  language?: string;
  explicitRequirements?: string[];
  implicitRequirements?: string[];
  deliverables?: string[];
  reportSections?: string[];
  codeRequirements?: string[];
  runRequirements?: string[];
  formatRequirements?: string[];
  missingInfo?: string[];
  riskNotes?: string[];
  structuredBy?: "moonshot" | "fallback";
  source?: "moonshot" | "fallback";
  warnings?: string[];
}

interface ParseDocumentSuccess {
  success: true;
  fileType: string;
  rawTextPreview: string;
  normalizedTextPreview: string;
  structuredTask: StructuredDocumentTask;
  warnings: string[];
}

interface ParseDocumentFailure {
  success: false;
  errorCode?: string;
  message?: string;
  error?: string;
}

type ParseDocumentResponse = ParseDocumentSuccess | ParseDocumentFailure;
type ParseStatus = "idle" | "parsing" | "success" | "error";

const inputClass =
  "w-full rounded-[1rem] border border-[color:var(--border)] bg-white/80 px-3 py-2 text-sm outline-none focus:border-[color:var(--border-strong)] focus:ring-4 focus:ring-[color:var(--ring)]";

function getExtension(fileName: string) {
  const lastDotIndex = fileName.lastIndexOf(".");
  return lastDotIndex >= 0 ? fileName.slice(lastDotIndex + 1).toLowerCase() : "";
}

function getDocumentSupport(file: DocumentParsingFile) {
  const extension = getExtension(file.fileName);
  if (file.parseSupported) {
    return { supported: true, label: extension === "markdown" ? "md" : extension };
  }
  if (extension === "pdf" || file.mimeType === "application/pdf") {
    return { supported: false, label: "pdf", reason: "当前版本暂不支持 PDF 文本解析" };
  }
  if (file.mimeType?.startsWith("image/") || ["png", "jpg", "jpeg", "webp"].includes(extension)) {
    return { supported: false, label: "image", reason: "当前版本暂不支持图片 OCR" };
  }
  return { supported: false, label: extension || "unknown", reason: "当前版本暂不支持该文件类型" };
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return "未知";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function getFileActionHint(file: DocumentParsingFile) {
  if (file.role === "task_book" && file.parseSupported) {
    return "可选择为任务书并解析";
  }
  if (file.role === "report_template") {
    return "作为报告模板保存，暂不建议按任务书解析";
  }
  if (file.role === "dataset") {
    return "作为数据文件保存，不进入任务书解析";
  }
  if (file.role === "screenshot") {
    return "作为截图材料保存，当前暂不支持 OCR";
  }
  if (file.role === "source_code") {
    return "作为代码文件保存，暂不走任务书解析";
  }
  if (file.role === "reference") {
    return file.parseSupported ? "可手动选择解析，但请确认它是任务书" : "作为参考资料保存";
  }
  return file.parseSupported ? "可手动选择解析" : "当前不支持解析";
}

function asStructuredTask(value: Record<string, unknown> | null): StructuredDocumentTask | null {
  if (!value) return null;
  return value as StructuredDocumentTask;
}

function getInitialParseResult(file: DocumentParsingFile | undefined): ParseDocumentSuccess | null {
  if (!file?.structuredTask && !file?.normalizedTextPreview) return null;
  const support = file ? getDocumentSupport(file) : { label: "unknown" };
  return {
    success: true,
    fileType: support.label,
    rawTextPreview: file.normalizedTextPreview ?? "",
    normalizedTextPreview: file.normalizedTextPreview ?? "",
    structuredTask: asStructuredTask(file.structuredTask) ?? {},
    warnings: file.warnings,
  };
}

function readList(task: StructuredDocumentTask, key: keyof StructuredDocumentTask) {
  const value = task[key];
  return Array.isArray(value) ? value.filter((item): item is string => Boolean(item)) : [];
}

function FieldValue({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-[1rem] border border-[color:var(--border)] bg-white/64 p-3">
      <p className="text-xs font-semibold text-[color:var(--muted)]">{label}</p>
      <p className="mt-1 text-sm leading-6 text-[color:var(--foreground)]">
        {value?.trim() || "未识别到"}
      </p>
    </div>
  );
}

function ListValue({
  label,
  values,
}: {
  label: string;
  values: string[];
}) {
  return (
    <div className="rounded-[1rem] border border-[color:var(--border)] bg-white/64 p-3">
      <p className="text-xs font-semibold text-[color:var(--muted)]">{label}</p>
      {values.length ? (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-[color:var(--foreground-soft)]">
          {values.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-[color:var(--foreground-soft)]">未识别到</p>
      )}
    </div>
  );
}

function emptyAnalysis(): ParsedRequirement {
  return {
    experiment_title: "",
    course_name: "",
    purpose: "",
    required_sections: [],
    coding_tasks: [],
    materials_needed: [],
    missing_info: [],
    risk_notes: [],
    task_type: "python_lab",
    language: "Python",
    expected_output: "运行代码并保存 stdout/stderr 作为证据。",
    report_outline: [],
    assumptions: ["使用内置示例数据"],
  };
}

function LinesEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-semibold">{label}</span>
      <textarea
        className={`${inputClass} min-h-24 resize-y`}
        value={value.join("\n")}
        onChange={(event) =>
          onChange(
            event.target.value
              .split("\n")
              .map((item) => item.trim())
              .filter(Boolean),
          )
        }
      />
    </label>
  );
}

function DocumentParsingPanel({
  taskId,
  files,
  onConfirm,
  disabled,
}: {
  taskId: string;
  files: DocumentParsingFile[];
  onConfirm: () => Promise<void>;
  disabled: boolean;
}) {
  const taskBookCandidates = useMemo(
    () =>
      files.filter(
        (file) =>
          file.parseSupported &&
          file.role !== "dataset" &&
          file.role !== "screenshot" &&
          file.role !== "source_code",
      ),
    [files],
  );
  const datasetFiles = useMemo(
    () => files.filter((file) => file.role === "dataset"),
    [files],
  );
  const preferredFileId = useMemo(() => {
    const supportedTaskBook = taskBookCandidates.find(
      (file) => file.role === "task_book" && file.parseSupported,
    );
    const supported = taskBookCandidates.find((file) => file.parseSupported);
    return supportedTaskBook?.id ?? supported?.id ?? "";
  }, [taskBookCandidates]);
  const [selectedFileId, setSelectedFileId] = useState(preferredFileId);
  const selectedFile =
    taskBookCandidates.find((file) => file.id === selectedFileId) ?? taskBookCandidates[0];
  const selectedSupport = selectedFile
    ? getDocumentSupport(selectedFile)
    : { supported: false, label: "unknown", reason: "" };
  const [status, setStatus] = useState<ParseStatus>("idle");
  const [parseResult, setParseResult] = useState<ParseDocumentSuccess | null>(() =>
    getInitialParseResult(selectedFile),
  );
  const [parseError, setParseError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!selectedFileId && preferredFileId) {
      setSelectedFileId(preferredFileId);
    }
  }, [preferredFileId, selectedFileId]);

  useEffect(() => {
    const initial = getInitialParseResult(selectedFile);
    setParseResult(initial);
    setStatus(initial ? "success" : "idle");
    setParseError(null);
    setExpanded(false);
  }, [selectedFile]);

  async function parseDocument() {
    if (!selectedFile) return;
    setStatus("parsing");
    setParseError(null);

    try {
      const response = await fetch(`/api/tasks/${taskId}/parse-document`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: selectedFile.id }),
      });
      const payload = await readJsonSafely<ParseDocumentResponse>(response.clone());

      if (!response.ok || !payload?.success) {
        const message =
          payload && !payload.success
            ? payload.message || payload.error || "文档解析失败，请检查文件格式后重试。"
            : await getFriendlyApiErrorMessage(response, "文档解析失败，请检查文件格式后重试。");
        throw new Error(message);
      }

      setParseResult(payload);
      setStatus("success");
    } catch (error) {
      setParseError(toUserFriendlyErrorMessage(error, "文档解析失败，请检查文件格式后重试。"));
      setStatus("error");
    }
  }

  const task = parseResult?.structuredTask ?? {};
  const preview = parseResult?.normalizedTextPreview || parseResult?.rawTextPreview || "";
  const previewText = expanded ? preview : preview.slice(0, 1200);

  return (
    <Card className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>文档解析预览</CardTitle>
          <CardDescription className="mt-2">
            先读取任务书并展示系统识别结果，确认后再进入正式 AI 分析。
          </CardDescription>
        </div>
        <Badge tone={status === "success" ? "success" : status === "error" ? "danger" : "neutral"}>
          {status === "parsing"
            ? "解析中"
            : status === "success"
              ? "已解析"
              : status === "error"
                ? "解析失败"
                : "未解析"}
        </Badge>
      </div>

      {files.length === 0 ? (
        <div className="rounded-[1rem] border border-[color:var(--border)] bg-white/64 p-4 text-sm leading-7 text-[color:var(--muted)]">
          当前任务没有可解析的任务书文件，你可以直接使用文本要求进行 AI 分析。
        </div>
      ) : (
        <div className="space-y-4">
          <label className="grid gap-2">
            <span className="text-sm font-semibold">请选择要解析的任务书文件</span>
            <select
              className={inputClass}
              value={selectedFile?.id ?? ""}
              onChange={(event) => setSelectedFileId(event.target.value)}
            >
              {taskBookCandidates.map((file) => {
                const support = getDocumentSupport(file);
                return (
                  <option key={file.id} value={file.id}>
                    {file.fileName} - {fileRoleLabels[file.role]} -{" "}
                    {support.supported ? "支持解析" : support.reason}
                  </option>
                );
              })}
            </select>
          </label>

          {taskBookCandidates.length === 0 ? (
            <div className="rounded-[1rem] border border-[color:var(--warning)]/30 bg-[color:var(--warning-soft)] px-4 py-3 text-sm leading-6 text-[color:var(--warning)]">
              没有可作为任务书解析的文件。CSV 是数据文件，不是任务书；请选择或上传 .doc/.docx/.txt/.md 任务书。
            </div>
          ) : null}

          {datasetFiles.length ? (
            <div className="rounded-[1rem] border border-[color:var(--border)] bg-white/64 p-4 text-sm leading-6 text-[color:var(--foreground-soft)]">
              <p className="font-semibold text-[color:var(--foreground)]">数据文件</p>
              <p className="mt-1">
                CSV/XLSX 会作为数据集进入代码生成和运行目录，不会作为任务书解析。
              </p>
              <ul className="mt-2 list-disc pl-5">
                {datasetFiles.map((file) => (
                  <li key={file.id}>{file.fileName}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="space-y-3">
            {files.map((file) => {
              const support = getDocumentSupport(file);
              const selected = selectedFile?.id === file.id;
              return (
                <div
                  key={file.id}
                  className={`rounded-[1rem] border p-4 ${
                    selected
                      ? "border-[color:var(--primary)] bg-white/78"
                      : "border-[color:var(--border)] bg-white/58"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-2">
                      <p className="truncate text-sm font-semibold text-[color:var(--foreground)]">
                        {file.fileName}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Badge tone={file.role === "task_book" ? "success" : "neutral"}>
                          {fileRoleLabels[file.role]}
                        </Badge>
                        <Badge tone={support.supported ? "success" : "warning"}>
                          {support.supported ? "支持文本解析" : "不支持文本解析"}
                        </Badge>
                        {file.structuredTask ? <Badge tone="success">已解析</Badge> : null}
                      </div>
                    </div>
                    <Button
                      tone={selected ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => {
                        if (file.parseSupported && file.role !== "dataset") {
                          setSelectedFileId(file.id);
                        }
                      }}
                      disabled={!file.parseSupported || file.role === "dataset"}
                    >
                      {file.role === "dataset" ? "数据文件" : selected ? "当前选择" : "选择"}
                    </Button>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs leading-5 text-[color:var(--foreground-soft)] md:grid-cols-2">
                    <p>文件大小：{formatFileSize(file.fileSize)}</p>
                    <p>文件类型：{support.label || file.mimeType || "unknown"}</p>
                    <p>推荐原因：{file.roleReason}</p>
                    <p>推荐置信度：{Math.round(file.roleConfidence * 100)}%</p>
                    <p>操作建议：{getFileActionHint(file)}</p>
                    <p>文本状态：{file.hasParsedText ? "已有文本内容" : "尚未提取文本"}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {selectedFile ? (
            <div className="grid gap-3 md:grid-cols-4">
              <FieldValue label="文件名" value={selectedFile.fileName} />
              <FieldValue label="文件类型" value={selectedSupport.label} />
              <FieldValue label="推荐角色" value={fileRoleLabels[selectedFile.role]} />
              <FieldValue
                label="文本状态"
                value={selectedFile.hasParsedText ? "已有文本内容" : "尚未提取文本"}
              />
            </div>
          ) : null}

          {!selectedSupport.supported ? (
            <div className="rounded-[1rem] border border-[color:var(--warning)]/30 bg-[color:var(--warning-soft)] px-4 py-3 text-sm leading-6 text-[color:var(--warning)]">
              {selectedSupport.reason}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={parseDocument}
              disabled={!selectedFile || !selectedSupport.supported || status === "parsing" || disabled}
            >
              {status === "parsing" ? "正在读取文档并提取实验要求..." : "解析选中的任务书"}
            </Button>
            <Button
              tone="secondary"
              onClick={onConfirm}
              disabled={status === "parsing" || disabled}
            >
              确认解析结果，进入 AI 分析
            </Button>
          </div>

          {status === "success" ? (
            <div className="rounded-[1rem] border border-[color:var(--success)]/30 bg-[color:var(--success-soft)] px-4 py-3 text-sm leading-6 text-[color:var(--success)]">
              文档解析完成，请确认系统识别的任务要求。
            </div>
          ) : null}

          {parseError ? (
            <div className="rounded-[1rem] border border-[color:var(--danger)]/30 bg-[color:var(--danger-soft)] px-4 py-3 text-sm leading-6 text-[color:var(--danger)]">
              {parseError}
            </div>
          ) : null}

          {parseResult ? (
            <div className="space-y-4">
              {parseResult.warnings.length ? (
                <div className="rounded-[1rem] border border-[color:var(--warning)]/30 bg-[color:var(--warning-soft)] p-4">
                  <p className="text-sm font-semibold text-[color:var(--warning)]">解析提示</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-[color:var(--warning)]">
                    {parseResult.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="rounded-[1rem] border border-[color:var(--border)] bg-white/64 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">原始文本预览</p>
                  {preview.length > 1200 ? (
                    <Button tone="ghost" size="sm" onClick={() => setExpanded((value) => !value)}>
                      {expanded ? "收起" : "展开"}
                    </Button>
                  ) : null}
                </div>
                <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-[1rem] bg-white/72 p-3 text-xs leading-6 text-[color:var(--foreground-soft)]">
                  {previewText || "未识别到"}
                </pre>
              </div>

              <div className="grid gap-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <FieldValue label="实验标题" value={task.title} />
                  <FieldValue label="课程名称" value={task.courseName} />
                  <FieldValue label="任务类型" value={task.taskType} />
                  <FieldValue label="编程语言" value={task.language} />
                </div>
                <ListValue label="显性要求" values={readList(task, "explicitRequirements")} />
                <ListValue label="隐性要求" values={readList(task, "implicitRequirements")} />
                <ListValue label="交付物" values={readList(task, "deliverables")} />
                <ListValue label="报告章节" values={readList(task, "reportSections")} />
                <ListValue label="代码要求" values={readList(task, "codeRequirements")} />
                <ListValue label="运行要求" values={readList(task, "runRequirements")} />
                <ListValue label="格式要求" values={readList(task, "formatRequirements")} />
                <ListValue label="缺失信息" values={readList(task, "missingInfo")} />
                <ListValue label="风险提示" values={readList(task, "riskNotes")} />
              </div>
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );
}

export function AnalysisPanel({
  taskId,
  initialParsedRequirement,
  initialAnalysisStatus,
  fileCount,
  files,
}: AnalysisPanelProps) {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<ParsedRequirement>(
    initialParsedRequirement ?? emptyAnalysis(),
  );
  const [analyzing, setAnalyzing] = useState(initialAnalysisStatus === "running");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialParsedRequirement) setAnalysis(initialParsedRequirement);
  }, [initialParsedRequirement]);

  async function runAnalyze() {
    setAnalyzing(true);
    setError(null);
    try {
      const response = await fetch(`/api/tasks/${taskId}/analyze`, { method: "POST" });
      const payload = await readJsonSafely<{
        parsedRequirement?: ParsedRequirement;
        error?: string;
      }>(response.clone());
      if (!response.ok || !payload?.parsedRequirement) {
        throw new Error(await getFriendlyApiErrorMessage(response, "结构化分析失败。"));
      }
      setAnalysis(payload.parsedRequirement);
      router.refresh();
    } catch (analyzeError) {
      setError(toUserFriendlyErrorMessage(analyzeError, "结构化分析失败。"));
    } finally {
      setAnalyzing(false);
    }
  }

  async function confirm() {
    setConfirming(true);
    setError(null);
    try {
      const response = await fetch(`/api/tasks/${taskId}/confirm-analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis }),
      });
      if (!response.ok) {
        throw new Error(await getFriendlyApiErrorMessage(response, "确认解析结果失败。"));
      }
      router.push(`/tasks/${taskId}`);
      router.refresh();
    } catch (confirmError) {
      setError(toUserFriendlyErrorMessage(confirmError, "确认解析结果失败。"));
    } finally {
      setConfirming(false);
    }
  }

  const hasAnalysis = Boolean(analysis.experiment_title || initialParsedRequirement);
  const missingCount = analysis.missing_info.length;

  return (
    <div className="space-y-6">
      <StepIndicator
        steps={["上传", "解析", "确认", "生成/运行", "导出"]}
        activeStep={hasAnalysis ? 2 : 1}
        completedSteps={hasAnalysis ? 2 : 1}
      />

      {missingCount > 0 ? (
        <div className="rounded-[1.25rem] border border-[color:var(--warning)]/30 bg-[color:var(--warning-soft)] px-5 py-4 text-sm leading-7 text-[color:var(--warning)]">
          AI 识别到 {missingCount} 项缺失信息，请补充材料或在下方修改后再确认。
        </div>
      ) : null}

      <DocumentParsingPanel
        taskId={taskId}
        files={files}
        onConfirm={runAnalyze}
        disabled={analyzing || confirming}
      />

      <Card className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>结构化任务 JSON</CardTitle>
            <CardDescription className="mt-2">
              上传材料 {fileCount} 个。用户确认后才会进入代码生成和运行工作台。
            </CardDescription>
          </div>
          <Badge tone={hasAnalysis ? "warning" : "neutral"}>
            {hasAnalysis ? "待用户确认" : "待分析"}
          </Badge>
        </div>

        {!hasAnalysis ? (
          <div className="space-y-4">
            <Button onClick={runAnalyze} disabled={analyzing}>
              {analyzing ? "分析中..." : "开始解析任务书"}
            </Button>
            {error ? (
              <div className="rounded-[1rem] border border-[color:var(--danger)]/30 bg-[color:var(--danger-soft)] px-4 py-3 text-sm text-[color:var(--danger)]">
                {error}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm font-semibold">实验名称</span>
              <input
                className={inputClass}
                value={analysis.experiment_title}
                onChange={(event) =>
                  setAnalysis((current) => ({
                    ...current,
                    experiment_title: event.target.value,
                  }))
                }
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold">课程名称</span>
              <input
                className={inputClass}
                value={analysis.course_name}
                onChange={(event) =>
                  setAnalysis((current) => ({ ...current, course_name: event.target.value }))
                }
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold">实验目的</span>
              <textarea
                className={`${inputClass} min-h-24 resize-y`}
                value={analysis.purpose}
                onChange={(event) =>
                  setAnalysis((current) => ({ ...current, purpose: event.target.value }))
                }
              />
            </label>

            <LinesEditor
              label="报告章节"
              value={analysis.required_sections}
              onChange={(required_sections) =>
                setAnalysis((current) => ({ ...current, required_sections }))
              }
            />
            <LinesEditor
              label="所需材料"
              value={analysis.materials_needed}
              onChange={(materials_needed) =>
                setAnalysis((current) => ({ ...current, materials_needed }))
              }
            />
            <LinesEditor
              label="缺失信息"
              value={analysis.missing_info}
              onChange={(missing_info) =>
                setAnalysis((current) => ({ ...current, missing_info }))
              }
            />
            <LinesEditor
              label="风险提示"
              value={analysis.risk_notes}
              onChange={(risk_notes) =>
                setAnalysis((current) => ({ ...current, risk_notes }))
              }
            />

            <div className="space-y-3">
              <p className="text-sm font-semibold">Python 任务</p>
              {analysis.coding_tasks.map((task, index) => (
                <div
                  key={`${task.task_name}-${index}`}
                  className="grid gap-3 rounded-[1.1rem] border border-[color:var(--border)] bg-white/62 p-4"
                >
                  <input
                    className={inputClass}
                    value={task.task_name}
                    onChange={(event) =>
                      setAnalysis((current) => ({
                        ...current,
                        coding_tasks: current.coding_tasks.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, task_name: event.target.value } : item,
                        ),
                      }))
                    }
                    placeholder="任务名称"
                  />
                  <textarea
                    className={`${inputClass} min-h-20 resize-y`}
                    value={task.description}
                    onChange={(event) =>
                      setAnalysis((current) => ({
                        ...current,
                        coding_tasks: current.coding_tasks.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, description: event.target.value } : item,
                        ),
                      }))
                    }
                    placeholder="任务描述"
                  />
                  <input
                    className={inputClass}
                    value={task.expected_output}
                    onChange={(event) =>
                      setAnalysis((current) => ({
                        ...current,
                        coding_tasks: current.coding_tasks.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, expected_output: event.target.value }
                            : item,
                        ),
                      }))
                    }
                    placeholder="预期输出"
                  />
                </div>
              ))}
            </div>

            <details className="rounded-[1rem] border border-[color:var(--border)] bg-white/62 p-4">
              <summary className="cursor-pointer text-sm font-semibold">查看 JSON</summary>
              <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap text-xs leading-6">
                {JSON.stringify(analysis, null, 2)}
              </pre>
            </details>

            {error ? (
              <div className="rounded-[1rem] border border-[color:var(--danger)]/30 bg-[color:var(--danger-soft)] px-4 py-3 text-sm text-[color:var(--danger)]">
                {error}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <Button onClick={confirm} disabled={confirming}>
                {confirming ? "保存确认中..." : "确认无误，进入生成"}
              </Button>
              <Button tone="secondary" onClick={runAnalyze} disabled={analyzing || confirming}>
                重新解析
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
