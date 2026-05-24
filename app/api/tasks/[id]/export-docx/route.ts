import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { NextResponse } from "next/server";

import { evaluateTaskOutput } from "@/lib/agent/quality-evaluation";
import { inferWorkflowType } from "@/lib/agent/workflow-types";
import {
  decodeHeaderValue,
  encodeRFC5987Value,
  makeDownloadHeaders,
} from "@/lib/http/download-headers";
import { exportReportToDocx, createDocxFileName } from "@/lib/reports/docx";
import { convertDocToDocx } from "@/lib/reports/doc-to-docx-converter";
import { inspectScreenshotRequirement } from "@/lib/reports/screenshot-requirements";
import {
  DOCX_EXPORT_MODES,
  patchOriginalDocxWithFill,
  TemplatePreservingDocxError,
  type DocxExportMode,
  type PatchScreenshotInput,
} from "@/lib/reports/template-preserving-docx";
import { validateDocxPreservation } from "@/lib/reports/docx-preservation-validator";
import {
  extractScreenshotsFromReportJson,
  isValidScreenshotEvidence,
  mergeScreenshotEvidence,
} from "@/lib/screenshots/evidence";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getLatestReportMarkdown } from "@/lib/tasks/context";
import type { TaskDetail, TaskFileRecord } from "@/lib/tasks/contracts";
import {
  createTaskOutput,
  createTaskRun,
  finishTaskRun,
  getTaskDetail,
  updateTaskExecutionStatuses,
} from "@/lib/tasks/repository";
import { TASK_CURRENT_STEP, TASK_RUN_TYPE, TASK_STATUS } from "@/lib/tasks/task-status";
import { toErrorMessage } from "@/lib/utils";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const runtime = "nodejs";

type ActualDocxExportMode =
  | typeof DOCX_EXPORT_MODES.PATCH_ORIGINAL_DOCX
  | typeof DOCX_EXPORT_MODES.GENERATED_REPORT_DOCX;

function parseExportMode(request: Request): DocxExportMode {
  const mode = new URL(request.url).searchParams.get("mode");

  if (mode === DOCX_EXPORT_MODES.PATCH_ORIGINAL_DOCX) {
    return DOCX_EXPORT_MODES.PATCH_ORIGINAL_DOCX;
  }

  if (mode === DOCX_EXPORT_MODES.GENERATED_REPORT_DOCX) {
    return DOCX_EXPORT_MODES.GENERATED_REPORT_DOCX;
  }

  if (mode === DOCX_EXPORT_MODES.AUTO) {
    return DOCX_EXPORT_MODES.AUTO;
  }

  return DOCX_EXPORT_MODES.PATCH_ORIGINAL_DOCX;
}

function getFileExtension(fileName: string) {
  const index = fileName.lastIndexOf(".");
  return index >= 0 ? fileName.slice(index + 1).toLowerCase() : "";
}

function getFileRole(file: TaskFileRecord) {
  return typeof file.metadata?.file_role === "string"
    ? file.metadata.file_role
    : typeof file.metadata?.inferred_file_role === "string"
      ? file.metadata.inferred_file_role
      : file.file_type;
}

function getPatchSourceScore(file: TaskFileRecord) {
  if (getFileExtension(file.original_filename) !== "docx") return -1;

  const role = getFileRole(file);
  let score = 0;

  if (role === "task_book") score += 100;
  if (file.file_type === "task_book") score += 80;
  if (role === "template" || role === "report_template") score += 50;
  if (file.file_type === "template") score += 40;
  if (file.metadata?.role_source === "user_selected") score += 10;

  return score;
}

function findPatchSourceFile(taskDetail: TaskDetail) {
  return [...taskDetail.files]
    .map((file) => ({ file, score: getPatchSourceScore(file) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.file;
}

function getOriginalTaskDocumentScore(file: TaskFileRecord) {
  const extension = getFileExtension(file.original_filename);
  if (!["docx", "doc", "txt", "md"].includes(extension)) return -1;

  const role = getFileRole(file);
  let score = 0;

  if (role === "task_book") score += 100;
  if (file.file_type === "task_book") score += 80;
  if (role === "report_template" || role === "template") score += 40;
  if (file.metadata?.role_source === "user_selected") score += 10;
  if (extension === "docx") score += 5;

  return score;
}

function findOriginalTaskDocumentFile(taskDetail: TaskDetail) {
  return [...taskDetail.files]
    .map((file) => ({ file, score: getOriginalTaskDocumentScore(file) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.file;
}

function getNoPatchableTemplateMessage(file: TaskFileRecord | undefined) {
  const extension = file ? getFileExtension(file.original_filename) : "";

  if (extension === "doc") {
    return {
      error: "当前 .doc 原格式保护导出需要先转换为标准 .docx。",
      message: "请上传标准 .docx 任务书或启用安全转换流程；系统不会把 .doc 重建成新 DOCX 后冒充原格式保护。",
    };
  }

  if (extension === "docx") {
    return {
      error: "当前 DOCX 无法作为可安全 patch 的标准模板。",
      message: "请上传可正常打开的标准 .docx 任务书；系统已阻止生成可能破坏原格式的文档。",
    };
  }

  return {
    error: "当前没有可保留原结构的标准 DOCX 模板。",
    message: "请上传 .docx 任务书模板后再进行原格式填充导出。",
  };
}

function getLatestOutputValue<T>(taskDetail: TaskDetail, key: string): T | null {
  for (const output of taskDetail.outputs) {
    const value = output.report_json?.[key];
    if (value !== undefined && value !== null) return value as T;
  }

  return null;
}

function collectStoredRealScreenshots(taskDetail: TaskDetail) {
  const screenshots: Array<{
    storagePath: string;
    fileName: string;
    contentType: "image/png";
    createdAt: string;
    relatedRunId?: string;
    type: "command_output_screenshot" | "browser_page_screenshot";
    source: string;
    description: string;
  }> = [];

  for (const output of taskDetail.outputs) {
    const value = output.report_json?.screenshots;
    if (!Array.isArray(value)) continue;

    for (const item of value) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      const storagePath =
        typeof record.storagePath === "string"
          ? record.storagePath
          : typeof record.path === "string"
            ? record.path
            : "";
      const contentType =
        record.contentType === "image/png" ? record.contentType : "image/png";
      const fileName =
        typeof record.fileName === "string" ? record.fileName : "运行截图.png";
      const createdAt =
        typeof record.createdAt === "string" ? record.createdAt : output.created_at;
      const type =
        record.type === "browser_page_screenshot"
          ? "browser_page_screenshot"
          : "command_output_screenshot";
      const source =
        typeof record.source === "string" ? record.source : "real_run_code_result";
      const relatedRunId =
        typeof record.relatedRunId === "string"
          ? record.relatedRunId
          : typeof record.runId === "string"
            ? record.runId
            : undefined;
      const description =
        typeof record.description === "string"
          ? record.description
          : type === "browser_page_screenshot"
            ? "真实网页效果截图，来源于浏览器渲染结果。"
            : "真实运行截图，来源于 run-code 结果。";

      if (
        storagePath &&
        record.isRealScreenshot === true &&
        record.isAiGenerated !== true &&
        record.missing !== true
      ) {
        screenshots.push({
          storagePath,
          fileName,
          contentType,
          createdAt,
          relatedRunId,
          type,
          source,
          description,
        });
      }
    }
  }

  const seenStoragePaths = new Set(screenshots.map((screenshot) => screenshot.storagePath));
  const canonicalScreenshots = mergeScreenshotEvidence(
    ...taskDetail.outputs.map((output) => extractScreenshotsFromReportJson(output.report_json)),
  );

  for (const screenshot of canonicalScreenshots) {
    if (
      !isValidScreenshotEvidence(screenshot) ||
      !screenshot.storagePath ||
      seenStoragePaths.has(screenshot.storagePath)
    ) {
      continue;
    }
    const fileName =
      screenshot.fileName ?? screenshot.storagePath.split("/").at(-1) ?? "screenshot.png";
    screenshots.push({
      storagePath: screenshot.storagePath,
      fileName,
      contentType: "image/png",
      createdAt: screenshot.createdAt ?? new Date().toISOString(),
      relatedRunId: screenshot.relatedRunId,
      type: screenshot.kind,
      source: screenshot.source,
      description:
        screenshot.kind === "browser_page_screenshot"
          ? "真实网页效果截图，来源于浏览器渲染结果。"
          : "真实运行截图，来源于 run-code 结果。",
    });
    seenStoragePaths.add(screenshot.storagePath);
  }

  const sortedScreenshots = [...screenshots].sort((a, b) => {
    const bTime = Date.parse(b.createdAt);
    const aTime = Date.parse(a.createdAt);
    return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
  });
  const latestRunId = sortedScreenshots.find((screenshot) => screenshot.relatedRunId)
    ?.relatedRunId;
  const latestRunScreenshots = latestRunId
    ? sortedScreenshots.filter((screenshot) => screenshot.relatedRunId === latestRunId)
    : sortedScreenshots;

  return latestRunScreenshots.slice(0, 3);
}

function createScreenshotSummary(input: {
  required: boolean;
  screenshots: ReturnType<typeof collectStoredRealScreenshots>;
  insertedCount?: number;
}) {
  return {
    required: input.required,
    usableCount: input.screenshots.length,
    missingCount: input.required && input.screenshots.length === 0 ? 1 : 0,
    insertedCount: input.insertedCount ?? 0,
    kinds: [...new Set(input.screenshots.map((screenshot) => screenshot.type))],
    sources: [...new Set(input.screenshots.map((screenshot) => screenshot.source))],
  };
}

function assertOwnedStoragePath(input: {
  userId: string;
  taskId: string;
  bucket?: string | null;
  storagePath?: string | null;
}) {
  const bucket = input.bucket || "task-files";
  const storagePath = input.storagePath || "";
  const prefix = `${input.userId}/${input.taskId}/`;

  if (bucket !== "task-files" || !storagePath.startsWith(prefix)) {
    throw new Error("Storage object path is outside the current task boundary.");
  }
}

async function downloadStoredScreenshots(
  screenshots: ReturnType<typeof collectStoredRealScreenshots>,
  userId: string,
  taskId: string,
) {
  const adminSupabase = createSupabaseAdminClient();
  const downloaded: PatchScreenshotInput[] = [];
  const warnings: string[] = [];

  for (const screenshot of screenshots) {
    try {
      assertOwnedStoragePath({
        userId,
        taskId,
        bucket: "task-files",
        storagePath: screenshot.storagePath,
      });
    } catch {
      warnings.push(`Ignored screenshot outside current task boundary: ${screenshot.fileName}`);
      continue;
    }

    const { data, error } = await adminSupabase.storage
      .from("task-files")
      .download(screenshot.storagePath);

    if (error || !data) {
      warnings.push(`读取运行截图失败：${screenshot.fileName}`);
      continue;
    }

    downloaded.push({
      imageBytes: new Uint8Array(await data.arrayBuffer()),
      contentType: "image/png",
      fileName: screenshot.fileName,
      description: "真实运行截图，来源于 run-code 结果。",
      createdAt: screenshot.createdAt,
      storagePath: screenshot.storagePath,
    });
    const latest = downloaded[downloaded.length - 1];
    latest.description = screenshot.description;
    latest.type = screenshot.type;
    latest.source = screenshot.source;
  }

  return { downloaded, warnings };
}

async function downloadTaskFileBytes(input: {
  file: TaskFileRecord;
  userId: string;
  taskId: string;
}) {
  assertOwnedStoragePath({
    userId: input.userId,
    taskId: input.taskId,
    bucket: input.file.storage_bucket,
    storagePath: input.file.storage_path,
  });

  const adminSupabase = createSupabaseAdminClient();
  const { data, error } = await adminSupabase.storage
    .from(input.file.storage_bucket || "task-files")
    .download(input.file.storage_path);

  if (error || !data) {
    throw new TemplatePreservingDocxError(
      "PATCH_SOURCE_DOWNLOAD_FAILED",
      "读取原始任务书失败，无法安全保持原格式。",
      500,
    );
  }

  return new Uint8Array(await data.arrayBuffer());
}

async function preparePatchSourceDocx(input: {
  taskDetail: TaskDetail;
  userId: string;
}) {
  const patchSourceFile = findPatchSourceFile(input.taskDetail);
  if (patchSourceFile) {
    return {
      sourceFile: patchSourceFile,
      originalDocx: await downloadTaskFileBytes({
        file: patchSourceFile,
        userId: input.userId,
        taskId: input.taskDetail.task.id,
      }),
      conversionWarnings: [] as string[],
      convertedFromDoc: false,
    };
  }

  const originalTaskDocumentFile = findOriginalTaskDocumentFile(input.taskDetail);
  if (!originalTaskDocumentFile || getFileExtension(originalTaskDocumentFile.original_filename) !== "doc") {
    throw new TemplatePreservingDocxError(
      "PATCH_SOURCE_DOCX_NOT_FOUND",
      "当前任务没有可安全填充的标准 DOCX 任务书或模板。请上传 .docx 任务书后再进行原格式填充。",
    );
  }

  const docBytes = await downloadTaskFileBytes({
    file: originalTaskDocumentFile,
    userId: input.userId,
    taskId: input.taskDetail.task.id,
  });
  const tempDir = await mkdtemp(path.join(tmpdir(), "lab-doc-to-docx-"));

  try {
    const inputDocPath = path.join(tempDir, originalTaskDocumentFile.original_filename);
    await writeFile(inputDocPath, docBytes);
    const conversion = await convertDocToDocx(inputDocPath, tempDir);
    return {
      sourceFile: originalTaskDocumentFile,
      originalDocx: new Uint8Array(await readFile(conversion.convertedDocxPath)),
      conversionWarnings: conversion.warnings,
      convertedFromDoc: true,
    };
  } catch (error) {
    throw new TemplatePreservingDocxError(
      "DOC_TO_DOCX_CONVERSION_FAILED",
      error instanceof Error
        ? error.message
        : "当前上传的是 .doc 老版 Word 格式，无法安全转换为标准 .docx baseline。",
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function createModeAwareFileName(
  taskTitle: string,
  experimentName: string | null | undefined,
  mode: ActualDocxExportMode,
) {
  const fileName = createDocxFileName(taskTitle, experimentName);

  if (mode === DOCX_EXPORT_MODES.PATCH_ORIGINAL_DOCX) {
    return fileName.replace(/\.docx$/i, "-原格式填充.docx");
  }

  return fileName.replace(/\.docx$/i, "-自动生成.docx");
}

function createStorageSafeFileName(fileName: string) {
  const extension = getFileExtension(fileName) || "docx";
  const baseName = fileName.replace(/\.[^.]+$/i, "");
  const safeBaseName = baseName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  return `${safeBaseName || "lab-report"}.${extension}`;
}

async function exportPatchOriginalDocx(input: {
  taskDetail: TaskDetail;
  reportMarkdown: string;
  userId: string;
}) {
  const preparedSource = await preparePatchSourceDocx({
    taskDetail: input.taskDetail,
    userId: input.userId,
  });
  const { sourceFile, originalDocx } = preparedSource;

  const screenshot = inspectScreenshotRequirement(input.taskDetail);
  const storedScreenshots = screenshot.screenshotRequired
    ? collectStoredRealScreenshots(input.taskDetail)
    : [];
  const downloadedScreenshots = await downloadStoredScreenshots(
    storedScreenshots,
    input.userId,
    input.taskDetail.task.id,
  );
  const screenshotNotes = [...screenshot.notes, ...downloadedScreenshots.warnings];
  screenshotNotes.push(...preparedSource.conversionWarnings);
  const screenshotMissing =
    screenshot.screenshotRequired && downloadedScreenshots.downloaded.length === 0;
  const result = await patchOriginalDocxWithFill({
    originalDocx,
    reportMarkdown: input.reportMarkdown,
    generatedCode: getLatestOutputValue<string>(input.taskDetail, "generated_code"),
    stdout: getLatestOutputValue<string>(input.taskDetail, "stdout"),
    stderr: getLatestOutputValue<string>(input.taskDetail, "stderr"),
    sourceFileName: sourceFile.original_filename,
    screenshotRequired: screenshot.screenshotRequired,
    screenshotMissing,
    screenshotNotes,
    screenshots: screenshot.screenshotRequired ? downloadedScreenshots.downloaded : [],
  });
  const preservationValidation = await validateDocxPreservation({
    originalDocx,
    exportedDocx: result.buffer,
    requireSystemFill: true,
  });

  if (!preservationValidation.passed) {
    throw new TemplatePreservingDocxError(
      "DOCX_PRESERVATION_VALIDATION_FAILED",
      "导出失败：系统检测到原任务书内容可能被修改或丢失，已阻止生成破坏格式的文档。",
    );
  }

  return {
    buffer: result.buffer,
    sourceFile,
    patchMetadata: {
      ...result.metadata,
      screenshotMatchedKeywords: screenshot.matchedKeywords,
      screenshotEvidenceFileNames: screenshot.evidenceFileNames,
      screenshotEvidenceStoragePaths: screenshot.evidenceStoragePaths,
      screenshotDownloadWarnings: downloadedScreenshots.warnings,
      convertedFromDoc: preparedSource.convertedFromDoc,
      docConversionWarnings: preparedSource.conversionWarnings,
      preservationValidation,
    },
  };
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const exportMode = parseExportMode(request);
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "请先登录后再导出报告。" }, { status: 401 });
    }

    const taskDetail = await getTaskDetail(supabase, user.id, id);

    if (!taskDetail) {
      return NextResponse.json({ error: "任务不存在。" }, { status: 404 });
    }

    const reportMarkdown = getLatestReportMarkdown(taskDetail);

    if (!reportMarkdown) {
      return NextResponse.json(
        { error: "请先生成正文后再导出 DOCX。" },
        { status: 400 },
      );
    }

    const taskText = [
      taskDetail.task.title,
      taskDetail.task.description,
      taskDetail.input?.task_book_text,
      taskDetail.input?.requirement_text,
      JSON.stringify(taskDetail.task.parsed_requirement_json ?? {}),
    ]
      .filter(Boolean)
      .join("\n");
    const workflowType = inferWorkflowType({
      taskText,
      fileRoles: taskDetail.files.map((file) =>
        String(file.metadata?.file_role ?? file.metadata?.inferred_file_role ?? file.file_type),
      ),
      parsedRequirements: taskDetail.task.parsed_requirement_json,
    }).workflowType;
    const patchSourceFile = findPatchSourceFile(taskDetail);
    const originalTaskDocumentFile = findOriginalTaskDocumentFile(taskDetail);
    const originalFileType = originalTaskDocumentFile
      ? getFileExtension(originalTaskDocumentFile.original_filename)
      : null;
    const canPatchViaDocConversion =
      Boolean(originalTaskDocumentFile) &&
      originalFileType === "doc" &&
      !patchSourceFile;
    const patchCandidateAvailable = Boolean(patchSourceFile) || canPatchViaDocConversion;

    if (
      !patchSourceFile &&
      (exportMode === DOCX_EXPORT_MODES.PATCH_ORIGINAL_DOCX ||
        (exportMode === DOCX_EXPORT_MODES.AUTO && originalTaskDocumentFile))
      && originalTaskDocumentFile &&
      !canPatchViaDocConversion
    ) {
      const message = getNoPatchableTemplateMessage(originalTaskDocumentFile);
      return NextResponse.json(
        {
          ok: false,
          code: "NO_PATCHABLE_DOCX_TEMPLATE",
          error: message.error,
          message: message.message,
          originalFileType,
          preserveOriginalDocument: true,
          rewriteWholeDocument: false,
          insertionMode: "append_under_task",
          originalDocumentPolicy: "immutable_except_explicit_fill_cells",
          fallbackAvailable: !originalTaskDocumentFile,
          fallbackMode: DOCX_EXPORT_MODES.GENERATED_REPORT_DOCX,
        },
        { status: 400 },
      );
    }

    const actualMode: ActualDocxExportMode =
      exportMode === DOCX_EXPORT_MODES.GENERATED_REPORT_DOCX
        ? DOCX_EXPORT_MODES.GENERATED_REPORT_DOCX
        : exportMode === DOCX_EXPORT_MODES.PATCH_ORIGINAL_DOCX
          ? patchCandidateAvailable
            ? DOCX_EXPORT_MODES.PATCH_ORIGINAL_DOCX
            : DOCX_EXPORT_MODES.GENERATED_REPORT_DOCX
          : patchCandidateAvailable
            ? DOCX_EXPORT_MODES.PATCH_ORIGINAL_DOCX
            : DOCX_EXPORT_MODES.GENERATED_REPORT_DOCX;
    const fallbackReason: string | null =
      actualMode === DOCX_EXPORT_MODES.GENERATED_REPORT_DOCX &&
      !originalTaskDocumentFile &&
      exportMode !== DOCX_EXPORT_MODES.GENERATED_REPORT_DOCX
        ? "当前没有原始任务书模板，已生成新版 DOCX。"
        : null;

    const screenshotInspection = inspectScreenshotRequirement(taskDetail);
    const storedRealScreenshots = collectStoredRealScreenshots(taskDetail);
    const screenshotSummary = createScreenshotSummary({
      required: screenshotInspection.screenshotRequired,
      screenshots: storedRealScreenshots,
      insertedCount: storedRealScreenshots.length,
    });
    const quality = evaluateTaskOutput({
      workflowType,
      taskText,
      parsedRequirements: taskDetail.task.parsed_requirement_json,
      generatedCode: getLatestOutputValue<string>(taskDetail, "generated_code"),
      runResult:
        getLatestOutputValue<Record<string, unknown>>(taskDetail, "final_run") ??
        getLatestOutputValue<Record<string, unknown>>(taskDetail, "run_result"),
      screenshots: storedRealScreenshots,
      reportText: reportMarkdown,
      exportMode: actualMode,
      phase: "pre_export",
      patchSourceDocxAvailable: patchCandidateAvailable,
      screenshotRequired: screenshotInspection.screenshotRequired,
      screenshotMissing: screenshotInspection.screenshotRequired && storedRealScreenshots.length === 0,
      missingScreenshotMarkerWillBeInserted:
        screenshotInspection.screenshotRequired && storedRealScreenshots.length === 0,
    });
    const hardBlocking = quality.blockingIssues;

    if (hardBlocking.length > 0) {
      return NextResponse.json(
        {
          error: "质量检查未通过，暂不能导出 DOCX。",
          code: "QUALITY_GATE_FAILED",
          quality,
        },
        { status: 400 },
      );
    }

    const exportResult:
      | Awaited<ReturnType<typeof exportPatchOriginalDocx>>
      | { buffer: Buffer; sourceFile: null; patchMetadata: null } =
      actualMode === DOCX_EXPORT_MODES.PATCH_ORIGINAL_DOCX
        ? await exportPatchOriginalDocx({ taskDetail, reportMarkdown, userId: user.id })
        : {
            buffer: await exportReportToDocx(reportMarkdown),
            sourceFile: null,
            patchMetadata: null,
          };
    const buffer = exportResult.buffer;
    const fileName = createModeAwareFileName(
      taskDetail.task.title,
      taskDetail.task.experiment_name,
      actualMode,
    );
    const storageFileName = createStorageSafeFileName(fileName);
    const objectPath = `${user.id}/${id}/outputs/${Date.now()}-${storageFileName}`;
    const adminSupabase = createSupabaseAdminClient();
    const { error: uploadError } = await adminSupabase.storage
      .from("task-files")
      .upload(objectPath, new Uint8Array(buffer), {
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: true,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const run = await createTaskRun(supabase, {
      taskId: id,
      userId: user.id,
      runType: TASK_RUN_TYPE.EXPORT_DOCX,
      modelName:
        actualMode === DOCX_EXPORT_MODES.PATCH_ORIGINAL_DOCX
          ? "docx-patch-export"
          : "docx-generated-export",
      inputContext: {
        file_name: fileName,
        storage_file_name: storageFileName,
        requested_export_mode: exportMode,
        actual_export_mode: actualMode,
        fallback_reason: fallbackReason,
        source_file_id: exportResult.sourceFile?.id ?? null,
        original_file_id: originalTaskDocumentFile?.id ?? null,
        original_file_type: originalFileType,
        preserve_original_document: actualMode === DOCX_EXPORT_MODES.PATCH_ORIGINAL_DOCX,
        rewrite_whole_document: actualMode !== DOCX_EXPORT_MODES.PATCH_ORIGINAL_DOCX,
        original_document_policy:
          actualMode === DOCX_EXPORT_MODES.PATCH_ORIGINAL_DOCX
            ? "immutable_except_explicit_fill_cells"
            : "not_preserved_generated_report",
        insertion_mode:
          actualMode === DOCX_EXPORT_MODES.PATCH_ORIGINAL_DOCX
            ? "append_under_task"
            : "generated_report_docx",
      },
    });

    await createTaskOutput(supabase, {
      taskRunId: run.id,
      taskId: id,
      userId: user.id,
      reportJson: {
        docx_url: objectPath,
        file_name: fileName,
        storage_file_name: storageFileName,
        export_mode: actualMode,
        requested_export_mode: exportMode,
        actual_export_mode: actualMode,
        fallback_reason: fallbackReason,
        preserve_original_docx: actualMode === DOCX_EXPORT_MODES.PATCH_ORIGINAL_DOCX,
        original_document_policy:
          actualMode === DOCX_EXPORT_MODES.PATCH_ORIGINAL_DOCX
            ? "immutable_except_explicit_fill_cells"
            : "not_preserved_generated_report",
        insertion_mode:
          actualMode === DOCX_EXPORT_MODES.PATCH_ORIGINAL_DOCX
            ? "append_under_task"
            : "rewrite_whole_document",
        rewrite_whole_document:
          actualMode === DOCX_EXPORT_MODES.GENERATED_REPORT_DOCX,
        source_file_id: exportResult.sourceFile?.id ?? null,
        source_file_name: exportResult.sourceFile?.original_filename ?? null,
        original_file_id: originalTaskDocumentFile?.id ?? null,
        original_file_name: originalTaskDocumentFile?.original_filename ?? null,
        original_file_type: originalFileType,
        patch_metadata: exportResult.patchMetadata,
        quality,
        screenshot_summary: screenshotSummary,
        preserveOriginalDocument: actualMode === DOCX_EXPORT_MODES.PATCH_ORIGINAL_DOCX,
        originalDocumentPolicy:
          actualMode === DOCX_EXPORT_MODES.PATCH_ORIGINAL_DOCX
            ? "immutable_except_explicit_fill_cells"
            : "not_preserved_generated_report",
        preserveOriginalDocumentWarning:
          actualMode === DOCX_EXPORT_MODES.PATCH_ORIGINAL_DOCX
            ? null
            : "generated_report_docx 会生成新版 DOCX，不代表保留老师原任务书格式。",
        screenshotRequired: screenshotSummary.required,
        screenshotInserted: screenshotSummary.insertedCount > 0,
        screenshotMissing: screenshotSummary.required && screenshotSummary.usableCount === 0,
        preservationValidationPassed:
          exportResult.patchMetadata?.preservationValidation?.passed ?? null,
        downloadFileName: fileName,
        fallbackFileName: storageFileName || "lab-report.docx",
        contentDispositionEncoded: true,
      },
      reportMarkdown,
    });
    await updateTaskExecutionStatuses(supabase, id, {
      status: TASK_STATUS.EXPORTED,
      currentStep: TASK_CURRENT_STEP.EXPORTED,
      lastError: null,
    });
    await finishTaskRun(supabase, run.id, { status: "success" });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        ...makeDownloadHeaders({
          filename: fileName,
          fallbackFilename: storageFileName || "lab-report.docx",
          contentType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }),
        "X-Export-Requested-Mode": exportMode,
        "X-Export-Actual-Mode": actualMode,
        "X-Export-Fallback-Reason": fallbackReason
          ? encodeRFC5987Value(fallbackReason)
          : "",
        "X-Screenshot-Required": String(screenshotSummary.required),
        "X-Screenshot-Usable-Count": String(screenshotSummary.usableCount),
        "X-Screenshot-Inserted-Count": String(screenshotSummary.insertedCount),
        "X-Screenshot-Kinds": screenshotSummary.kinds.join(","),
        "X-Screenshot-Sources": screenshotSummary.sources.join(","),
      },
    });
  } catch (error) {
    if (error instanceof TemplatePreservingDocxError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
          message: error.message,
          code: error.code,
          errorCode: error.code,
        },
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: toErrorMessage(error) || "DOCX 导出失败，请稍后重试。",
        message: toErrorMessage(error) || "DOCX 导出失败，请稍后重试。",
        code: "DOCX_EXPORT_FAILED",
      },
      { status: 500 },
    );
  }
}

function getDownloadFileName(response: Response) {
  const disposition = response.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename\*=UTF-8''([^;]+)/);
  if (match?.[1]) {
    return decodeURIComponent(match[1]);
  }
  return "lab-report.docx";
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const response = await GET(request, { params: Promise.resolve({ id }) });

  if (!response.ok) {
    return response;
  }

  const bytes = await response.arrayBuffer();
  const exportMode = parseExportMode(request);
  const actualMode =
    response.headers.get("X-Export-Actual-Mode") || exportMode;
  const fallbackReason =
    decodeHeaderValue(response.headers.get("X-Export-Fallback-Reason")) || null;
  const screenshotSummary = {
    required: response.headers.get("X-Screenshot-Required") === "true",
    usableCount: Number(response.headers.get("X-Screenshot-Usable-Count") || 0),
    missingCount:
      response.headers.get("X-Screenshot-Required") === "true" &&
      Number(response.headers.get("X-Screenshot-Usable-Count") || 0) === 0
        ? 1
        : 0,
    insertedCount: Number(response.headers.get("X-Screenshot-Inserted-Count") || 0),
    kinds: (response.headers.get("X-Screenshot-Kinds") || "")
      .split(",")
      .filter(Boolean),
    sources: (response.headers.get("X-Screenshot-Sources") || "")
      .split(",")
      .filter(Boolean),
  };

  return NextResponse.json({
    ok: true,
    success: true,
    mode: exportMode,
    actualMode,
    fileName: getDownloadFileName(response),
    bytes: bytes.byteLength,
    downloadUrl: `/api/tasks/${id}/export-docx?mode=${exportMode}`,
    fallbackReason,
    screenshotSummary,
  });
}
