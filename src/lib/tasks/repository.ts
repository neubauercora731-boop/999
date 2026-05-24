import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  NewTaskInput,
  TaskDetail,
  TaskExecutionStatus,
  TaskFileRecord,
  TaskFileType,
  TaskOutputRecord,
  TaskRecord,
  TaskRunRecord,
  TaskRunType,
  TaskStepRecord,
} from "@/lib/tasks/contracts";
import {
  TASK_CURRENT_STEP,
  TASK_EXECUTION_STATUS,
  TASK_RUN_STATUS,
  TASK_STATUS,
  TASK_STEP_STATUS,
} from "@/lib/tasks/task-status";

export interface SupabaseErrorLike {
  message: string;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
  status?: number | null;
  name?: string | null;
}

export class RepositoryError extends Error {
  code?: string | null;
  details?: string | null;
  hint?: string | null;
  status: number;
  compensationError?: string | null;

  constructor(
    message: string,
    options: {
      code?: string | null;
      details?: string | null;
      hint?: string | null;
      status?: number;
      compensationError?: string | null;
    } = {},
  ) {
    super(message);
    this.name = "RepositoryError";
    this.code = options.code ?? null;
    this.details = options.details ?? null;
    this.hint = options.hint ?? null;
    this.status = options.status ?? 500;
    this.compensationError = options.compensationError ?? null;
  }
}

function normalizeErrorStatus(error: SupabaseErrorLike) {
  const code = error.code ?? "";
  const message = error.message.toLowerCase();

  if (
    error.status === 401 ||
    code === "401" ||
    code === "PGRST301" ||
    message.includes("jwt") ||
    message.includes("unauthorized") ||
    message.includes("invalid authentication")
  ) {
    return 401;
  }

  if (
    error.status === 403 ||
    code === "403" ||
    code === "42501" ||
    message.includes("row-level security") ||
    message.includes("permission denied") ||
    message.includes("forbidden")
  ) {
    return 403;
  }

  if (error.status && error.status >= 400 && error.status < 500) {
    return error.status;
  }

  return 500;
}

function createRepositoryError(
  error: SupabaseErrorLike,
  fallbackMessage: string,
  options: { compensationError?: string | null } = {},
) {
  return new RepositoryError(error.message || fallbackMessage, {
    code: error.code ?? null,
    details: error.details ?? null,
    hint: error.hint ?? null,
    status: normalizeErrorStatus(error),
    compensationError: options.compensationError ?? null,
  });
}

function assertNoError(error: SupabaseErrorLike | null) {
  if (error) {
    throw createRepositoryError(error, error.message);
  }
}

type JsonPayload = Record<string, unknown>;

function getFallbackTaskTitle(input: NewTaskInput) {
  const explicitTitle = input.title?.trim();
  if (explicitTitle) {
    return explicitTitle;
  }

  const experimentName = input.experimentName?.trim();
  if (experimentName) {
    return experimentName;
  }

  const courseName = input.courseName?.trim();
  if (courseName) {
    return `${courseName} 实验报告任务`;
  }

  return "未命名实验报告任务";
}

function getInitialTaskDescription(input: NewTaskInput) {
  const requirementText = input.requirementText?.trim();
  if (requirementText) {
    return requirementText;
  }

  const notes = input.notes?.trim();
  if (notes) {
    return notes;
  }

  return "等待自动解析上传的任务书与材料。";
}

export async function createTask(
  supabase: SupabaseClient,
  userId: string,
  input: NewTaskInput,
) {
  const title = getFallbackTaskTitle(input);
  const requirementText = input.requirementText?.trim() || null;

  const taskInsert = {
    user_id: userId,
    title,
    experiment_name: input.experimentName || null,
    course_name: input.courseName || null,
    description: getInitialTaskDescription(input),
    status: TASK_STATUS.UPLOADED,
    current_step: TASK_CURRENT_STEP.UPLOADED,
    analysis_status: TASK_EXECUTION_STATUS.PENDING,
    generation_status: TASK_EXECUTION_STATUS.PENDING,
    consistency_status: TASK_EXECUTION_STATUS.PENDING,
    parsed_requirement_json: null,
    outline_json: null,
    report_markdown: null,
    last_error: null,
    analysis_summary: {},
    missing_fields: [],
  };

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .insert(taskInsert)
    .select()
    .single();

  assertNoError(taskError);

  const { error: inputsError } = await supabase.from("task_inputs").insert({
    task_id: task.id,
    user_id: userId,
    task_book_text: input.taskBookText || null,
    requirement_text: requirementText,
    student_notes: input.notes || null,
    template_instructions: input.templateInstructions || null,
    raw_payload: {
      title,
      experimentName: input.experimentName || null,
      courseName: input.courseName || null,
      analysisConfirmationNotes: "",
    },
  });

  if (inputsError) {
    const { error: cleanupError } = await supabase
      .from("tasks")
      .delete()
      .eq("id", task.id);

    throw createRepositoryError(inputsError, inputsError.message, {
      compensationError: cleanupError
        ? `Compensating delete failed: ${cleanupError.message}`
        : null,
    });
  }

  return task as TaskRecord;
}

export async function listTasks(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  assertNoError(error);
  return (data ?? []) as TaskRecord[];
}

export async function getTaskById(
  supabase: SupabaseClient,
  userId: string,
  taskId: string,
) {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .eq("user_id", userId)
    .maybeSingle();

  assertNoError(error);
  return (data as TaskRecord | null) ?? null;
}

export async function getTaskDetail(
  supabase: SupabaseClient,
  userId: string,
  taskId: string,
): Promise<TaskDetail | null> {
  const task = await getTaskById(supabase, userId, taskId);

  if (!task) {
    return null;
  }

  const [
    { data: input, error: inputError },
    { data: files, error: filesError },
    { data: runs, error: runsError },
    { data: steps, error: stepsError },
    { data: outputs, error: outputsError },
  ] = await Promise.all([
    supabase
      .from("task_inputs")
      .select("*")
      .eq("task_id", taskId)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("task_files")
      .select("*")
      .eq("task_id", taskId)
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    supabase
      .from("task_runs")
      .select("*")
      .eq("task_id", taskId)
      .eq("user_id", userId)
      .order("run_no", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("task_steps")
      .select("*")
      .eq("task_id", taskId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("task_outputs")
      .select("*")
      .eq("task_id", taskId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  assertNoError(inputError);
  assertNoError(filesError);
  assertNoError(runsError);
  assertNoError(stepsError);
  assertNoError(outputsError);

  return {
    task,
    input: input ?? null,
    files: (files ?? []) as TaskFileRecord[],
    runs: (runs ?? []) as TaskRunRecord[],
    steps: (steps ?? []) as TaskStepRecord[],
    outputs: (outputs ?? []) as TaskOutputRecord[],
  };
}

export async function deleteTask(
  supabase: SupabaseClient,
  userId: string,
  taskId: string,
) {
  const { data: files, error: filesError } = await supabase
    .from("task_files")
    .select("storage_bucket, storage_path")
    .eq("task_id", taskId)
    .eq("user_id", userId);

  assertNoError(filesError);

  const filesByBucket = new Map<string, string[]>();
  for (const file of files ?? []) {
    const bucket = (file.storage_bucket as string | null) ?? "";
    const storagePath = (file.storage_path as string | null) ?? "";

    if (!bucket || !storagePath) continue;
    filesByBucket.set(bucket, [...(filesByBucket.get(bucket) ?? []), storagePath]);
  }

  for (const [bucket, paths] of filesByBucket) {
    await supabase.storage.from(bucket).remove(paths);
  }

  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", taskId)
    .eq("user_id", userId);

  assertNoError(error);
}

export async function updateTask(
  supabase: SupabaseClient,
  taskId: string,
  patch: Partial<TaskRecord>,
) {
  const { data, error } = await supabase
    .from("tasks")
    .update(patch)
    .eq("id", taskId)
    .select()
    .single();

  assertNoError(error);
  return data as TaskRecord;
}

export async function getNextRunNumber(
  supabase: SupabaseClient,
  taskId: string,
) {
  const { data, error } = await supabase
    .from("task_runs")
    .select("run_no")
    .eq("task_id", taskId)
    .order("run_no", { ascending: false, nullsFirst: false })
    .limit(1);

  assertNoError(error);

  const lastRunNo = (data?.[0]?.run_no as number | null | undefined) ?? 0;
  return lastRunNo + 1;
}

export async function createTaskRun(
  supabase: SupabaseClient,
  params: {
    taskId: string;
    userId: string;
    runType: TaskRunType;
    modelName: string;
    inputContext?: JsonPayload;
  },
) {
  const runNo = await getNextRunNumber(supabase, params.taskId);
  const legacyRunTypeMap: Record<string, string> = {
    confirm_analysis: "analyze",
    generate_code: "generate_report",
    run_code: "generate_report",
    debug_code: "generate_report",
    save_report: "generate_report",
    export_docx: "generate_report",
  };
  const insertRun = async (runType: string) =>
    supabase
      .from("task_runs")
      .insert({
        task_id: params.taskId,
        user_id: params.userId,
        run_no: runNo,
        run_type: runType,
        status: TASK_RUN_STATUS.RUNNING,
        model_name: params.modelName,
        model: params.modelName,
        input_context: params.inputContext ?? {},
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

  let { data, error } = await insertRun(params.runType);

  if (
    error &&
    error.message.includes("task_runs_run_type_check") &&
    legacyRunTypeMap[params.runType]
  ) {
    ({ data, error } = await insertRun(legacyRunTypeMap[params.runType]));
  }

  assertNoError(error);
  return data as TaskRunRecord;
}

export async function finishTaskRun(
  supabase: SupabaseClient,
  runId: string,
  params: {
    status: "success" | "error" | "canceled";
    errorMessage?: string | null;
  },
) {
  const { data, error } = await supabase
    .from("task_runs")
    .update({
      status: params.status,
      error_message: params.errorMessage ?? null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", runId)
    .select()
    .single();

  assertNoError(error);
  return data as TaskRunRecord;
}

export async function startTaskStep(
  supabase: SupabaseClient,
  params: {
    taskId: string;
    userId: string;
    taskRunId: string;
    stepKey: string;
    stepOrder: number;
    inputPayload?: JsonPayload;
  },
) {
  const { data, error } = await supabase
    .from("task_steps")
    .insert({
      task_id: params.taskId,
      user_id: params.userId,
      task_run_id: params.taskRunId,
      step_key: params.stepKey,
      step_order: params.stepOrder,
      status: TASK_STEP_STATUS.RUNNING,
      input_payload: params.inputPayload ?? {},
      output_payload: {},
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  assertNoError(error);
  return data as TaskStepRecord;
}

export async function finishTaskStep(
  supabase: SupabaseClient,
  stepId: string,
  params: {
    status: "success" | "error" | "skipped";
    outputPayload?: JsonPayload;
    errorMessage?: string | null;
  },
) {
  const { data, error } = await supabase
    .from("task_steps")
    .update({
      status: params.status,
      output_payload: params.outputPayload ?? {},
      error_message: params.errorMessage ?? null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", stepId)
    .select()
    .single();

  assertNoError(error);
  return data as TaskStepRecord;
}

export async function createTaskOutput(
  supabase: SupabaseClient,
  params: {
    taskRunId: string;
    taskId: string;
    userId: string;
    parsedRequirementJson?: JsonPayload | null;
    missingFieldsJson?: unknown[] | null;
    outlineJson?: JsonPayload | null;
    reportJson?: JsonPayload | null;
    consistencyJson?: JsonPayload | null;
    outlineMarkdown?: string | null;
    reportMarkdown?: string | null;
  },
) {
  const { data, error } = await supabase
    .from("task_outputs")
    .insert({
      task_run_id: params.taskRunId,
      task_id: params.taskId,
      user_id: params.userId,
      parsed_requirement_json: params.parsedRequirementJson ?? {},
      missing_fields_json: params.missingFieldsJson ?? [],
      outline_json: params.outlineJson ?? {},
      report_json: params.reportJson ?? {},
      consistency_json: params.consistencyJson ?? {},
      outline_markdown: params.outlineMarkdown ?? null,
      report_markdown: params.reportMarkdown ?? null,
    })
    .select()
    .single();

  assertNoError(error);
  return data as TaskOutputRecord;
}

export async function createBillingLog(
  supabase: SupabaseClient,
  params: {
    userId: string;
    taskId: string;
    taskRunId: string | null;
    eventType: string;
    amountCents?: number;
    metadata?: JsonPayload;
  },
) {
  const { error } = await supabase.from("billing_logs").insert({
    user_id: params.userId,
    task_id: params.taskId,
    task_run_id: params.taskRunId,
    provider: "moonshot",
    event_type: params.eventType,
    amount_cents: params.amountCents ?? 0,
    status: "recorded",
    metadata: params.metadata ?? {},
  });

  assertNoError(error);
}

export async function createTaskFile(
  supabase: SupabaseClient,
  params: {
    taskId: string;
    userId: string;
    fileType: TaskFileType;
    storageBucket: string;
    storagePath: string;
    originalFilename: string;
    mimeType: string | null;
    fileSize: number | null;
    checksum?: string | null;
    metadata?: JsonPayload;
  },
) {
  const { data, error } = await supabase
    .from("task_files")
    .insert({
      task_id: params.taskId,
      user_id: params.userId,
      file_type: params.fileType,
      storage_bucket: params.storageBucket,
      storage_path: params.storagePath,
      original_filename: params.originalFilename,
      mime_type: params.mimeType,
      file_size: params.fileSize,
      checksum: params.checksum ?? null,
      metadata: params.metadata ?? {},
    })
    .select()
    .single();

  assertNoError(error);
  return data as TaskFileRecord;
}

export async function getTaskFileById(
  supabase: SupabaseClient,
  userId: string,
  taskId: string,
  fileId: string,
) {
  const { data, error } = await supabase
    .from("task_files")
    .select("*")
    .eq("id", fileId)
    .eq("task_id", taskId)
    .eq("user_id", userId)
    .maybeSingle();

  assertNoError(error);
  return (data as TaskFileRecord | null) ?? null;
}

export async function saveDocumentIngestionResult(
  supabase: SupabaseClient,
  params: {
    taskId: string;
    userId: string;
    fileId: string;
    rawText: string;
    normalizedText: string;
    structuredTask: unknown;
    parserVersion: string;
    extractedAt: string;
    fileType: string;
    extractionMethod: string;
    warnings: string[];
    fileRole?: string;
    roleConfidence?: number;
    roleReason?: string;
    roleSource?: string;
    inferredFileRole?: string;
  },
) {
  const { data: file, error: fileReadError } = await supabase
    .from("task_files")
    .select("metadata")
    .eq("id", params.fileId)
    .eq("task_id", params.taskId)
    .eq("user_id", params.userId)
    .maybeSingle();

  assertNoError(fileReadError);

  if (!file) {
    throw new RepositoryError("找不到该文件，或你没有权限访问它。", {
      status: 404,
    });
  }

  const existingMetadata =
    file.metadata && typeof file.metadata === "object"
      ? (file.metadata as JsonPayload)
      : {};

  const documentIngestion = {
    file_type: params.fileType,
    raw_text: params.rawText,
    normalized_text: params.normalizedText,
    structured_task: params.structuredTask,
    parser_version: params.parserVersion,
    extracted_at: params.extractedAt,
    extraction_method: params.extractionMethod,
    warnings: params.warnings,
  };

  const { error: fileUpdateError } = await supabase
    .from("task_files")
    .update({
      metadata: {
        ...existingMetadata,
        file_role: params.fileRole,
        role_confidence: params.roleConfidence,
        role_reason: params.roleReason,
        role_source: params.roleSource,
        inferred_file_role: params.inferredFileRole,
        text_excerpt: params.normalizedText,
        parsed_text: params.normalizedText,
        document_ingestion: documentIngestion,
      },
    })
    .eq("id", params.fileId)
    .eq("task_id", params.taskId)
    .eq("user_id", params.userId);

  assertNoError(fileUpdateError);

  const { data: input, error: inputReadError } = await supabase
    .from("task_inputs")
    .select("task_book_text, raw_payload")
    .eq("task_id", params.taskId)
    .eq("user_id", params.userId)
    .maybeSingle();

  assertNoError(inputReadError);

  const rawPayload =
    input && typeof input.raw_payload === "object" && input.raw_payload
      ? (input.raw_payload as JsonPayload)
      : {};
  const currentTaskBookText =
    typeof input?.task_book_text === "string" ? input.task_book_text : "";
  const taskBookText = currentTaskBookText
    ? `${currentTaskBookText}\n\n[文档解析结果]\n${params.normalizedText}`
    : params.normalizedText;

  const { error: inputUpdateError } = await supabase
    .from("task_inputs")
    .update({
      task_book_text: taskBookText,
      raw_payload: {
        ...rawPayload,
        documentIngestion: {
          ...(typeof rawPayload.documentIngestion === "object" &&
          rawPayload.documentIngestion
            ? (rawPayload.documentIngestion as JsonPayload)
            : {}),
          [params.fileId]: documentIngestion,
        },
      },
    })
    .eq("task_id", params.taskId)
    .eq("user_id", params.userId);

  assertNoError(inputUpdateError);
}

export async function appendTaskInputText(
  supabase: SupabaseClient,
  params: {
    taskId: string;
    userId: string;
    column: "task_book_text" | "template_instructions";
    content: string;
  },
) {
  const { data: existing, error: readError } = await supabase
    .from("task_inputs")
    .select(params.column)
    .eq("task_id", params.taskId)
    .eq("user_id", params.userId)
    .maybeSingle();

  assertNoError(readError);

  const existingRow = (existing ?? {}) as {
    task_book_text?: string | null;
    template_instructions?: string | null;
  };

  const currentValue =
    params.column === "task_book_text"
      ? (existingRow.task_book_text ?? null)
      : (existingRow.template_instructions ?? null);

  const mergedContent = currentValue
    ? `${currentValue}\n\n[上传文件文本摘录]\n${params.content}`
    : params.content;

  const { error } = await supabase
    .from("task_inputs")
    .update({
      [params.column]: mergedContent,
    })
    .eq("task_id", params.taskId)
    .eq("user_id", params.userId);

  assertNoError(error);
}

export async function saveTaskConfirmationNotes(
  supabase: SupabaseClient,
  params: {
    taskId: string;
    userId: string;
    confirmationNotes: string;
  },
) {
  const { data: existing, error: readError } = await supabase
    .from("task_inputs")
    .select("raw_payload")
    .eq("task_id", params.taskId)
    .eq("user_id", params.userId)
    .maybeSingle();

  assertNoError(readError);

  const rawPayload =
    existing && typeof existing.raw_payload === "object" && existing.raw_payload
      ? (existing.raw_payload as JsonPayload)
      : {};

  const { error } = await supabase
    .from("task_inputs")
    .update({
      raw_payload: {
        ...rawPayload,
        analysisConfirmationNotes: params.confirmationNotes.trim(),
      },
    })
    .eq("task_id", params.taskId)
    .eq("user_id", params.userId);

  assertNoError(error);
}

export async function updateTaskExecutionStatuses(
  supabase: SupabaseClient,
  taskId: string,
  params: {
    status?: TaskRecord["status"];
    currentStep?: string | null;
    analysisStatus?: TaskExecutionStatus;
    generationStatus?: TaskExecutionStatus;
    consistencyStatus?: TaskExecutionStatus;
    lastError?: string | null;
    confirmedAt?: string | null;
    parsedRequirementJson?: TaskRecord["parsed_requirement_json"];
    outlineJson?: TaskRecord["outline_json"];
    reportMarkdown?: string | null;
    description?: string | null;
    experimentName?: string | null;
    courseName?: string | null;
    analysisSummary?: TaskRecord["analysis_summary"];
    missingFields?: TaskRecord["missing_fields"];
  },
) {
  const patch: Record<string, unknown> = {};

  if (params.status !== undefined) patch.status = params.status;
  if (params.currentStep !== undefined) patch.current_step = params.currentStep;
  if (params.analysisStatus !== undefined) {
    patch.analysis_status = params.analysisStatus;
  }
  if (params.generationStatus !== undefined) {
    patch.generation_status = params.generationStatus;
  }
  if (params.consistencyStatus !== undefined) {
    patch.consistency_status = params.consistencyStatus;
  }
  if (params.lastError !== undefined) patch.last_error = params.lastError;
  if (params.confirmedAt !== undefined) patch.confirmed_at = params.confirmedAt;
  if (params.parsedRequirementJson !== undefined) {
    patch.parsed_requirement_json = params.parsedRequirementJson;
  }
  if (params.outlineJson !== undefined) patch.outline_json = params.outlineJson;
  if (params.reportMarkdown !== undefined) {
    patch.report_markdown = params.reportMarkdown;
  }
  if (params.description !== undefined) patch.description = params.description;
  if (params.experimentName !== undefined) {
    patch.experiment_name = params.experimentName;
  }
  if (params.courseName !== undefined) patch.course_name = params.courseName;
  if (params.analysisSummary !== undefined) {
    patch.analysis_summary = params.analysisSummary;
  }
  if (params.missingFields !== undefined) patch.missing_fields = params.missingFields;

  try {
    return await updateTask(supabase, taskId, patch as Partial<TaskRecord>);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = patch.status;
    const legacyStatusMap: Record<string, string> = {
      analyzed: "waiting_confirm",
      confirmed: "generating_outline",
      generated: "completed",
      exported: "completed",
    };

    if (
      typeof status === "string" &&
      legacyStatusMap[status] &&
      message.includes("tasks_status_check")
    ) {
      return updateTask(supabase, taskId, {
        ...patch,
        status: legacyStatusMap[status],
      } as Partial<TaskRecord>);
    }

    throw error;
  }
}
