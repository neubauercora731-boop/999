import { z } from "zod";

export const DOCUMENT_INGESTION_PARSER_VERSION = "document-ingestion-v1";
export const MAX_DOCUMENT_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_RAW_TEXT_LENGTH = 60_000;
export const MAX_NORMALIZED_TEXT_LENGTH = 40_000;

export const supportedDocumentFileTypes = [
  "docx",
  "doc",
  "txt",
  "md",
  "pdf",
  "image",
  "unknown",
] as const;

export type DocumentFileType = (typeof supportedDocumentFileTypes)[number];

export type DocumentIngestionErrorCode =
  | "FILE_NOT_FOUND"
  | "UNSUPPORTED_FILE_TYPE"
  | "EXTRACT_TEXT_FAILED"
  | "EMPTY_DOCUMENT_TEXT"
  | "AI_STRUCTURE_FAILED"
  | "SAVE_PARSE_RESULT_FAILED";

export class DocumentIngestionError extends Error {
  constructor(
    public readonly code: DocumentIngestionErrorCode,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "DocumentIngestionError";
  }
}

export interface DetectedDocumentFile {
  fileType: DocumentFileType;
  extension: string;
  mimeType: string | null;
  supported: boolean;
  warning?: string;
}

export interface ExtractTextInput {
  fileName: string;
  mimeType: string | null;
  bytes: Uint8Array;
  fileType: DocumentFileType;
}

export interface ExtractTextResult {
  rawText: string;
  method:
    | "docx_mammoth"
    | "docx_word_extractor"
    | "doc_word_extractor"
    | "plain_text";
  warnings: string[];
}

export interface NormalizedTextResult {
  normalizedText: string;
  warnings: string[];
}

function looseValueToString(value: unknown) {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["name", "title", "content", "description", "value", "text"]) {
      if (typeof record[key] === "string" && record[key].trim()) {
        return record[key];
      }
    }
    return JSON.stringify(value);
  }
  return String(value);
}

const flexibleStringArray = z
  .preprocess((value) => {
    if (value === undefined || value === null || value === "") return [];
    if (typeof value === "string") {
      return value
        .split(/\r?\n|[；;]+/)
        .map((item) => item.replace(/^\s*[-*\d.、)）]+/, "").trim())
        .filter(Boolean);
    }
    if (Array.isArray(value)) return value.map(looseValueToString);
    return [looseValueToString(value)];
  }, z.array(z.coerce.string().trim()).default([]))
  .transform((items) =>
    items
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => (item.length > 500 ? `${item.slice(0, 500)}...` : item)),
  );

function normalizeStructuredTaskAliases(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const normalized = { ...(value as Record<string, unknown>) };
  const aliases: Record<string, string[]> = {
    title: ["taskTitle", "task_title", "experimentTitle", "experiment_title", "实验标题"],
    courseName: ["course_name", "course", "课程名称"],
    taskType: ["task_type", "type", "任务类型"],
    language: ["programmingLanguage", "programming_language", "编程语言"],
    explicitRequirements: ["explicit_requirements", "requirements", "显性要求"],
    implicitRequirements: ["implicit_requirements", "隐性要求"],
    deliverables: ["outputs", "交付物"],
    reportSections: ["report_sections", "sections", "报告章节"],
    codeRequirements: ["code_requirements", "代码要求"],
    runRequirements: ["run_requirements", "运行要求"],
    formatRequirements: ["format_requirements", "格式要求"],
    missingInfo: ["missing_info", "missing", "缺失信息"],
    riskNotes: ["risk_notes", "risks", "风险提示"],
  };

  for (const [canonicalKey, alternativeKeys] of Object.entries(aliases)) {
    if (normalized[canonicalKey] !== undefined) continue;
    const matchedKey = alternativeKeys.find((key) => normalized[key] !== undefined);
    if (matchedKey) {
      normalized[canonicalKey] = normalized[matchedKey];
    }
  }

  return normalized;
}

export const structuredDocumentTaskSchema = z.preprocess(
  normalizeStructuredTaskAliases,
  z.object({
    title: z.coerce.string().trim().default(""),
    courseName: z.coerce.string().trim().default(""),
    taskType: z.coerce.string().trim().default("unknown"),
    language: z.coerce.string().trim().default(""),
    explicitRequirements: flexibleStringArray,
    implicitRequirements: flexibleStringArray,
    deliverables: flexibleStringArray,
    reportSections: flexibleStringArray,
    codeRequirements: flexibleStringArray,
    runRequirements: flexibleStringArray,
    formatRequirements: flexibleStringArray,
    missingInfo: flexibleStringArray,
    riskNotes: flexibleStringArray,
    structuredBy: z.enum(["moonshot", "fallback"]).default("moonshot"),
    source: z.enum(["moonshot", "fallback"]).default("moonshot"),
    parserVersion: z.coerce.string().trim().optional(),
    structuredAt: z.coerce.string().trim().optional(),
    warnings: flexibleStringArray,
  }),
);

export type StructuredDocumentTask = z.infer<typeof structuredDocumentTaskSchema>;

export interface DocumentWorkflowInput {
  taskId: string;
  userId: string;
  fileId: string;
}

export interface DocumentWorkflowResult {
  success: true;
  fileId: string;
  fileType: DocumentFileType;
  rawTextPreview: string;
  normalizedTextPreview: string;
  structuredTask: StructuredDocumentTask;
  warnings: string[];
  parserVersion: string;
  extractedAt: string;
}
