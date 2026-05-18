import type { BadgeProps } from "@/components/ui/badge";
import { z } from "zod";

export const TASK_STATUS = {
  DRAFT: "draft",
  UPLOADED: "uploaded",
  ANALYZING: "analyzing",
  ANALYZED: "analyzed",
  CONFIRMED: "confirmed",
  GENERATED: "generated",
  EXPORTED: "exported",
  FAILED: "failed",
} as const;

export const TASK_EXECUTION_STATUS = {
  PENDING: "pending",
  RUNNING: "running",
  SUCCESS: "success",
  ERROR: "error",
} as const;

export const TASK_STEP_STATUS = {
  PENDING: "pending",
  RUNNING: "running",
  SUCCESS: "success",
  ERROR: "error",
  SKIPPED: "skipped",
  SUCCEEDED_LEGACY: "succeeded",
  FAILED_LEGACY: "failed",
} as const;

export const TASK_RUN_STATUS = {
  QUEUED: "queued",
  RUNNING: "running",
  SUCCESS: "success",
  ERROR: "error",
  CANCELED: "canceled",
  SUCCEEDED_LEGACY: "succeeded",
  FAILED_LEGACY: "failed",
} as const;

export const TASK_RUN_TYPE = {
  ANALYZE: "analyze",
  CONFIRM_ANALYSIS: "confirm_analysis",
  GENERATE_CODE: "generate_code",
  RUN_CODE: "run_code",
  GENERATE_REPORT: "generate_report",
  SAVE_REPORT: "save_report",
  EXPORT_DOCX: "export_docx",
  CONSISTENCY_CHECK: "consistency_check",
  GENERATE_OUTLINE: "generate_outline",
} as const;

export const TASK_FILE_TYPE = {
  TASK_BOOK: "task_book",
  SCREENSHOT: "screenshot",
  DATA: "data",
  CODE: "code",
  TEMPLATE: "template",
  OTHER: "other",
} as const;

export const TASK_CURRENT_STEP = {
  UPLOADED: "uploaded",
  ANALYZING: "analyzing",
  ANALYSIS_READY: "analysis_ready",
  CONFIRMED: "confirmed",
  CODE_READY: "code_ready",
  CODE_RAN: "code_ran",
  REPORT_DRAFT_READY: "report_draft_ready",
  EXPORTED: "exported",
  FAILED: "failed",
} as const;

export const taskStatusSchema = z.enum([
  TASK_STATUS.DRAFT,
  TASK_STATUS.UPLOADED,
  TASK_STATUS.ANALYZING,
  TASK_STATUS.ANALYZED,
  TASK_STATUS.CONFIRMED,
  TASK_STATUS.GENERATED,
  TASK_STATUS.EXPORTED,
  TASK_STATUS.FAILED,
]);

export const taskExecutionStatusSchema = z.enum([
  TASK_EXECUTION_STATUS.PENDING,
  TASK_EXECUTION_STATUS.RUNNING,
  TASK_EXECUTION_STATUS.SUCCESS,
  TASK_EXECUTION_STATUS.ERROR,
]);

export const taskStepStatusSchema = z.enum([
  TASK_STEP_STATUS.PENDING,
  TASK_STEP_STATUS.RUNNING,
  TASK_STEP_STATUS.SUCCESS,
  TASK_STEP_STATUS.ERROR,
  TASK_STEP_STATUS.SKIPPED,
  TASK_STEP_STATUS.SUCCEEDED_LEGACY,
  TASK_STEP_STATUS.FAILED_LEGACY,
]);

export const taskRunStatusSchema = z.enum([
  TASK_RUN_STATUS.QUEUED,
  TASK_RUN_STATUS.RUNNING,
  TASK_RUN_STATUS.SUCCESS,
  TASK_RUN_STATUS.ERROR,
  TASK_RUN_STATUS.CANCELED,
  TASK_RUN_STATUS.SUCCEEDED_LEGACY,
  TASK_RUN_STATUS.FAILED_LEGACY,
]);

export const taskRunTypeSchema = z.enum([
  TASK_RUN_TYPE.ANALYZE,
  TASK_RUN_TYPE.CONFIRM_ANALYSIS,
  TASK_RUN_TYPE.GENERATE_CODE,
  TASK_RUN_TYPE.RUN_CODE,
  TASK_RUN_TYPE.GENERATE_REPORT,
  TASK_RUN_TYPE.SAVE_REPORT,
  TASK_RUN_TYPE.EXPORT_DOCX,
  TASK_RUN_TYPE.CONSISTENCY_CHECK,
  TASK_RUN_TYPE.GENERATE_OUTLINE,
]);

export const taskFileTypeSchema = z.enum([
  TASK_FILE_TYPE.TASK_BOOK,
  TASK_FILE_TYPE.SCREENSHOT,
  TASK_FILE_TYPE.DATA,
  TASK_FILE_TYPE.CODE,
  TASK_FILE_TYPE.TEMPLATE,
  TASK_FILE_TYPE.OTHER,
]);

export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type TaskExecutionStatus = z.infer<typeof taskExecutionStatusSchema>;
export type TaskStepStatusDb = z.infer<typeof taskStepStatusSchema>;
export type TaskRunStatusDb = z.infer<typeof taskRunStatusSchema>;
export type TaskRunType = z.infer<typeof taskRunTypeSchema>;
export type TaskFileType = z.infer<typeof taskFileTypeSchema>;
export type TaskCurrentStep =
  (typeof TASK_CURRENT_STEP)[keyof typeof TASK_CURRENT_STEP];

const currentStepLabels: Record<TaskCurrentStep, string> = {
  [TASK_CURRENT_STEP.UPLOADED]: "已上传",
  [TASK_CURRENT_STEP.ANALYZING]: "分析中",
  [TASK_CURRENT_STEP.ANALYSIS_READY]: "待确认解析",
  [TASK_CURRENT_STEP.CONFIRMED]: "已确认",
  [TASK_CURRENT_STEP.CODE_READY]: "代码已生成",
  [TASK_CURRENT_STEP.CODE_RAN]: "代码已运行",
  [TASK_CURRENT_STEP.REPORT_DRAFT_READY]: "报告草稿已生成",
  [TASK_CURRENT_STEP.EXPORTED]: "DOCX 已导出",
  [TASK_CURRENT_STEP.FAILED]: "失败",
};

const statusLabels: Record<TaskStatus, string> = {
  [TASK_STATUS.DRAFT]: "等待中",
  [TASK_STATUS.UPLOADED]: "等待解析",
  [TASK_STATUS.ANALYZING]: "生成中",
  [TASK_STATUS.ANALYZED]: "待确认",
  [TASK_STATUS.CONFIRMED]: "生成中",
  [TASK_STATUS.GENERATED]: "已完成",
  [TASK_STATUS.EXPORTED]: "已完成",
  [TASK_STATUS.FAILED]: "失败",
};

const statusTones: Record<TaskStatus, BadgeProps["tone"]> = {
  [TASK_STATUS.DRAFT]: "neutral",
  [TASK_STATUS.UPLOADED]: "accent",
  [TASK_STATUS.ANALYZING]: "accent",
  [TASK_STATUS.ANALYZED]: "warning",
  [TASK_STATUS.CONFIRMED]: "primary",
  [TASK_STATUS.GENERATED]: "success",
  [TASK_STATUS.EXPORTED]: "success",
  [TASK_STATUS.FAILED]: "danger",
};

export function getTaskStatusLabel(status: TaskStatus) {
  return statusLabels[status] ?? status;
}

export function getTaskStatusTone(status: TaskStatus): BadgeProps["tone"] {
  return statusTones[status] ?? "neutral";
}

export function getTaskCurrentStepLabel(currentStep: string | null) {
  if (!currentStep) {
    return currentStepLabels[TASK_CURRENT_STEP.UPLOADED];
  }

  if (currentStep in currentStepLabels) {
    return currentStepLabels[currentStep as TaskCurrentStep];
  }

  return currentStep;
}

export function normalizeTaskRunStatus(status: TaskRunStatusDb) {
  if (status === TASK_RUN_STATUS.SUCCEEDED_LEGACY) return TASK_EXECUTION_STATUS.SUCCESS;
  if (status === TASK_RUN_STATUS.FAILED_LEGACY) return TASK_EXECUTION_STATUS.ERROR;
  if (status === TASK_RUN_STATUS.RUNNING) return TASK_EXECUTION_STATUS.RUNNING;
  if (status === TASK_RUN_STATUS.QUEUED) return TASK_EXECUTION_STATUS.PENDING;
  return status;
}

export function normalizeTaskStepStatus(status: TaskStepStatusDb) {
  if (status === TASK_STEP_STATUS.SUCCEEDED_LEGACY) return TASK_EXECUTION_STATUS.SUCCESS;
  if (status === TASK_STEP_STATUS.FAILED_LEGACY) return TASK_EXECUTION_STATUS.ERROR;
  if (status === TASK_STEP_STATUS.SKIPPED) return TASK_EXECUTION_STATUS.PENDING;
  return status;
}

export function getTaskFlowStepIndex(taskStatus: TaskStatus) {
  if (taskStatus === TASK_STATUS.EXPORTED) return 5;
  if (taskStatus === TASK_STATUS.GENERATED) return 4;
  if (taskStatus === TASK_STATUS.CONFIRMED) return 3;
  if (taskStatus === TASK_STATUS.ANALYZED || taskStatus === TASK_STATUS.ANALYZING) return 2;
  if (taskStatus === TASK_STATUS.UPLOADED) return 1;
  return 0;
}
