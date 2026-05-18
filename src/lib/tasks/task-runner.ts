import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import type { SupabaseClient } from "@supabase/supabase-js";

import { callMoonshotJson } from "@/lib/ai/moonshot";
import type { ParsedRequirement } from "@/lib/ai/types";
import {
  buildCodePrompt,
  buildDebugPrompt,
  buildPlanPrompt,
  buildReportPrompt,
} from "@/lib/agent/prompts";
import type {
  AgentWorkflowResult,
  DebugResult,
  GeneratedCode,
  RunErrorType,
  RunResult,
  TaskPlan,
} from "@/lib/agent/types";
import {
  debugResultSchema,
  generatedCodeSchema,
  getFallbackTaskPlan,
  normalizeGeneratedPythonCode,
  reportResultSchema,
  taskPlanSchema,
} from "@/lib/agent/validators";
import {
  buildReportFallback,
  isPythonPlan,
  parsedRequirementToTaskPlan,
  reportResultToMarkdown,
  taskPlanToParsedRequirement,
} from "@/lib/agent/workflow";
import { AGENT_ERROR_CODE, AgentWorkflowError } from "@/lib/agent/errors";
import { buildTaskContext } from "@/lib/tasks/context-builder";
import {
  createTaskOutput,
  createTaskRun,
  finishTaskRun,
  updateTaskExecutionStatuses,
} from "@/lib/tasks/repository";
import {
  TASK_CURRENT_STEP,
  TASK_EXECUTION_STATUS,
  TASK_RUN_TYPE,
  TASK_STATUS,
} from "@/lib/tasks/task-status";
import { toUserFriendlyErrorMessage } from "@/lib/utils";

const PYTHON_TIMEOUT_MS = 8_000;
const MAX_STDIO = 20_000;

type RunTaskResult = RunResult & {
  exitCode: number | null;
  timedOut: boolean;
  message?: string;
  command?: string;
};

function limitText(value: string, maxLength = MAX_STDIO) {
  if (value.length <= maxLength) return value;
  return `...输出过长，已截取最后 ${maxLength} 个字符...\n${value.slice(-maxLength)}`;
}

function getLatestOutputValue<T>(
  outputs: Array<{ report_json: Record<string, unknown> | null; report_markdown?: string | null }>,
  key: string,
): T | null {
  for (const output of outputs) {
    const value = output.report_json?.[key];
    if (value !== undefined) return value as T;
  }
  return null;
}

function getLatestRunResult(
  outputs: Array<{ report_json: Record<string, unknown> | null }>,
  key: "first_run" | "final_run" | "run_result" = "final_run",
) {
  const result = getLatestOutputValue<RunTaskResult>(outputs, key);
  if (result && typeof result === "object" && "success" in result) {
    return result;
  }

  const stdout = getLatestOutputValue<string>(outputs, "stdout") || "";
  const stderr = getLatestOutputValue<string>(outputs, "stderr") || "";
  const timedOut = Boolean(getLatestOutputValue<boolean>(outputs, "timed_out"));
  const exitCode = getLatestOutputValue<number | null>(outputs, "exit_code");

  if (!stdout && !stderr && !timedOut && exitCode === null) return null;

  return {
    success: Boolean(exitCode === 0 && !timedOut),
    stdout,
    stderr,
    runtimeMs: 0,
    exitCode: exitCode ?? null,
    timedOut,
    errorType: timedOut ? "timeout" : exitCode === 0 ? undefined : "runtime_error",
  } satisfies RunTaskResult;
}

function mergedParsedText(files: Array<{ original_filename: string; parsed_text?: string | null; metadata: Record<string, unknown> }>) {
  return files
    .map((file) => {
      const text =
        file.parsed_text ||
        (typeof file.metadata?.text_excerpt === "string" ? file.metadata.text_excerpt : "");
      return text ? `# ${file.original_filename}\n${text}` : "";
    })
    .filter(Boolean)
    .join("\n\n");
}

function buildRequirementSource(context: {
  title?: string;
  requirementText?: string;
  taskBookText?: string;
  notes?: string;
  templateInstructions?: string;
}) {
  return [
    context.title,
    context.requirementText,
    context.taskBookText,
    context.notes,
    context.templateInstructions,
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function pyString(value: string) {
  return JSON.stringify(value);
}

function buildBubbleSortCode() {
  return `
def bubble_sort(values):
    data = values[:]
    compare_count = 0
    swap_count = 0

    for i in range(len(data) - 1):
        for j in range(len(data) - 1 - i):
            compare_count += 1
            if data[j] > data[j + 1]:
                data[j], data[j + 1] = data[j + 1], data[j]
                swap_count += 1

    return data, compare_count, swap_count


def main():
    sample = [64, 25, 12, 22, 11]
    sorted_data, compare_count, swap_count = bubble_sort(sample)
    print("冒泡排序实验")
    print("原始数据:", sample)
    print("排序结果:", sorted_data)
    print("比较次数:", compare_count)
    print("交换次数:", swap_count)


if __name__ == "__main__":
    main()
`.trim();
}

function buildScoreStatsCode() {
  return `
def calculate_score_statistics(scores):
    total = sum(scores)
    average = total / len(scores)
    highest = max(scores)
    lowest = min(scores)
    return average, highest, lowest


def main():
    students = {
        "张三": 86,
        "李四": 92,
        "王五": 78,
        "赵六": 95,
        "钱七": 88,
    }
    scores = list(students.values())
    average, highest, lowest = calculate_score_statistics(scores)

    print("学生成绩统计实验")
    print("学生成绩:", students)
    print(f"平均分: {average:.2f}")
    print("最高分:", highest)
    print("最低分:", lowest)


if __name__ == "__main__":
    main()
`.trim();
}

function buildGenericPythonCode(plan: TaskPlan) {
  return `
def main():
    experiment_title = ${pyString(plan.title)}
    steps = ${JSON.stringify(plan.steps, null, 4)}

    print("实验名称:", experiment_title)
    print("实验步骤:")
    for index, step in enumerate(steps, start=1):
        print(f"{index}. {step}")
    print("运行说明: 当前示例使用内置数据完成流程验证。")
    print("预期输出:", ${pyString(plan.expectedOutput)})


if __name__ == "__main__":
    main()
`.trim();
}

function buildFallbackGeneratedCode(plan: TaskPlan, sourceText: string, warning?: string) {
  const source = `${plan.title}\n${sourceText}`.toLowerCase();
  const code = source.includes("冒泡") || source.includes("bubble")
    ? buildBubbleSortCode()
    : source.includes("成绩") || source.includes("平均分") || source.includes("score")
      ? buildScoreStatsCode()
      : buildGenericPythonCode(plan);

  return generatedCodeSchema.parse({
    filename: "main.py",
    language: "Python",
    code,
    explanation: warning
      ? `AI 代码生成不稳定，已使用安全模板兜底：${warning}`
      : "已生成可运行的 Python 实验代码。",
    runCommand: "python main.py",
    expectedStdout: plan.expectedOutput,
  });
}

function containsDangerousPython(code: string) {
  const patterns = [
    /\bos\.system\s*\(/,
    /\bsubprocess\b/,
    /\bsocket\b/,
    /\brequests\b/,
    /\burllib\b/,
    /\bshutil\.rmtree\s*\(/,
    /pathlib\.Path\s*\(\s*["']\/["']\s*\)/,
    /\bopen\s*\(\s*["']\/etc/i,
    /\bopen\s*\(\s*["'][a-zA-Z]:\\/,
    /\beval\s*\(/,
    /\bexec\s*\(/,
    /__import__/,
    /while\s+True\s*:/,
  ];

  return patterns.some((pattern) => pattern.test(code));
}

function getRunMessage(result: RunTaskResult) {
  if (result.success) return "代码运行成功。";
  if (result.errorType === "environment_error") {
    return "当前线上环境暂不支持真实 Python 运行，请复制代码到本地运行，或后续接入 Worker。";
  }
  if (result.errorType === "timeout") {
    return "代码运行超时，可能存在死循环或任务过长。";
  }
  if (result.errorType === "security_blocked") {
    return "代码包含潜在危险操作，系统已阻止运行。";
  }
  return "代码运行失败，请查看错误信息。";
}

async function runPythonWithCommand(command: string, code: string) {
  const startedAt = Date.now();
  const dir = await mkdtemp(path.join(tmpdir(), "lab-report-run-"));
  const file = path.join(dir, "main.py");
  await writeFile(file, code, "utf8");

  return new Promise<RunTaskResult & { commandNotFound?: boolean }>((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;
    const child = spawn(command, [file], {
      cwd: dir,
      env: {
        ...process.env,
        PATH: process.env.PATH ?? "",
        PYTHONIOENCODING: "utf-8",
        PYTHONUTF8: "1",
      },
      windowsHide: true,
    });

    const cleanupAndResolve = async (
      result: RunTaskResult & { commandNotFound?: boolean },
    ) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      await rm(dir, { recursive: true, force: true });
      resolve(result);
    };

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, PYTHON_TIMEOUT_MS);

    child.stdout.on("data", (chunk) => {
      stdout = limitText(stdout + chunk.toString("utf8"));
    });
    child.stderr.on("data", (chunk) => {
      stderr = limitText(stderr + chunk.toString("utf8"));
    });
    child.on("error", (error) => {
      const nodeError = error as NodeJS.ErrnoException;
      void cleanupAndResolve({
        success: false,
        stdout,
        stderr: nodeError.code === "ENOENT" ? "" : limitText(nodeError.message),
        runtimeMs: Date.now() - startedAt,
        exitCode: null,
        timedOut: false,
        errorType: "environment_error",
        command,
        commandNotFound: nodeError.code === "ENOENT",
        message:
          nodeError.code === "ENOENT"
            ? "当前线上环境暂不支持真实 Python 运行，请复制代码到本地运行，或后续接入 Worker。"
            : nodeError.message,
      });
    });
    child.on("close", (exitCode) => {
      const runtimeMs = Date.now() - startedAt;
      void cleanupAndResolve({
        success: exitCode === 0 && !timedOut,
        stdout,
        stderr,
        runtimeMs,
        exitCode,
        timedOut,
        errorType: timedOut ? "timeout" : exitCode === 0 ? undefined : "runtime_error",
        command,
        message:
          exitCode === 0 && !timedOut
            ? "代码运行成功。"
            : timedOut
              ? "代码运行超时，可能存在死循环或任务过长。"
              : "代码运行失败，请查看错误信息。",
      });
    });
  });
}

async function runPython(code: string): Promise<RunTaskResult> {
  for (const command of ["python", "python3"]) {
    const result = await runPythonWithCommand(command, code);
    if (!result.commandNotFound) {
      return result;
    }
  }

  return {
    success: false,
    stdout: "",
    stderr: "",
    runtimeMs: 0,
    exitCode: null,
    timedOut: false,
    errorType: "environment_error",
    message: "当前线上环境暂不支持真实 Python 运行，请复制代码到本地运行，或后续接入 Worker。",
  };
}

async function markFailure(
  supabase: SupabaseClient,
  taskId: string,
  message: string,
) {
  await updateTaskExecutionStatuses(supabase, taskId, {
    status: TASK_STATUS.FAILED,
    currentStep: TASK_CURRENT_STEP.FAILED,
    lastError: message,
    generationStatus: TASK_EXECUTION_STATUS.ERROR,
  });
}

export async function analyzeTask(
  supabase: SupabaseClient,
  userId: string,
  taskId: string,
) {
  const { context, taskDetail } = await buildTaskContext(supabase, userId, taskId);

  await updateTaskExecutionStatuses(supabase, taskId, {
    status: TASK_STATUS.ANALYZING,
    currentStep: TASK_CURRENT_STEP.ANALYZING,
    analysisStatus: TASK_EXECUTION_STATUS.RUNNING,
    lastError: null,
  });

  const run = await createTaskRun(supabase, {
    taskId,
    userId,
    runType: TASK_RUN_TYPE.ANALYZE,
    modelName: process.env.MOONSHOT_MODEL || "kimi-k2.5",
    inputContext: { file_count: taskDetail.files.length, p1_agent: true },
  });

  const requirementText = buildRequirementSource(context);
  let plan: TaskPlan;
  let warning: string | null = null;

  try {
    const prompt = buildPlanPrompt({
      title: context.title,
      requirementText,
      taskBookText: context.taskBookText,
      notes: context.notes,
      fileSummary: mergedParsedText(taskDetail.files),
    });
    const result = await callMoonshotJson<TaskPlan>({
      ...prompt,
      schema: taskPlanSchema,
      maxTokens: 4096,
      timeoutMs: 120000,
      metadata: { taskId, stepName: "agent_plan" },
    });
    plan = result.parsed;
  } catch (error) {
    warning = toUserFriendlyErrorMessage(
      error,
      "AI 返回格式异常，系统已尝试使用模板兜底。",
    );
    plan = getFallbackTaskPlan({
      title: context.title,
      requirementText,
    });
  }

  const analysis = taskPlanToParsedRequirement(plan, {
    courseName: context.courseName,
  });

  await supabase.from("task_analysis").upsert(
    {
      task_id: taskId,
      user_id: userId,
      analysis_json: analysis,
      confirmed_by_user: false,
    },
    { onConflict: "task_id" },
  );

  await createTaskOutput(supabase, {
    taskRunId: run.id,
    taskId,
    userId,
    parsedRequirementJson: analysis as unknown as Record<string, unknown>,
    missingFieldsJson: analysis.missing_info,
    reportJson: {
      parsed_text: mergedParsedText(taskDetail.files),
      agent_plan: plan as unknown as Record<string, unknown>,
      warning,
    },
  });

  await updateTaskExecutionStatuses(supabase, taskId, {
    status: TASK_STATUS.ANALYZED,
    currentStep: TASK_CURRENT_STEP.ANALYSIS_READY,
    analysisStatus: TASK_EXECUTION_STATUS.SUCCESS,
    parsedRequirementJson: analysis,
    experimentName: analysis.experiment_title,
    courseName: analysis.course_name,
    description: `已拆解为 ${analysis.coding_tasks.length} 个实验代码任务，等待用户确认。`,
    missingFields: analysis.missing_info,
    lastError: null,
  });
  await finishTaskRun(supabase, run.id, { status: "success" });
  return analysis;
}

export async function confirmTaskAnalysis(
  supabase: SupabaseClient,
  userId: string,
  taskId: string,
  analysis: ParsedRequirement,
) {
  const run = await createTaskRun(supabase, {
    taskId,
    userId,
    runType: TASK_RUN_TYPE.CONFIRM_ANALYSIS,
    modelName: "user-confirmed",
    inputContext: { analysis },
  });

  await supabase.from("task_analysis").upsert(
    {
      task_id: taskId,
      user_id: userId,
      analysis_json: analysis,
      confirmed_by_user: true,
    },
    { onConflict: "task_id" },
  );

  await updateTaskExecutionStatuses(supabase, taskId, {
    status: TASK_STATUS.CONFIRMED,
    currentStep: TASK_CURRENT_STEP.CONFIRMED,
    confirmedAt: new Date().toISOString(),
    parsedRequirementJson: analysis,
    experimentName: analysis.experiment_title,
    courseName: analysis.course_name,
    missingFields: analysis.missing_info,
    lastError: null,
  });

  await finishTaskRun(supabase, run.id, { status: "success" });
  return analysis;
}

export async function generatePythonCode(
  supabase: SupabaseClient,
  userId: string,
  taskId: string,
) {
  const { context } = await buildTaskContext(supabase, userId, taskId);
  const requirement = context.parsedRequirement;
  if (!requirement) throw new Error("请先完成结构化分析并确认。");

  const plan = parsedRequirementToTaskPlan(requirement);
  const requirementText = buildRequirementSource(context);

  if (!isPythonPlan(plan)) {
    throw new AgentWorkflowError(
      AGENT_ERROR_CODE.CODE_GENERATE_FAILED,
      "当前 P1 版本优先支持 Python 实验，其他类型将在后续支持。",
      { status: 400 },
    );
  }

  const run = await createTaskRun(supabase, {
    taskId,
    userId,
    runType: TASK_RUN_TYPE.GENERATE_CODE,
    modelName: process.env.MOONSHOT_MODEL || "kimi-k2.5",
    inputContext: { requirement, plan },
  });

  let generatedCode: GeneratedCode;
  let warning: string | null = null;

  try {
    const prompt = buildCodePrompt({
      plan,
      parsedRequirement: requirement,
      requirementText,
      taskBookText: context.taskBookText,
    });
    const result = await callMoonshotJson<GeneratedCode>({
      ...prompt,
      schema: generatedCodeSchema,
      maxTokens: 4096,
      timeoutMs: 120000,
      metadata: { taskId, stepName: "generate_code" },
    });
    generatedCode = result.parsed;

    if (containsDangerousPython(generatedCode.code)) {
      throw new AgentWorkflowError(AGENT_ERROR_CODE.CODE_SECURITY_BLOCKED);
    }
  } catch (error) {
    warning = toUserFriendlyErrorMessage(
      error,
      "代码生成失败，请调整任务要求后重试。",
    );
    generatedCode = buildFallbackGeneratedCode(plan, requirementText, warning);
  }

  await createTaskOutput(supabase, {
    taskRunId: run.id,
    taskId,
    userId,
    reportJson: {
      generated_code: generatedCode.code,
      generated_code_meta: generatedCode as unknown as Record<string, unknown>,
      warning,
    },
  });
  await updateTaskExecutionStatuses(supabase, taskId, {
    status: TASK_STATUS.CONFIRMED,
    currentStep: TASK_CURRENT_STEP.CODE_READY,
    generationStatus: TASK_EXECUTION_STATUS.SUCCESS,
    lastError: null,
  });
  await finishTaskRun(supabase, run.id, { status: "success" });
  return generatedCode.code;
}

export async function runTaskPythonCode(
  supabase: SupabaseClient,
  userId: string,
  taskId: string,
  code?: string,
) {
  const { taskDetail } = await buildTaskContext(supabase, userId, taskId);
  const resolvedCode =
    code?.trim() ||
    getLatestOutputValue<string>(taskDetail.outputs, "generated_code") ||
    "";
  if (!resolvedCode) throw new Error("请先生成或粘贴 Python 代码。");

  const run = await createTaskRun(supabase, {
    taskId,
    userId,
    runType: TASK_RUN_TYPE.RUN_CODE,
    modelName: "local-python",
    inputContext: { timeout_ms: PYTHON_TIMEOUT_MS },
  });

  const result: RunTaskResult = containsDangerousPython(resolvedCode)
    ? {
        success: false,
        stdout: "",
        stderr: "代码包含潜在危险操作，系统已阻止运行。",
        runtimeMs: 0,
        exitCode: null,
        timedOut: false,
        errorType: "security_blocked",
        message: "代码包含潜在危险操作，系统已阻止运行。",
      }
    : await runPython(resolvedCode);

  const message = getRunMessage(result);

  await createTaskOutput(supabase, {
    taskRunId: run.id,
    taskId,
    userId,
    reportJson: {
      generated_code: resolvedCode,
      stdout: result.stdout,
      stderr: result.stderr,
      exit_code: result.exitCode,
      timed_out: result.timedOut,
      runtime_ms: result.runtimeMs,
      error_type: result.errorType ?? null,
      run_result: result as unknown as Record<string, unknown>,
    },
  });
  await updateTaskExecutionStatuses(supabase, taskId, {
    status: TASK_STATUS.CONFIRMED,
    currentStep: TASK_CURRENT_STEP.CODE_RAN,
    lastError: result.success ? null : message,
  });
  await finishTaskRun(supabase, run.id, {
    status: result.success ? "success" : "error",
    errorMessage: result.success ? null : message,
  });
  return result;
}

export async function debugTaskPythonCode(
  supabase: SupabaseClient,
  userId: string,
  taskId: string,
  params: {
    code?: string;
    stdout?: string;
    stderr?: string;
    errorType?: RunErrorType;
  } = {},
) {
  const { context, taskDetail } = await buildTaskContext(supabase, userId, taskId);
  const requirement = context.parsedRequirement;
  if (!requirement) throw new Error("请先完成结构化分析并确认。");

  const code =
    params.code?.trim() ||
    getLatestOutputValue<string>(taskDetail.outputs, "generated_code") ||
    "";
  if (!code) throw new Error("请先生成或粘贴 Python 代码。");

  const plan = parsedRequirementToTaskPlan(requirement);
  const run = await createTaskRun(supabase, {
    taskId,
    userId,
    runType: TASK_RUN_TYPE.GENERATE_CODE,
    modelName: process.env.MOONSHOT_MODEL || "kimi-k2.5",
    inputContext: {
      agent_stage: "debug_code",
      error_type: params.errorType ?? null,
    },
  });

  let debugResult: DebugResult;

  if (params.errorType === "environment_error") {
    debugResult = {
      fixed: false,
      fixedCode: "",
      reason: "当前环境不支持真实 Python 运行，无法通过报错自动修复。",
      changedPoints: [],
    };
  } else {
    try {
      const prompt = buildDebugPrompt({
        plan,
        code,
        stdout: params.stdout || "",
        stderr: params.stderr || "",
        errorType: params.errorType,
      });
      const result = await callMoonshotJson<DebugResult>({
        ...prompt,
        schema: debugResultSchema,
        maxTokens: 4096,
        timeoutMs: 120000,
        metadata: { taskId, stepName: "debug_code" },
      });
      debugResult = result.parsed;

      if (debugResult.fixed && containsDangerousPython(debugResult.fixedCode)) {
        debugResult = {
          fixed: false,
          fixedCode: "",
          reason: "修复后的代码仍包含潜在危险操作，系统已阻止使用。",
          changedPoints: [],
        };
      }
    } catch (error) {
      debugResult = {
        fixed: false,
        fixedCode: "",
        reason: toUserFriendlyErrorMessage(
          error,
          "代码自动修复失败，请查看错误信息或手动调整。",
        ),
        changedPoints: [],
      };
    }
  }

  await createTaskOutput(supabase, {
    taskRunId: run.id,
    taskId,
    userId,
    reportJson: {
      debug_result: debugResult as unknown as Record<string, unknown>,
      generated_code: debugResult.fixed ? debugResult.fixedCode : code,
    },
  });

  await updateTaskExecutionStatuses(supabase, taskId, {
    status: TASK_STATUS.CONFIRMED,
    currentStep: debugResult.fixed ? TASK_CURRENT_STEP.CODE_READY : TASK_CURRENT_STEP.CODE_RAN,
    generationStatus: debugResult.fixed
      ? TASK_EXECUTION_STATUS.SUCCESS
      : TASK_EXECUTION_STATUS.ERROR,
    lastError: debugResult.fixed ? null : debugResult.reason,
  });
  await finishTaskRun(supabase, run.id, {
    status: debugResult.fixed ? "success" : "error",
    errorMessage: debugResult.fixed ? null : debugResult.reason,
  });
  return debugResult;
}

async function buildAndSaveReportDraft(
  supabase: SupabaseClient,
  userId: string,
  taskId: string,
  options: {
    plan?: TaskPlan;
    generatedCode?: GeneratedCode;
    firstRun?: RunTaskResult | null;
    debugResult?: DebugResult | null;
    finalRun?: RunTaskResult | null;
  } = {},
) {
  const { context, taskDetail } = await buildTaskContext(supabase, userId, taskId);
  const requirement = context.parsedRequirement;
  if (!requirement) throw new Error("请先确认结构化分析结果。");

  const plan = options.plan ?? parsedRequirementToTaskPlan(requirement);
  const code =
    options.generatedCode?.code ||
    getLatestOutputValue<string>(taskDetail.outputs, "generated_code") ||
    "";
  const generatedCode =
    options.generatedCode ??
    generatedCodeSchema.parse({
      filename: "main.py",
      language: "Python",
      code: code || buildGenericPythonCode(plan),
      explanation: "根据当前任务输出记录整理的代码。",
      runCommand: "python main.py",
      expectedStdout: plan.expectedOutput,
    });
  const firstRun =
    options.firstRun ?? getLatestRunResult(taskDetail.outputs, "first_run") ?? getLatestRunResult(taskDetail.outputs, "run_result");
  const debugResult =
    options.debugResult ??
    getLatestOutputValue<DebugResult>(taskDetail.outputs, "debug_result");
  const finalRun =
    options.finalRun ??
    getLatestRunResult(taskDetail.outputs, "final_run") ??
    firstRun;

  let report = buildReportFallback({
    plan,
    requirement,
    generatedCode,
    firstRun: firstRun ?? undefined,
    debugResult: debugResult ?? undefined,
    finalRun: finalRun ?? undefined,
  });

  try {
    const prompt = buildReportPrompt({
      plan,
      parsedRequirement: requirement,
      generatedCode,
      firstRun: firstRun ?? undefined,
      debugResult: debugResult ?? undefined,
      finalRun: finalRun ?? undefined,
    });
    const aiReport = await callMoonshotJson({
      ...prompt,
      schema: reportResultSchema,
      maxTokens: 4096,
      timeoutMs: 120000,
      metadata: { taskId, stepName: "generate_report" },
    });
    report = {
      ...aiReport.parsed,
      code: generatedCode.code,
    };
  } catch {
    // Deterministic fallback above is safer than failing the workbench.
  }

  const stdout = finalRun?.stdout?.trim() || "";
  if (stdout && !report.result.includes(stdout)) {
    report.result = `本次最终运行得到以下真实 stdout：\n\n\`\`\`text\n${stdout}\n\`\`\``;
  }
  if (finalRun?.errorType === "environment_error") {
    report.limitations =
      "当前环境未完成真实运行验证，请复制代码到本地 Python 环境运行，或后续接入 Docker Runner Worker。";
  }

  const markdown = reportResultToMarkdown(report);
  const run = await createTaskRun(supabase, {
    taskId,
    userId,
    runType: TASK_RUN_TYPE.GENERATE_REPORT,
    modelName: "agent-report",
    inputContext: { sections: requirement.required_sections },
  });

  await createTaskOutput(supabase, {
    taskRunId: run.id,
    taskId,
    userId,
    reportJson: {
      report_draft: markdown,
      report_result: report as unknown as Record<string, unknown>,
      generated_code: generatedCode.code,
      stdout: finalRun?.stdout ?? "",
      stderr: finalRun?.stderr ?? "",
      first_run: firstRun ? (firstRun as unknown as Record<string, unknown>) : null,
      debug_result: debugResult ? (debugResult as unknown as Record<string, unknown>) : null,
      final_run: finalRun ? (finalRun as unknown as Record<string, unknown>) : null,
    },
    reportMarkdown: markdown,
  });
  await updateTaskExecutionStatuses(supabase, taskId, {
    status: TASK_STATUS.GENERATED,
    currentStep: TASK_CURRENT_STEP.REPORT_DRAFT_READY,
    generationStatus: TASK_EXECUTION_STATUS.SUCCESS,
    reportMarkdown: markdown,
    lastError: finalRun && !finalRun.success ? getRunMessage(finalRun) : null,
  });
  await finishTaskRun(supabase, run.id, { status: "success" });

  return { report, markdown };
}

export async function generateReportDraft(
  supabase: SupabaseClient,
  userId: string,
  taskId: string,
) {
  const { markdown } = await buildAndSaveReportDraft(supabase, userId, taskId);
  return markdown;
}

export async function saveReportDraft(
  supabase: SupabaseClient,
  userId: string,
  taskId: string,
  markdown: string,
) {
  const run = await createTaskRun(supabase, {
    taskId,
    userId,
    runType: TASK_RUN_TYPE.SAVE_REPORT,
    modelName: "user-edited",
  });

  await createTaskOutput(supabase, {
    taskRunId: run.id,
    taskId,
    userId,
    reportJson: { report_draft: markdown },
    reportMarkdown: markdown,
  });
  await updateTaskExecutionStatuses(supabase, taskId, {
    status: TASK_STATUS.GENERATED,
    currentStep: TASK_CURRENT_STEP.REPORT_DRAFT_READY,
    reportMarkdown: markdown,
    lastError: null,
  });
  await finishTaskRun(supabase, run.id, { status: "success" });
  return markdown;
}

export async function runAgentWorkflow(
  supabase: SupabaseClient,
  userId: string,
  taskId: string,
): Promise<AgentWorkflowResult> {
  const result: AgentWorkflowResult = {
    success: false,
    stage: "analyze",
  };

  try {
    let { context } = await buildTaskContext(supabase, userId, taskId);
    let requirement = context.parsedRequirement;

    if (!requirement) {
      requirement = await analyzeTask(supabase, userId, taskId);
      await confirmTaskAnalysis(supabase, userId, taskId, requirement);
      ({ context } = await buildTaskContext(supabase, userId, taskId));
    }

    const plan = parsedRequirementToTaskPlan(requirement);
    result.plan = plan;

    result.stage = "generate_code";
    const code = await generatePythonCode(supabase, userId, taskId);
    let generatedCode = generatedCodeSchema.parse({
      filename: "main.py",
      language: "Python",
      code,
      explanation: "Agent 工作流生成的 Python 代码。",
      runCommand: "python main.py",
      expectedStdout: plan.expectedOutput,
    });
    result.generatedCode = generatedCode;

    result.stage = "run_code";
    const firstRun = await runTaskPythonCode(supabase, userId, taskId, generatedCode.code);
    result.firstRun = firstRun;

    let debugResult: DebugResult | undefined;
    let finalRun = firstRun;

    if (!firstRun.success && firstRun.errorType !== "environment_error") {
      result.stage = "debug_code";
      debugResult = await debugTaskPythonCode(supabase, userId, taskId, {
        code: generatedCode.code,
        stdout: firstRun.stdout,
        stderr: firstRun.stderr,
        errorType: firstRun.errorType,
      });
      result.debugResult = debugResult;

      if (debugResult.fixed) {
        generatedCode = {
          ...generatedCode,
          code: normalizeGeneratedPythonCode(debugResult.fixedCode),
          explanation: `${generatedCode.explanation}\n自动修复说明：${debugResult.reason}`,
        };
        result.generatedCode = generatedCode;

        result.stage = "rerun_code";
        finalRun = await runTaskPythonCode(
          supabase,
          userId,
          taskId,
          generatedCode.code,
        );
      }
    }

    result.finalRun = finalRun;
    result.stage = "generate_report";
    const { report, markdown } = await buildAndSaveReportDraft(supabase, userId, taskId, {
      plan,
      generatedCode,
      firstRun,
      debugResult,
      finalRun,
    });

    result.report = report;
    result.reportMarkdown = markdown;
    result.stage = "completed";
    result.success =
      finalRun.success ||
      finalRun.errorType === "environment_error" ||
      Boolean(markdown && !debugResult);

    if (!result.success) {
      result.errorMessage =
        debugResult && !debugResult.fixed
          ? debugResult.reason
          : getRunMessage(finalRun);
    }

    return result;
  } catch (error) {
    const message = toUserFriendlyErrorMessage(error, "系统出现未知错误，请稍后重试。");
    result.errorMessage = message;
    await markFailure(supabase, taskId, message).catch(() => undefined);
    return result;
  }
}

export async function completeTaskFlow(
  supabase: SupabaseClient,
  userId: string,
  taskId: string,
  confirmationNotes?: string,
) {
  void confirmationNotes;
  const result = await runAgentWorkflow(supabase, userId, taskId);
  if (result.reportMarkdown) return result.reportMarkdown;
  throw new Error(result.errorMessage || "生成完整报告失败，请稍后重试。");
}

export async function generateTaskOutline(
  supabase?: SupabaseClient,
  userId?: string,
  taskId?: string,
  confirmationNotes?: string,
) {
  void supabase;
  void userId;
  void taskId;
  void confirmationNotes;
  throw new Error("P1 工作台已改为 Agent 执行流，不再单独生成大纲。");
}

export async function generateTaskReport(
  supabase: SupabaseClient,
  userId: string,
  taskId: string,
) {
  return generateReportDraft(supabase, userId, taskId);
}

export async function runTaskConsistencyCheck(
  supabase?: SupabaseClient,
  userId?: string,
  taskId?: string,
) {
  void supabase;
  void userId;
  void taskId;
  throw new Error("P1 工作台暂不执行一致性检查，请由用户在导出前编辑确认。");
}
