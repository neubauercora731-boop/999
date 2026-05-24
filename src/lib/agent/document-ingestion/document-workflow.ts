import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getTaskFileById,
  saveDocumentIngestionResult,
} from "@/lib/tasks/repository";
import { truncateText } from "@/lib/utils";

import { analyzeDocumentStructure } from "./analyze-document";
import { detectDocumentFileType } from "./detect-file-type";
import { extractDocumentRawText } from "./extract-text";
import { fileRoleLabels, inferFileRole } from "./file-role";
import { normalizeDocumentText } from "./normalize-text";
import {
  DOCUMENT_INGESTION_PARSER_VERSION,
  DocumentIngestionError,
  MAX_DOCUMENT_FILE_SIZE_BYTES,
  type DocumentWorkflowInput,
  type DocumentWorkflowResult,
} from "./types";

export async function runDocumentIngestionWorkflow(
  supabase: SupabaseClient,
  input: DocumentWorkflowInput,
): Promise<DocumentWorkflowResult> {
  // This is the formal document parser. It may re-read a file that already has
  // upload-time parsed_text, then stores normalized text plus structured_task
  // under metadata.document_ingestion for analyze to prefer.
  const file = await getTaskFileById(
    supabase,
    input.userId,
    input.taskId,
    input.fileId,
  );

  if (!file) {
    throw new DocumentIngestionError(
      "FILE_NOT_FOUND",
      "找不到该文件，或你没有权限访问它。",
      404,
    );
  }

  if ((file.file_size ?? 0) > MAX_DOCUMENT_FILE_SIZE_BYTES) {
    throw new DocumentIngestionError(
      "EXTRACT_TEXT_FAILED",
      "文件过大，当前版本最多支持 10MB 的任务书解析。",
      413,
    );
  }

  const detected = detectDocumentFileType(file.original_filename, file.mime_type);
  const inferredRole = inferFileRole(file.original_filename, file.mime_type);
  const warnings = detected.warning ? [detected.warning] : [];
  if (inferredRole.role !== "task_book") {
    warnings.push(
      `该文件推荐角色为“${fileRoleLabels[inferredRole.role]}”，看起来不像实验任务书，请确认是否继续解析。`,
    );
  }

  if (!detected.supported) {
    throw new DocumentIngestionError(
      "UNSUPPORTED_FILE_TYPE",
      detected.fileType === "unknown"
        ? "当前文件类型暂不支持文本解析，请选择 docx/doc/txt/md 类型任务书。"
        : detected.warning ?? "当前文件类型暂不支持文本解析，请选择 docx/doc/txt/md 类型任务书。",
      415,
    );
  }

  const adminSupabase = createSupabaseAdminClient();
  const { data, error } = await adminSupabase.storage
    .from(file.storage_bucket)
    .download(file.storage_path);

  if (error || !data) {
    throw new DocumentIngestionError(
      "FILE_NOT_FOUND",
      "无法读取已上传的文件，请重新上传后再试。",
      404,
    );
  }

  const bytes = new Uint8Array(await data.arrayBuffer());
  const extracted = await extractDocumentRawText({
    fileName: file.original_filename,
    mimeType: file.mime_type,
    bytes,
    fileType: detected.fileType,
  });
  warnings.push(...extracted.warnings);

  const normalized = normalizeDocumentText(extracted.rawText);
  warnings.push(...normalized.warnings);

  if (!normalized.normalizedText) {
    throw new DocumentIngestionError(
      "EMPTY_DOCUMENT_TEXT",
      "文档为空，或当前版本无法识别正文内容。",
      422,
    );
  }

  const structuredTask = await analyzeDocumentStructure({
    taskId: input.taskId,
    fileName: file.original_filename,
    normalizedText: normalized.normalizedText,
  });
  if (Array.isArray(structuredTask.warnings)) {
    warnings.push(...structuredTask.warnings);
  }

  const extractedAt = new Date().toISOString();

  try {
    await saveDocumentIngestionResult(supabase, {
      taskId: input.taskId,
      userId: input.userId,
      fileId: input.fileId,
      rawText: extracted.rawText,
      normalizedText: normalized.normalizedText,
      structuredTask,
      parserVersion: DOCUMENT_INGESTION_PARSER_VERSION,
      extractedAt,
      fileType: detected.fileType,
      extractionMethod: extracted.method,
      warnings,
      fileRole: "task_book",
      roleConfidence: inferredRole.confidence,
      roleReason: inferredRole.reason,
      roleSource: inferredRole.role === "task_book" ? "filename_rule" : "user_selected",
      inferredFileRole: inferredRole.role,
    });
  } catch {
    throw new DocumentIngestionError(
      "SAVE_PARSE_RESULT_FAILED",
      "保存文档解析结果失败，请稍后重试。",
      500,
    );
  }

  return {
    success: true,
    fileId: input.fileId,
    fileType: detected.fileType,
    rawTextPreview: truncateText(extracted.rawText, 800),
    normalizedTextPreview: truncateText(normalized.normalizedText, 800),
    structuredTask,
    warnings,
    parserVersion: DOCUMENT_INGESTION_PARSER_VERSION,
    extractedAt,
  };
}
