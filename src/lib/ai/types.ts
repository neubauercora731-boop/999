import { z } from "zod";

import {
  parsedRequirementSchema,
  type ParsedRequirement,
} from "@/lib/validators/parsed-requirement";

export interface TaskContextFile {
  id: string;
  fileType: string;
  fileName: string;
  mimeType: string | null;
  storagePath: string;
  excerpt: string | null;
  role: string;
  datasetPreview?: {
    kind?: string;
    columns?: string[];
    rowCount?: number | null;
    previewRows?: string[][];
    rawTextPreview?: string;
    delimiter?: string;
    truncated?: boolean;
  } | null;
}

export interface BuiltTaskContext {
  taskId: string;
  userId: string;
  title: string;
  status: string;
  currentStep: string | null;
  experimentName: string | null;
  courseName: string | null;
  requirementText: string;
  taskBookText: string;
  documentIngestionText: string;
  notes: string;
  templateInstructions: string;
  confirmationNotes: string;
  files: TaskContextFile[];
  datasetSummary: string;
  parsedRequirement: ParsedRequirement | null;
  outline: OutlineDocument | null;
  reportMarkdown: string | null;
  consistencyCheck: ConsistencyCheckResult | null;
}

export const outlineSectionSchema = z.object({
  title: z.string().trim().min(1),
  goal: z.string().trim().min(1),
  contentSummary: z.string().trim().min(1),
  dependentMaterials: z.array(z.string().trim().min(1)).default([]),
});

const canonicalOutlineSchema = z.object({
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  sections: z.array(outlineSectionSchema).min(1),
});

const generatedOutlineSchema = z.object({
  documentType: z.string().trim().optional(),
  metadata: z
    .object({
      courseName: z.string().trim().optional(),
      experimentName: z.string().trim().optional(),
      note: z.string().trim().optional(),
      language: z.string().trim().optional(),
      riskFlags: z.array(z.string().trim()).optional(),
      missingMaterials: z.array(z.string().trim()).optional(),
    })
    .catchall(z.unknown())
    .default({}),
  sections: z.array(outlineSectionSchema).min(1),
});

type CanonicalOutline = z.infer<typeof canonicalOutlineSchema>;
type GeneratedOutline = z.infer<typeof generatedOutlineSchema>;

function normalizeOutlineDocument(
  value: CanonicalOutline | GeneratedOutline,
): CanonicalOutline {
  if ("title" in value && "summary" in value) {
    return value;
  }

  const experimentName = value.metadata.experimentName?.trim() ?? "";
  const courseName = value.metadata.courseName?.trim() ?? "";
  const note = value.metadata.note?.trim() ?? "";

  const titleBase = [courseName, experimentName].filter(Boolean).join(" - ");
  const title = titleBase ? `${titleBase} 报告大纲` : "实验报告大纲";
  const summary =
    note ||
    (experimentName
      ? `围绕 ${experimentName} 生成的实验报告大纲。`
      : "基于当前实验要求生成的实验报告大纲。");

  return {
    title,
    summary,
    sections: value.sections,
  };
}

export const outlineSchema = z
  .union([canonicalOutlineSchema, generatedOutlineSchema])
  .transform(normalizeOutlineDocument);

export const consistencyCheckSchema = z.object({
  status: z.enum(["passed", "needs_revision"]),
  summary: z.string().trim().min(1),
  missingSections: z.array(z.string().trim().min(1)).default([]),
  conflicts: z.array(z.string().trim().min(1)).default([]),
  omittedFields: z.array(z.string().trim().min(1)).default([]),
  suggestions: z.array(z.string().trim().min(1)).default([]),
});

export type OutlineDocument = z.infer<typeof outlineSchema>;
export type ConsistencyCheckResult = z.infer<typeof consistencyCheckSchema>;

export interface MoonshotCallMetadata {
  taskId?: string;
  stepName?: string;
  modelName?: string;
}

export interface MoonshotBaseCallOptions {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  metadata?: MoonshotCallMetadata;
  tools?: unknown[];
  toolChoice?: "none" | "auto" | "required" | Record<string, unknown>;
}

export interface MoonshotTextResult {
  content: string;
  usage: {
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
  };
  raw: unknown;
}

export interface MoonshotJsonResult<T> extends MoonshotTextResult {
  parsed: T;
}

export {
  parsedRequirementSchema,
  type ParsedRequirement,
};
