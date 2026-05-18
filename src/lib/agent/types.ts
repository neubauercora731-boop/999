export type LabTaskType = "python_lab" | "web_lab" | "database_lab" | "unknown";

export interface LabTaskInput {
  taskId: string;
  requirement: string;
  taskType?: LabTaskType;
  demoMode?: boolean;
}

export interface TaskPlan {
  title: string;
  taskType: LabTaskType | string;
  language: string;
  steps: string[];
  needRunCode: boolean;
  expectedOutput: string;
  reportOutline: string[];
  assumptions: string[];
  missingInfo: string[];
  riskNotes: string[];
}

export interface GeneratedCode {
  filename: string;
  language: string;
  code: string;
  explanation: string;
  runCommand: string;
  expectedStdout: string;
}

export type RunErrorType =
  | "runtime_error"
  | "timeout"
  | "environment_error"
  | "security_blocked";

export interface RunResult {
  success: boolean;
  stdout: string;
  stderr: string;
  runtimeMs: number;
  errorType?: RunErrorType;
}

export interface DebugResult {
  fixed: boolean;
  fixedCode: string;
  reason: string;
  changedPoints: string[];
}

export interface ReportResult {
  title: string;
  purpose: string;
  environment: string;
  principle: string;
  steps: string;
  code: string;
  result: string;
  analysis: string;
  summary: string;
  limitations?: string;
}

export interface AgentWorkflowResult {
  success: boolean;
  stage: string;
  plan?: TaskPlan;
  generatedCode?: GeneratedCode;
  firstRun?: RunResult;
  debugResult?: DebugResult;
  finalRun?: RunResult;
  report?: ReportResult;
  reportMarkdown?: string;
  errorMessage?: string;
}
