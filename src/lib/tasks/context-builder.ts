import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  BuiltTaskContext,
  ConsistencyCheckResult,
  OutlineDocument,
  ParsedRequirement,
  TaskContextFile,
} from "@/lib/ai/types";
import { outlineSchema } from "@/lib/ai/types";
import { inferFileRole } from "@/lib/agent/document-ingestion/file-role";
import { buildCsvDatasetPreview, isCsvFile } from "@/lib/datasets/csv";
import type { TaskDetail, TaskFileRecord } from "@/lib/tasks/contracts";
import { getTaskDetail, RepositoryError } from "@/lib/tasks/repository";
import { truncateText } from "@/lib/utils";

function hasKeys(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") {
    return false;
  }

  return Object.keys(value).length > 0;
}

function getFileExcerpt(file: TaskFileRecord) {
  if (file.parsed_text) {
    return file.parsed_text;
  }

  const parsedText = file.metadata?.parsed_text;
  if (typeof parsedText === "string") {
    return parsedText;
  }

  const excerpt = file.metadata?.text_excerpt;
  return typeof excerpt === "string" ? excerpt : null;
}

function getFileRole(file: TaskFileRecord) {
  const metadataRole =
    typeof file.metadata?.file_role === "string"
      ? file.metadata.file_role
      : typeof file.metadata?.inferred_file_role === "string"
        ? file.metadata.inferred_file_role
        : "";

  if (metadataRole) return metadataRole;
  if (file.file_type === "data") return "dataset";
  if (file.file_type === "code") return "source_code";
  if (file.file_type === "template") return "report_template";

  return inferFileRole(file.original_filename, file.mime_type).role;
}

function getDatasetPreview(file: TaskFileRecord) {
  const dataset = file.metadata?.dataset;
  if (dataset && typeof dataset === "object") {
    return dataset as TaskContextFile["datasetPreview"];
  }

  const excerpt = getFileExcerpt(file);
  if (excerpt && isCsvFile(file.original_filename, file.mime_type)) {
    const preview = buildCsvDatasetPreview(file.original_filename, excerpt);
    return preview ? { kind: "csv", ...preview } : null;
  }

  return null;
}

function mapTaskFile(file: TaskFileRecord): TaskContextFile {
  const role = getFileRole(file);
  return {
    id: file.id,
    fileType: file.file_type,
    fileName: file.original_filename,
    mimeType: file.mime_type,
    storagePath: file.storage_path,
    excerpt: getFileExcerpt(file),
    role,
    datasetPreview: role === "dataset" ? getDatasetPreview(file) : null,
  };
}

function getConfirmationNotes(taskDetail: TaskDetail) {
  const rawPayload = taskDetail.input?.raw_payload;
  const note = rawPayload?.analysisConfirmationNotes;

  return typeof note === "string" ? note : "";
}

function getRequirementText(taskDetail: TaskDetail) {
  const documentIngestionText = getDocumentIngestionText(taskDetail);
  if (documentIngestionText) {
    return documentIngestionText;
  }

  const taskBookText = taskDetail.input?.task_book_text?.trim();
  if (taskBookText) {
    return taskBookText;
  }

  const fileExcerptText = taskDetail.files
    .filter((file) => getFileRole(file) !== "dataset")
    .map((file) => getFileExcerpt(file)?.trim())
    .filter(Boolean)
    .join("\n\n");
  if (fileExcerptText) {
    return fileExcerptText;
  }

  const requirementText = taskDetail.input?.requirement_text?.trim();
  if (requirementText) {
    return requirementText;
  }

  return "";
}

function getDocumentIngestionText(taskDetail: TaskDetail) {
  const rawPayload = taskDetail.input?.raw_payload;
  const documentIngestion = rawPayload?.documentIngestion;
  if (!documentIngestion || typeof documentIngestion !== "object") {
    return "";
  }

  return Object.values(documentIngestion as Record<string, unknown>)
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      const record = item as Record<string, unknown>;
      const structuredTask = record.structured_task;
      const normalizedText = record.normalized_text;
      const sections = [];

      if (structuredTask && typeof structuredTask === "object") {
        sections.push(
          `[document-ingestion structured_task]\n${JSON.stringify(structuredTask, null, 2)}`,
        );
      }

      if (typeof normalizedText === "string" && normalizedText.trim()) {
        sections.push(`[document-ingestion normalized_text]\n${normalizedText.trim()}`);
      }

      return sections.join("\n\n");
    })
    .filter(Boolean)
    .join("\n\n");
}

function selectParsedRequirement(taskDetail: TaskDetail) {
  if (hasKeys(taskDetail.task.parsed_requirement_json)) {
    return taskDetail.task.parsed_requirement_json as ParsedRequirement;
  }

  if (
    taskDetail.task.analysis_summary &&
    ("experiment_title" in taskDetail.task.analysis_summary ||
      "experimentName" in taskDetail.task.analysis_summary)
  ) {
    return taskDetail.task.analysis_summary as ParsedRequirement;
  }

  const output = taskDetail.outputs.find((item) =>
    hasKeys(item.parsed_requirement_json),
  );

  return (output?.parsed_requirement_json as ParsedRequirement | null) ?? null;
}

function selectOutline(taskDetail: TaskDetail) {
  if (hasKeys(taskDetail.task.outline_json)) {
    const parsed = outlineSchema.safeParse(taskDetail.task.outline_json);
    if (parsed.success) {
      return parsed.data as OutlineDocument;
    }
  }

  const output = taskDetail.outputs.find((item) => hasKeys(item.outline_json));
  if (output?.outline_json) {
    const parsed = outlineSchema.safeParse(output.outline_json);
    if (parsed.success) {
      return parsed.data as OutlineDocument;
    }
  }

  return null;
}

function selectReportMarkdown(taskDetail: TaskDetail) {
  if (taskDetail.task.report_markdown) {
    return taskDetail.task.report_markdown;
  }

  const output = taskDetail.outputs.find((item) => Boolean(item.report_markdown));
  return output?.report_markdown ?? null;
}

function selectConsistency(taskDetail: TaskDetail) {
  const output = taskDetail.outputs.find((item) =>
    hasKeys(item.consistency_json),
  );
  return (output?.consistency_json as ConsistencyCheckResult | null) ?? null;
}

export function summarizeTaskFiles(files: TaskContextFile[]) {
  if (files.length === 0) {
    return "无";
  }

  return files
    .map((file) => {
      const excerpt = file.excerpt
        ? `\n文本摘录:\n${truncateText(file.excerpt, 1000)}`
        : "";
      return [
        `- 类型: ${file.fileType}`,
        `  文件名: ${file.fileName}`,
        `  MIME: ${file.mimeType ?? "unknown"}`,
        `  路径: ${file.storagePath}`,
        excerpt,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");
}

export function summarizeDatasetFiles(files: TaskContextFile[]) {
  const datasets = files.filter((file) => file.role === "dataset");
  if (datasets.length === 0) return "";

  return datasets
    .map((file) => {
      const preview = file.datasetPreview;
      return [
        `- 数据文件: ${file.fileName}`,
        `  MIME: ${file.mimeType ?? "unknown"}`,
        `  Storage path: ${file.storagePath}`,
        `  columns: ${(preview?.columns ?? []).join(", ") || "unknown"}`,
        `  rowCount: ${preview?.rowCount ?? "unknown"}`,
        `  delimiter: ${preview?.delimiter ?? "unknown"}`,
        preview?.rawTextPreview
          ? `  preview:\n${truncateText(preview.rawTextPreview, 1200)}`
          : file.excerpt
            ? `  preview:\n${truncateText(file.excerpt, 1200)}`
            : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

export async function buildTaskContext(
  supabase: SupabaseClient,
  userId: string,
  taskId: string,
) {
  const taskDetail = await getTaskDetail(supabase, userId, taskId);

  if (!taskDetail) {
    throw new RepositoryError("任务不存在或无权访问。", {
      status: 404,
    });
  }

  const files = taskDetail.files.map(mapTaskFile);
  const documentIngestionText = getDocumentIngestionText(taskDetail);
  const datasetSummary = summarizeDatasetFiles(files);
  const requirementText = [
    getRequirementText(taskDetail),
    datasetSummary ? `[datasets]\n${datasetSummary}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const context: BuiltTaskContext = {
    taskId: taskDetail.task.id,
    userId,
    title: taskDetail.task.title,
    status: taskDetail.task.status,
    currentStep: taskDetail.task.current_step,
    experimentName: taskDetail.task.experiment_name,
    courseName: taskDetail.task.course_name,
    requirementText,
    taskBookText: taskDetail.input?.task_book_text ?? "",
    documentIngestionText,
    notes: taskDetail.input?.student_notes ?? "",
    templateInstructions: taskDetail.input?.template_instructions ?? "",
    confirmationNotes: getConfirmationNotes(taskDetail),
    files,
    datasetSummary,
    parsedRequirement: selectParsedRequirement(taskDetail),
    outline: selectOutline(taskDetail),
    reportMarkdown: selectReportMarkdown(taskDetail),
    consistencyCheck: selectConsistency(taskDetail),
  };

  return {
    taskDetail,
    context,
  };
}
