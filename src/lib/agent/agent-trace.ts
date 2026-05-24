export type AgentTraceStepName =
  | "parse-document"
  | "analyze"
  | "plan"
  | "generate-code"
  | "run-code"
  | "debug-once"
  | "generate-screenshot"
  | "generate-report"
  | "evaluate"
  | "save-report"
  | "export-docx";

export type AgentTraceStepStatus =
  | "pending"
  | "running"
  | "success"
  | "failed"
  | "skipped";

export type AgentTraceArtifact = {
  kind:
    | "source_code"
    | "stdout"
    | "stderr"
    | "command_output_screenshot"
    | "browser_page_screenshot"
    | "report"
    | "docx";
  storagePath?: string;
  signedUrl?: string;
  metadata?: Record<string, unknown>;
};

export type AgentTraceStep = {
  id: string;
  taskId: string;
  runId?: string;
  step: AgentTraceStepName;
  status: AgentTraceStepStatus;
  inputSummary?: string;
  outputSummary?: string;
  artifacts?: AgentTraceArtifact[];
  error?: string;
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
};

export type AgentTrace = {
  taskId: string;
  runId?: string;
  workflowType: string;
  status: "success" | "failed" | "partial" | "running";
  steps: AgentTraceStep[];
  createdAt: string;
  updatedAt: string;
};

function createStepId(taskId: string, step: AgentTraceStepName) {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${taskId}:${step}:${suffix}`;
}

export function createTraceStep(params: {
  taskId: string;
  runId?: string;
  step: AgentTraceStepName;
  inputSummary?: string;
  startedAt?: string;
}): AgentTraceStep {
  return {
    id: createStepId(params.taskId, params.step),
    taskId: params.taskId,
    runId: params.runId,
    step: params.step,
    status: "running",
    inputSummary: params.inputSummary,
    startedAt: params.startedAt ?? new Date().toISOString(),
  };
}

export function completeTraceStep(
  step: AgentTraceStep,
  params: {
    outputSummary?: string;
    artifacts?: AgentTraceArtifact[];
    endedAt?: string;
  } = {},
): AgentTraceStep {
  const endedAt = params.endedAt ?? new Date().toISOString();
  return {
    ...step,
    status: "success",
    outputSummary: params.outputSummary,
    artifacts: params.artifacts ?? step.artifacts,
    endedAt,
    durationMs: Date.parse(endedAt) - Date.parse(step.startedAt),
  };
}

export function failTraceStep(
  step: AgentTraceStep,
  params: {
    error: string;
    outputSummary?: string;
    endedAt?: string;
  },
): AgentTraceStep {
  const endedAt = params.endedAt ?? new Date().toISOString();
  return {
    ...step,
    status: "failed",
    outputSummary: params.outputSummary,
    error: params.error,
    endedAt,
    durationMs: Date.parse(endedAt) - Date.parse(step.startedAt),
  };
}

export function summarizeTrace(trace: AgentTrace | AgentTraceStep[]) {
  const steps = Array.isArray(trace) ? trace : trace.steps;
  const failed = steps.filter((step) => step.status === "failed");
  const success = steps.filter((step) => step.status === "success");
  const skipped = steps.filter((step) => step.status === "skipped");

  return {
    total: steps.length,
    success: success.length,
    failed: failed.length,
    skipped: skipped.length,
    status:
      failed.length > 0
        ? "failed"
        : steps.some((step) => step.status === "running")
          ? "running"
          : skipped.length > 0
            ? "partial"
            : "success",
  };
}
