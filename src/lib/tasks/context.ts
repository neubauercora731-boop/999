import type {
  ConsistencyCheckResult,
  ParsedRequirement,
} from "@/lib/ai/types";
import { outlineSchema } from "@/lib/ai/types";
import type { TaskDetail } from "@/lib/tasks/contracts";
import { truncateText } from "@/lib/utils";

function hasKeys(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") {
    return false;
  }

  return Object.keys(value).length > 0;
}

export function summarizeTaskFiles(taskDetail: TaskDetail) {
  if (taskDetail.files.length === 0) {
    return "无";
  }

  return taskDetail.files
    .map((file) => {
      const excerpt =
        typeof file.metadata?.text_excerpt === "string"
          ? `\n文本摘录:\n${truncateText(file.metadata.text_excerpt, 1000)}`
          : "";

      return [
        `- 类型: ${file.file_type}`,
        `  文件名: ${file.original_filename}`,
        `  MIME: ${file.mime_type ?? "unknown"}`,
        `  路径: ${file.storage_path}`,
        excerpt,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");
}

export function getLatestParsedRequirement(taskDetail: TaskDetail) {
  if (taskDetail.task.parsed_requirement_json) {
    return taskDetail.task.parsed_requirement_json as ParsedRequirement;
  }

  const output = taskDetail.outputs.find((item) =>
    hasKeys(item.parsed_requirement_json),
  );

  if (output?.parsed_requirement_json) {
    return output.parsed_requirement_json as ParsedRequirement;
  }

  if (hasKeys(taskDetail.task.analysis_summary)) {
    return taskDetail.task.analysis_summary as ParsedRequirement;
  }

  return null;
}

export function getLatestOutline(taskDetail: TaskDetail) {
  if (taskDetail.task.outline_json) {
    const parsed = outlineSchema.safeParse(taskDetail.task.outline_json);
    if (parsed.success) {
      return parsed.data;
    }
  }

  const output = taskDetail.outputs.find((item) => hasKeys(item.outline_json));
  if (output?.outline_json) {
    const parsed = outlineSchema.safeParse(output.outline_json);
    if (parsed.success) {
      return parsed.data;
    }
  }

  return null;
}

export function getLatestReportMarkdown(taskDetail: TaskDetail) {
  if (taskDetail.task.report_markdown) {
    return taskDetail.task.report_markdown;
  }

  const output = taskDetail.outputs.find((item) => Boolean(item.report_markdown));
  return output?.report_markdown ?? null;
}

export function getLatestConsistency(taskDetail: TaskDetail) {
  const output = taskDetail.outputs.find((item) => hasKeys(item.consistency_json));
  return (output?.consistency_json as ConsistencyCheckResult | null) ?? null;
}
