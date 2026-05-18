import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  BuiltTaskContext,
  ConsistencyCheckResult,
  OutlineDocument,
  ParsedRequirement,
  TaskContextFile,
} from "@/lib/ai/types";
import { outlineSchema } from "@/lib/ai/types";
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

  const excerpt = file.metadata?.text_excerpt;
  return typeof excerpt === "string" ? excerpt : null;
}

function mapTaskFile(file: TaskFileRecord): TaskContextFile {
  return {
    id: file.id,
    fileType: file.file_type,
    fileName: file.original_filename,
    mimeType: file.mime_type,
    storagePath: file.storage_path,
    excerpt: getFileExcerpt(file),
  };
}

function getConfirmationNotes(taskDetail: TaskDetail) {
  const rawPayload = taskDetail.input?.raw_payload;
  const note = rawPayload?.analysisConfirmationNotes;

  return typeof note === "string" ? note : "";
}

function getRequirementText(taskDetail: TaskDetail) {
  const requirementText = taskDetail.input?.requirement_text?.trim();
  if (requirementText) {
    return requirementText;
  }

  const taskBookText = taskDetail.input?.task_book_text?.trim();
  if (taskBookText) {
    return taskBookText;
  }

  return "";
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

  const context: BuiltTaskContext = {
    taskId: taskDetail.task.id,
    userId,
    title: taskDetail.task.title,
    status: taskDetail.task.status,
    currentStep: taskDetail.task.current_step,
    experimentName: taskDetail.task.experiment_name,
    courseName: taskDetail.task.course_name,
    requirementText: getRequirementText(taskDetail),
    taskBookText: taskDetail.input?.task_book_text ?? "",
    notes: taskDetail.input?.student_notes ?? "",
    templateInstructions: taskDetail.input?.template_instructions ?? "",
    confirmationNotes: getConfirmationNotes(taskDetail),
    files,
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
