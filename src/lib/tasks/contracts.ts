import { z } from "zod";

import type {
  ConsistencyCheckResult,
  OutlineDocument,
  ParsedRequirement,
} from "@/lib/ai/types";
import {
  taskExecutionStatusSchema,
  taskFileTypeSchema,
  taskRunStatusSchema,
  taskRunTypeSchema,
  taskStatusSchema,
  taskStepStatusSchema,
  type TaskExecutionStatus,
  type TaskFileType,
  type TaskRunStatusDb,
  type TaskRunType,
  type TaskStatus,
  type TaskStepStatusDb,
} from "@/lib/tasks/task-status";

export {
  taskExecutionStatusSchema,
  taskFileTypeSchema,
  taskRunStatusSchema,
  taskRunTypeSchema,
  taskStatusSchema,
  taskStepStatusSchema,
};

export const newTaskSchema = z.object({
  title: z.string().trim().max(120).optional().or(z.literal("")),
  experimentName: z.string().trim().max(120).optional().or(z.literal("")),
  courseName: z.string().trim().max(120).optional().or(z.literal("")),
  requirementText: z.string().trim().max(20000).optional().or(z.literal("")),
  taskBookText: z.string().trim().max(10000).optional().or(z.literal("")),
  notes: z.string().trim().max(4000).optional().or(z.literal("")),
  templateInstructions: z.string().trim().max(4000).optional().or(z.literal("")),
});

export type NewTaskInput = z.infer<typeof newTaskSchema>;
export type {
  ParsedRequirement,
  OutlineDocument,
  ConsistencyCheckResult,
  TaskStatus,
  TaskExecutionStatus,
  TaskFileType,
  TaskRunType,
  TaskRunStatusDb,
  TaskStepStatusDb,
};

export interface TaskRecord {
  id: string;
  user_id: string;
  title: string;
  status: TaskStatus;
  current_step: string | null;
  experiment_name: string | null;
  course_name: string | null;
  description: string | null;
  analysis_summary: ParsedRequirement | Record<string, unknown> | null;
  missing_fields: string[] | unknown[] | null;
  parsed_requirement_json: ParsedRequirement | null;
  outline_json: OutlineDocument | null;
  report_markdown: string | null;
  analysis_status: TaskExecutionStatus;
  generation_status: TaskExecutionStatus;
  consistency_status: TaskExecutionStatus;
  last_error: string | null;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskInputRecord {
  id: string;
  task_id: string;
  user_id: string;
  task_book_text: string | null;
  requirement_text: string | null;
  student_notes: string | null;
  template_instructions: string | null;
  raw_payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TaskFileRecord {
  id: string;
  task_id: string;
  user_id: string;
  file_type: TaskFileType;
  storage_bucket: string;
  storage_path: string;
  original_filename: string;
  mime_type: string | null;
  file_size: number | null;
  checksum: string | null;
  parsed_text?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TaskRunRecord {
  id: string;
  task_id: string;
  user_id: string;
  run_no: number | null;
  run_type: TaskRunType;
  status: TaskRunStatusDb;
  model_name: string | null;
  model: string | null;
  input_context: Record<string, unknown>;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskStepRecord {
  id: string;
  task_run_id: string;
  task_id: string;
  user_id: string;
  step_key: string;
  step_order: number;
  status: TaskStepStatusDb;
  input_payload: Record<string, unknown>;
  output_payload: Record<string, unknown>;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskOutputRecord {
  id: string;
  task_run_id: string;
  task_id: string;
  user_id: string;
  parsed_requirement_json: ParsedRequirement | null;
  missing_fields_json: string[] | unknown[] | null;
  outline_json: OutlineDocument | null;
  report_json: Record<string, unknown> | null;
  consistency_json: ConsistencyCheckResult | null;
  outline_markdown: string | null;
  report_markdown: string | null;
  docx_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskAnalysisRecord {
  id: string;
  task_id: string;
  user_id: string;
  analysis_json: ParsedRequirement;
  confirmed_by_user: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProfileRecord {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  student_number: string | null;
  major: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskDetail {
  task: TaskRecord;
  input: TaskInputRecord | null;
  files: TaskFileRecord[];
  runs: TaskRunRecord[];
  steps: TaskStepRecord[];
  outputs: TaskOutputRecord[];
}
