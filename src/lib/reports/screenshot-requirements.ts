import type { TaskDetail } from "@/lib/tasks/contracts";

export const SCREENSHOT_REQUIREMENT_KEYWORDS = [
  "截图",
  "运行截图",
  "实验截图",
  "结果截图",
  "界面截图",
  "运行界面",
  "运行结果图",
  "附图",
  "请附图",
  "附运行结果图",
  "请截图",
  "请附截图",
  "screenshot",
  "screen shot",
] as const;

const SCREENSHOT_NEGATION_PATTERNS = [
  /无截图要求/,
  /无需截图/,
  /不用截图/,
  /不需要截图/,
  /不要求截图/,
  /不必截图/,
  /无需运行截图/,
  /不需要运行截图/,
  /不要求运行截图/,
  /no\s+screenshot/i,
  /screenshot\s+not\s+required/i,
  /without\s+screenshot/i,
] as const;

export interface ScreenshotRequirementInspection {
  screenshotRequired: boolean;
  screenshotMissing: boolean;
  matchedKeywords: string[];
  evidenceFileNames: string[];
  evidenceStoragePaths: string[];
  notes: string[];
}

function textIncludesKeyword(text: string, keyword: string) {
  return text.toLowerCase().includes(keyword.toLowerCase());
}

function hasNegatedScreenshotRequirement(text: string) {
  return SCREENSHOT_NEGATION_PATTERNS.some((pattern) => pattern.test(text));
}

function collectTextFromValue(value: unknown, output: string[], depth = 0) {
  if (depth > 4 || value == null) return;

  if (typeof value === "string") {
    output.push(value);
    return;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    output.push(String(value));
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectTextFromValue(item, output, depth + 1));
    return;
  }

  if (typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) =>
      collectTextFromValue(item, output, depth + 1),
    );
  }
}

function collectSourceTexts(taskDetail: TaskDetail) {
  const texts: string[] = [
    taskDetail.task.title,
    taskDetail.task.experiment_name ?? "",
    taskDetail.task.description ?? "",
    taskDetail.input?.task_book_text ?? "",
    taskDetail.input?.requirement_text ?? "",
    taskDetail.input?.template_instructions ?? "",
    taskDetail.input?.student_notes ?? "",
  ];

  if (taskDetail.task.parsed_requirement_json) {
    collectTextFromValue(taskDetail.task.parsed_requirement_json, texts);
  }

  for (const file of taskDetail.files) {
    texts.push(file.original_filename);
    const metadata = file.metadata ?? {};
    collectTextFromValue(metadata.document_ingestion, texts);
    collectTextFromValue(metadata.text_excerpt, texts);
  }

  return texts.filter(Boolean);
}

function getUploadedScreenshotEvidence(taskDetail: TaskDetail) {
  return taskDetail.files.filter((file) => {
    const metadata = file.metadata ?? {};
    return (
      file.file_type === "screenshot" ||
      metadata.file_role === "screenshot" ||
      metadata.inferred_file_role === "screenshot"
    );
  });
}

function getGeneratedScreenshotEvidence(taskDetail: TaskDetail) {
  const evidence: Array<{
    fileName: string;
    storagePath: string;
  }> = [];

  for (const output of taskDetail.outputs) {
    const screenshots = output.report_json?.screenshots;
    if (!Array.isArray(screenshots)) continue;

    for (const screenshot of screenshots) {
      if (!screenshot || typeof screenshot !== "object") continue;
      const record = screenshot as Record<string, unknown>;
      const storagePath =
        typeof record.storagePath === "string"
          ? record.storagePath
          : typeof record.path === "string"
            ? record.path
            : "";
      const fileName =
        typeof record.fileName === "string" ? record.fileName : "运行截图.png";
      const isRealScreenshot = record.isRealScreenshot === true;
      const isAiGenerated = record.isAiGenerated === true;
      const missing = record.missing === true;

      if (storagePath && isRealScreenshot && !isAiGenerated && !missing) {
        evidence.push({ fileName, storagePath });
      }
    }
  }

  return evidence;
}

function hasExplicitScreenshotFlag(taskDetail: TaskDetail) {
  const requirement = taskDetail.task.parsed_requirement_json;
  const codingTasks =
    requirement &&
    typeof requirement === "object" &&
    Array.isArray(requirement.coding_tasks)
      ? requirement.coding_tasks
      : [];

  if (
    codingTasks.some(
      (task) =>
        task &&
        typeof task === "object" &&
        (task as Record<string, unknown>).needs_screenshot === true,
    )
  ) {
    return true;
  }

  for (const output of taskDetail.outputs) {
    if (
      output.report_json?.screenshotRequired === true ||
      output.report_json?.screenshot_required === true
    ) {
      return true;
    }
  }

  return false;
}

export function inspectScreenshotRequirement(
  taskDetail: TaskDetail,
): ScreenshotRequirementInspection {
  const sourceText = collectSourceTexts(taskDetail).join("\n");
  const matchedKeywords = SCREENSHOT_REQUIREMENT_KEYWORDS.filter((keyword) =>
    textIncludesKeyword(sourceText, keyword),
  );
  const uploadedEvidenceFiles = getUploadedScreenshotEvidence(taskDetail);
  const generatedEvidence = getGeneratedScreenshotEvidence(taskDetail);
  const explicitScreenshotFlag = hasExplicitScreenshotFlag(taskDetail);
  const negatedScreenshotRequirement = hasNegatedScreenshotRequirement(sourceText);
  const screenshotRequired =
    explicitScreenshotFlag || (matchedKeywords.length > 0 && !negatedScreenshotRequirement);
  const screenshotMissing =
    screenshotRequired &&
    uploadedEvidenceFiles.length === 0 &&
    generatedEvidence.length === 0;
  const notes: string[] = [];

  if (screenshotRequired) {
    notes.push("任务材料中识别到截图要求，交付前必须检查真实截图证据。");
  } else if (matchedKeywords.length > 0 && negatedScreenshotRequirement) {
    notes.push("任务材料中出现截图相关词，但同时识别到不要求截图的表述，本次不强制生成截图。");
  }

  if (screenshotMissing) {
    notes.push("当前任务没有检测到已上传或已生成的真实截图，不能伪造截图。");
  }

  return {
    screenshotRequired,
    screenshotMissing,
    matchedKeywords,
    evidenceFileNames: [
      ...uploadedEvidenceFiles.map((file) => file.original_filename),
      ...generatedEvidence.map((file) => file.fileName),
    ],
    evidenceStoragePaths: [
      ...uploadedEvidenceFiles.map((file) => file.storage_path),
      ...generatedEvidence.map((file) => file.storagePath),
    ],
    notes,
  };
}
