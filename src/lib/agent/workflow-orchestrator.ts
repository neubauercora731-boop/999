import type { SupabaseClient } from "@supabase/supabase-js";

import type { ParsedRequirement } from "@/lib/ai/types";
import {
  completeTraceStep,
  createTraceStep,
  failTraceStep,
  type AgentTraceArtifact,
  type AgentTraceStep,
  type AgentTraceStepName,
} from "@/lib/agent/agent-trace";
import {
  createQualityEvaluation,
  evaluateTaskOutput,
  type QualityEvaluationResult,
} from "@/lib/agent/quality-evaluation";
import {
  inferWorkflowType,
  type LabWorkflowType,
} from "@/lib/agent/workflow-types";
import {
  createMissingScreenshotEvidence,
  extractScreenshotsFromReportJson,
  isValidScreenshotEvidence,
  mergeScreenshotEvidence,
  type ScreenshotEvidenceKind,
} from "@/lib/screenshots/evidence";
import { buildTaskContext } from "@/lib/tasks/context-builder";
import type { TaskDetail } from "@/lib/tasks/contracts";
import {
  createTaskOutput,
  createTaskRun,
  finishTaskRun,
} from "@/lib/tasks/repository";
import {
  analyzeTask,
  confirmTaskAnalysis,
  debugTaskPythonCode,
  generatePythonCode,
  generateReportDraft,
  runTaskPythonCode,
} from "@/lib/tasks/task-runner";
import { TASK_RUN_TYPE } from "@/lib/tasks/task-status";
import { toUserFriendlyErrorMessage } from "@/lib/utils";

export type RunAgentWorkflowMode =
  | "full"
  | "analysis_only"
  | "parse_and_analyze"
  | "code_only"
  | "run_only"
  | "screenshot_only"
  | "report_only"
  | "evaluate_only"
  | "export_only";

export type RunAgentWorkflowInput = {
  taskId: string;
  userId?: string;
  mode: RunAgentWorkflowMode;
  allowDebugOnce?: boolean;
  allowBrowserScreenshot?: boolean;
  allowCommandScreenshot?: boolean;
  allowDocxExport?: boolean;
  forceRerun?: boolean;
  dryRun?: boolean;
  taskText?: string;
  fileRoles?: string[];
  parsedRequirements?: unknown;
  explicitScreenshotRequired?: boolean;
};

export type RunAgentWorkflowResult = {
  taskId: string;
  runId?: string;
  status: "success" | "failed" | "partial";
  workflowType: LabWorkflowType;
  trace: AgentTraceStep[];
  quality?: QualityEvaluationResult;
  artifacts: AgentTraceArtifact[];
  errors: string[];
  warnings: string[];
  message?: string;
};

const ORDERED_STEPS: AgentTraceStepName[] = [
  "parse-document",
  "analyze",
  "plan",
  "generate-code",
  "run-code",
  "debug-once",
  "generate-screenshot",
  "generate-report",
  "evaluate",
  "save-report",
  "export-docx",
];

function collectTaskTextFromDetail(taskDetail: TaskDetail) {
  return [
    taskDetail.task.title,
    taskDetail.task.description,
    taskDetail.input?.task_book_text,
    taskDetail.input?.requirement_text,
    taskDetail.input?.student_notes,
    taskDetail.input?.template_instructions,
    JSON.stringify(taskDetail.task.parsed_requirement_json ?? {}),
  ]
    .filter(Boolean)
    .join("\n\n");
}

function collectFileRoles(taskDetail: TaskDetail) {
  return taskDetail.files.map((file) => {
    const metadata = file.metadata ?? {};
    return String(metadata.file_role ?? metadata.inferred_file_role ?? file.file_type);
  });
}

function latestOutputValue<T>(taskDetail: TaskDetail, key: string): T | null {
  for (const output of taskDetail.outputs) {
    const value = output.report_json?.[key];
    if (value !== undefined && value !== null) return value as T;
  }
  return null;
}

function collectScreenshots(taskDetail: TaskDetail) {
  return mergeScreenshotEvidence(
    ...taskDetail.outputs.map((output) => extractScreenshotsFromReportJson(output.report_json)),
  );
}

function screenshotEvidenceToArtifacts(screenshots: unknown[]): AgentTraceArtifact[] {
  return mergeScreenshotEvidence(screenshots).map((screenshot) => ({
    kind: screenshot.kind,
    storagePath: screenshot.storagePath,
    signedUrl: screenshot.signedUrl,
    metadata: {
      ...screenshot.metadata,
      kind: screenshot.kind,
      status: screenshot.status,
      source: screenshot.source,
      label: screenshot.label,
      fileName: screenshot.fileName,
      createdAt: screenshot.createdAt,
      localPath: screenshot.localPath,
      missingReason: screenshot.missingReason,
    },
  }));
}

function expectedScreenshotKind(workflowType: LabWorkflowType): ScreenshotEvidenceKind {
  return workflowType.startsWith("frontend_")
    ? "browser_page_screenshot"
    : "command_output_screenshot";
}

function workflowRequiresScreenshot(
  inference: ReturnType<typeof inferWorkflowType>,
  input: RunAgentWorkflowInput,
  firstRun?: { screenshotRequired?: boolean } | null,
  finalRun?: { screenshotRequired?: boolean } | null,
) {
  if (typeof input.explicitScreenshotRequired === "boolean") {
    return input.explicitScreenshotRequired;
  }
  return Boolean(
    firstRun?.screenshotRequired ||
      finalRun?.screenshotRequired ||
      inference.requiredEvidence.some(
        (item) =>
          item === "command_output_screenshot" || item === "browser_page_screenshot",
      ),
  );
}

function createSkippedStep(input: {
  taskId: string;
  runId?: string;
  step: AgentTraceStepName;
  reason: string;
  artifacts?: AgentTraceArtifact[];
}) {
  const startedAt = new Date().toISOString();
  return {
    ...createTraceStep({
      taskId: input.taskId,
      runId: input.runId,
      step: input.step,
      inputSummary: input.reason,
      startedAt,
    }),
    status: "skipped" as const,
    outputSummary: input.reason,
    artifacts: input.artifacts,
    endedAt: startedAt,
    durationMs: 0,
  };
}

function createDryRunQuality(input: RunAgentWorkflowInput, workflowType: LabWorkflowType) {
  return createQualityEvaluation({
    taskRequirementsCovered: Boolean(input.taskText || input.parsedRequirements),
    codeGenerated: false,
    codeActuallyRan: false,
    screenshotRequirementHandled:
      workflowType === "no_screenshot_required" || input.explicitScreenshotRequired !== true,
    realScreenshotAttachedOrMissingMarked: false,
    docxOriginalStructurePreserved: input.allowDocxExport !== false,
    noFakeEvidence: true,
  });
}

export function createAgentWorkflowSkeleton(
  input: RunAgentWorkflowInput,
): RunAgentWorkflowResult {
  const inference = inferWorkflowType({
    taskText: input.taskText ?? "",
    fileRoles: input.fileRoles ?? [],
    parsedRequirements: input.parsedRequirements,
    explicitScreenshotRequired: input.explicitScreenshotRequired,
  });
  const trace = ORDERED_STEPS.map((step) => createSkippedStep({
    taskId: input.taskId,
    step,
    reason: `Dry run preview for mode ${input.mode}.`,
  }));

  return {
    taskId: input.taskId,
    status: "partial",
    workflowType: inference.workflowType,
    trace,
    quality: createDryRunQuality(input, inference.workflowType),
    artifacts: [],
    errors: [],
    warnings: ["Dry run only. No AI call, code execution, Storage write, or DOCX export was performed."],
    message: "Agent workflow dry run created.",
  };
}

async function runTraceStep<T>(
  trace: AgentTraceStep[],
  params: {
    taskId: string;
    runId: string;
    step: AgentTraceStepName;
    inputSummary: string;
    outputSummary?: (value: T) => string;
    artifacts?: (value: T) => AgentTraceArtifact[];
  },
  action: () => Promise<T>,
) {
  const started = createTraceStep({
    taskId: params.taskId,
    runId: params.runId,
    step: params.step,
    inputSummary: params.inputSummary,
  });
  trace.push(started);

  try {
    const value = await action();
    trace[trace.length - 1] = completeTraceStep(started, {
      outputSummary: params.outputSummary?.(value),
      artifacts: params.artifacts?.(value),
    });
    return value;
  } catch (error) {
    trace[trace.length - 1] = failTraceStep(started, {
      error: toUserFriendlyErrorMessage(error, "Agent workflow step failed."),
    });
    throw error;
  }
}

function inferFromTaskDetail(taskDetail: TaskDetail, explicitScreenshotRequired?: boolean) {
  return inferWorkflowType({
    taskText: collectTaskTextFromDetail(taskDetail),
    fileRoles: collectFileRoles(taskDetail),
    parsedRequirements: taskDetail.task.parsed_requirement_json,
    explicitScreenshotRequired,
  });
}

export async function runAgentWorkflowOrchestrated(
  supabase: SupabaseClient,
  input: RunAgentWorkflowInput & { userId: string },
): Promise<RunAgentWorkflowResult> {
  if (input.dryRun) return createAgentWorkflowSkeleton(input);

  const trace: AgentTraceStep[] = [];
  const artifacts: AgentTraceArtifact[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const run = await createTaskRun(supabase, {
    taskId: input.taskId,
    userId: input.userId,
    runType: TASK_RUN_TYPE.GENERATE_REPORT,
    modelName: "agent-orchestrator",
    inputContext: {
      agent_workflow: true,
      mode: input.mode,
      allow_debug_once: input.allowDebugOnce ?? true,
      allow_browser_screenshot: input.allowBrowserScreenshot ?? false,
      allow_docx_export: input.allowDocxExport ?? false,
    },
  });
  let workflowType: LabWorkflowType = "unknown";
  let quality: QualityEvaluationResult | undefined;
  let status: RunAgentWorkflowResult["status"] = "partial";

  try {
    let { context, taskDetail } = await buildTaskContext(
      supabase,
      input.userId,
      input.taskId,
    );
    let inference = inferFromTaskDetail(taskDetail, input.explicitScreenshotRequired);
    workflowType = inference.workflowType;

    trace.push(createSkippedStep({
      taskId: input.taskId,
      runId: run.id,
      step: "parse-document",
      reason: "parse-document is user/file selected and is not rerun by the one-click workflow.",
    }));

    let requirement = context.parsedRequirement;
    if (
      input.mode === "full" ||
      input.mode === "analysis_only" ||
      input.mode === "parse_and_analyze"
    ) {
      if (!requirement || input.forceRerun) {
        requirement = await runTraceStep(
          trace,
          {
            taskId: input.taskId,
            runId: run.id,
            step: "analyze",
            inputSummary: "Run AI task analysis from current task context.",
            outputSummary: (value: ParsedRequirement) =>
              `Analysis ready: ${value.experiment_title}; coding tasks: ${value.coding_tasks.length}.`,
          },
          async () => analyzeTask(supabase, input.userId, input.taskId),
        );
        await confirmTaskAnalysis(supabase, input.userId, input.taskId, requirement);
      } else {
        trace.push(createSkippedStep({
          taskId: input.taskId,
          runId: run.id,
          step: "analyze",
          reason: "Existing confirmed analysis was reused.",
        }));
      }
    }

    if (input.mode === "analysis_only" || input.mode === "parse_and_analyze") {
      ({ context, taskDetail } = await buildTaskContext(supabase, input.userId, input.taskId));
      inference = inferFromTaskDetail(taskDetail, input.explicitScreenshotRequired);
      workflowType = inference.workflowType;
      quality = evaluateTaskOutput({
        workflowType,
        taskText: collectTaskTextFromDetail(taskDetail),
        parsedRequirements: taskDetail.task.parsed_requirement_json,
        screenshots: collectScreenshots(taskDetail),
      });
      status = "partial";
      return await persistAgentRunResult(supabase, {
        taskId: input.taskId,
        userId: input.userId,
        taskRunId: run.id,
        status,
        workflowType,
        trace,
        quality,
        artifacts,
        errors,
        warnings,
      });
    }

    trace.push(createSkippedStep({
      taskId: input.taskId,
      runId: run.id,
      step: "plan",
      reason: "Plan is derived from confirmed analysis in the existing task runner.",
    }));

    const isFrontend = workflowType.startsWith("frontend_");
    let generatedCode = latestOutputValue<string>(taskDetail, "generated_code") ?? "";
    if (!isFrontend && (input.mode === "full" || input.mode === "code_only" || input.forceRerun || !generatedCode)) {
      generatedCode = await runTraceStep(
        trace,
        {
          taskId: input.taskId,
          runId: run.id,
          step: "generate-code",
          inputSummary: "Generate Python code through existing generate-code service.",
          outputSummary: (code) => `Generated code length: ${code.length}.`,
          artifacts: (code) => [{ kind: "source_code", metadata: { length: code.length } }],
        },
        async () => generatePythonCode(supabase, input.userId, input.taskId),
      );
      artifacts.push({ kind: "source_code", metadata: { length: generatedCode.length } });
    } else {
      trace.push(createSkippedStep({
        taskId: input.taskId,
        runId: run.id,
        step: "generate-code",
        reason: isFrontend
          ? "Frontend code generation is not connected to the one-click orchestrator yet."
          : "Existing generated code was reused.",
      }));
    }

    let firstRun: Awaited<ReturnType<typeof runTaskPythonCode>> | null = null;
    let finalRun: Awaited<ReturnType<typeof runTaskPythonCode>> | null = null;

    if (!isFrontend && (input.mode === "full" || input.mode === "run_only")) {
      firstRun = await runTraceStep(
        trace,
        {
          taskId: input.taskId,
          runId: run.id,
          step: "run-code",
          inputSummary: "Run generated Python code and capture stdout/stderr/exitCode/runtime.",
          outputSummary: (result) =>
            `success=${result.success}; exitCode=${result.exitCode}; runtime=${result.runtimeMs}ms; stdout=${result.stdout.length}; stderr=${result.stderr.length}.`,
          artifacts: (result) => [
            { kind: "stdout", metadata: { length: result.stdout.length } },
            { kind: "stderr", metadata: { length: result.stderr.length } },
            ...screenshotEvidenceToArtifacts(result.screenshots ?? []),
          ],
        },
        async () => runTaskPythonCode(supabase, input.userId, input.taskId, generatedCode),
      );
      finalRun = firstRun;

      if (firstRun.screenshots?.length) {
        artifacts.push(...screenshotEvidenceToArtifacts(firstRun.screenshots));
      }

      if (
        !firstRun.success &&
        firstRun.errorType !== "environment_error" &&
        input.allowDebugOnce !== false
      ) {
        const debugResult = await runTraceStep(
          trace,
          {
            taskId: input.taskId,
            runId: run.id,
            step: "debug-once",
            inputSummary: "Debug failed Python run once using stdout/stderr.",
            outputSummary: (result) =>
              result.fixed
                ? `Debug produced fixed code; changed points: ${result.changedPoints.length}.`
                : `Debug did not fix code: ${result.reason}`,
          },
          async () =>
            debugTaskPythonCode(supabase, input.userId, input.taskId, {
              code: generatedCode,
              stdout: firstRun?.stdout ?? "",
              stderr: firstRun?.stderr ?? "",
              errorType: firstRun?.errorType,
            }),
        );

        if (debugResult.fixed) {
          generatedCode = debugResult.fixedCode;
          finalRun = await runTraceStep(
            trace,
            {
              taskId: input.taskId,
              runId: run.id,
              step: "run-code",
              inputSummary: "Rerun fixed Python code after debug-once.",
              outputSummary: (result) =>
                `rerun success=${result.success}; exitCode=${result.exitCode}; runtime=${result.runtimeMs}ms.`,
              artifacts: (result) => [
                { kind: "stdout", metadata: { length: result.stdout.length } },
                { kind: "stderr", metadata: { length: result.stderr.length } },
                ...screenshotEvidenceToArtifacts(result.screenshots ?? []),
              ],
            },
            async () => runTaskPythonCode(supabase, input.userId, input.taskId, generatedCode),
          );
          if (finalRun.screenshots?.length) {
            artifacts.push(...screenshotEvidenceToArtifacts(finalRun.screenshots));
          }
        }
      } else {
        trace.push(createSkippedStep({
          taskId: input.taskId,
          runId: run.id,
          step: "debug-once",
          reason: firstRun.success ? "First run succeeded." : "Debug-once disabled or environment error.",
        }));
      }
    } else {
      trace.push(createSkippedStep({
        taskId: input.taskId,
        runId: run.id,
        step: "run-code",
        reason: isFrontend
          ? "Frontend browser screenshots are triggered by run-code runMode=frontend_browser."
          : "Run-code skipped by selected mode.",
      }));
      trace.push(createSkippedStep({
        taskId: input.taskId,
        runId: run.id,
        step: "debug-once",
        reason: "Debug-once skipped because run-code did not run.",
      }));
    }

    const currentScreenshotEvidence = mergeScreenshotEvidence(
      collectScreenshots(taskDetail),
      firstRun?.screenshots ?? [],
      finalRun?.screenshots ?? [],
    );
    const currentScreenshotArtifacts = screenshotEvidenceToArtifacts(currentScreenshotEvidence);
    const screenshotRequired = workflowRequiresScreenshot(
      inference,
      input,
      firstRun,
      finalRun,
    );
    const usableScreenshotCount = currentScreenshotEvidence.filter(isValidScreenshotEvidence).length;

    if (usableScreenshotCount > 0) {
      const started = createTraceStep({
        taskId: input.taskId,
        runId: run.id,
        step: "generate-screenshot",
        inputSummary:
          "Screenshot generation is performed inside run-code based on screenshot requirements.",
      });
      trace.push(
        completeTraceStep(started, {
          outputSummary:
            "截图已在 run-code 阶段生成，并已归档为截图证据。",
          artifacts: currentScreenshotArtifacts,
        }),
      );
    } else if (!screenshotRequired) {
      trace.push(createSkippedStep({
        taskId: input.taskId,
        runId: run.id,
        step: "generate-screenshot",
        reason: "任务无截图要求。",
      }));
    } else {
      const missingScreenshot = createMissingScreenshotEvidence(
        expectedScreenshotKind(workflowType),
        "任务要求截图，但当前没有找到真实截图。",
      );
      const missingArtifacts = screenshotEvidenceToArtifacts([missingScreenshot]);
      const started = createTraceStep({
        taskId: input.taskId,
        runId: run.id,
        step: "generate-screenshot",
        inputSummary:
          "Screenshot generation is performed inside run-code based on screenshot requirements.",
      });
      trace.push(
        failTraceStep(started, {
          outputSummary:
            "任务要求截图，但未找到真实截图，已记录截图缺失。",
          error: "任务要求截图，但当前没有找到真实截图。",
        }),
      );
      trace[trace.length - 1].artifacts = missingArtifacts;
    }

    let reportMarkdown = latestOutputValue<string>(taskDetail, "report_draft") ?? context.reportMarkdown ?? "";
    if (input.mode === "full" || input.mode === "report_only") {
      reportMarkdown = await runTraceStep(
        trace,
        {
          taskId: input.taskId,
          runId: run.id,
          step: "generate-report",
          inputSummary: "Generate report from real code/run evidence.",
          outputSummary: (markdown) => `Report markdown length: ${markdown.length}.`,
          artifacts: (markdown) => [{ kind: "report", metadata: { length: markdown.length } }],
        },
        async () => generateReportDraft(supabase, input.userId, input.taskId),
      );
      artifacts.push({ kind: "report", metadata: { length: reportMarkdown.length } });
    } else {
      trace.push(createSkippedStep({
        taskId: input.taskId,
        runId: run.id,
        step: "generate-report",
        reason: "Report generation skipped by selected mode.",
      }));
    }

    ({ context, taskDetail } = await buildTaskContext(supabase, input.userId, input.taskId));
    const runResult =
      finalRun ??
      latestOutputValue<Record<string, unknown>>(taskDetail, "final_run") ??
      latestOutputValue<Record<string, unknown>>(taskDetail, "run_result");
    const screenshots = mergeScreenshotEvidence(
      collectScreenshots(taskDetail),
      firstRun?.screenshots ?? [],
      finalRun?.screenshots ?? [],
    );
    quality = await runTraceStep(
      trace,
      {
        taskId: input.taskId,
        runId: run.id,
        step: "evaluate",
        inputSummary: "Evaluate generated output against real evidence requirements.",
        outputSummary: (result) =>
          `Quality score ${result.score}; passed=${result.passed}; blocking=${result.blockingIssues.length}.`,
      },
      async () =>
        evaluateTaskOutput({
          workflowType,
          taskText: collectTaskTextFromDetail(taskDetail),
          parsedRequirements: taskDetail.task.parsed_requirement_json,
          generatedCode,
          runResult,
          screenshots,
          trace,
          reportJson: { screenshots, agent_trace: trace, artifacts },
          reportText: reportMarkdown || context.reportMarkdown || "",
          exportMode: input.allowDocxExport === false ? "none" : "auto",
          screenshotRequired: input.explicitScreenshotRequired,
        }),
    );

    trace.push(createSkippedStep({
      taskId: input.taskId,
      runId: run.id,
      step: "save-report",
      reason: "Existing report generator already persists report output.",
    }));

    trace.push(createSkippedStep({
      taskId: input.taskId,
      runId: run.id,
      step: "export-docx",
      reason: input.allowDocxExport
        ? "DOCX export remains available through /api/tasks/[id]/export-docx after quality gate."
        : "DOCX export disabled for this agent run.",
    }));

    warnings.push(
      "DOCX export is quality-gated in the export endpoint; one-click agent run does not download DOCX in this local-first pass.",
    );
    status = quality.passed || reportMarkdown ? "success" : "partial";
  } catch (error) {
    const message = toUserFriendlyErrorMessage(error, "Agent workflow failed.");
    errors.push(message);
    status = "failed";
  }

  return persistAgentRunResult(supabase, {
    taskId: input.taskId,
    userId: input.userId,
    taskRunId: run.id,
    status,
    workflowType,
    trace,
    quality,
    artifacts,
    errors,
    warnings,
  });
}

async function persistAgentRunResult(
  supabase: SupabaseClient,
  input: {
    taskId: string;
    userId: string;
    taskRunId: string;
    status: RunAgentWorkflowResult["status"];
    workflowType: LabWorkflowType;
    trace: AgentTraceStep[];
    quality?: QualityEvaluationResult;
    artifacts: AgentTraceArtifact[];
    errors: string[];
    warnings: string[];
  },
): Promise<RunAgentWorkflowResult> {
  await createTaskOutput(supabase, {
    taskRunId: input.taskRunId,
    taskId: input.taskId,
    userId: input.userId,
    reportJson: {
      latest_agent_run: {
        taskId: input.taskId,
        runId: input.taskRunId,
        status: input.status,
        workflowType: input.workflowType,
        updatedAt: new Date().toISOString(),
      },
      agent_trace: input.trace,
      quality: input.quality ?? null,
      artifacts: input.artifacts,
      errors: input.errors,
      warnings: input.warnings,
    },
  });

  await finishTaskRun(supabase, input.taskRunId, {
    status: input.status === "failed" ? "error" : "success",
    errorMessage: input.errors[0] ?? null,
  });

  return {
    taskId: input.taskId,
    runId: input.taskRunId,
    status: input.status,
    workflowType: input.workflowType,
    trace: input.trace,
    quality: input.quality,
    artifacts: input.artifacts,
    errors: input.errors,
    warnings: input.warnings,
    message: "Agent workflow run persisted to task_outputs.report_json.agent_trace.",
  };
}
