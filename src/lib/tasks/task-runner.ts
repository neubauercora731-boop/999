import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import type { SupabaseClient } from "@supabase/supabase-js";

import { callMoonshotJson, callMoonshotText } from "@/lib/ai/moonshot";
import { requirementParserPrompt } from "@/lib/ai/prompts";
import type { ParsedRequirement } from "@/lib/ai/types";
import { parsedRequirementSchema } from "@/lib/validators/parsed-requirement";
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
import { toErrorMessage } from "@/lib/utils";

const PYTHON_TIMEOUT_MS = 10_000;
const MAX_STDIO = 20_000;

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

function fallbackCode(requirement: ParsedRequirement) {
  const title = requirement.experiment_title.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return [
    "# P0 generated starter code",
    "# Edit this code before using it in a final report.",
    `experiment_title = "${title}"`,
    "print('实验名称:', experiment_title)",
    "print('已读取结构化任务，下面输出任务列表：')",
    "tasks = [",
    ...requirement.coding_tasks.map(
      (task) =>
        `    ${JSON.stringify({
          task_name: task.task_name,
          description: task.description,
          expected_output: task.expected_output,
        })},`,
    ),
    "]",
    "for index, task in enumerate(tasks, start=1):",
    "    print(f\"{index}. {task['task_name']} - {task['description']}\")",
  ].join("\n");
}

function containsDangerousPython(code: string) {
  const patterns = [
    /\bimport\s+os\b/,
    /\bimport\s+shutil\b/,
    /\bimport\s+subprocess\b/,
    /\bfrom\s+os\s+import\b/,
    /\bfrom\s+shutil\s+import\b/,
    /\bfrom\s+subprocess\s+import\b/,
    /\beval\s*\(/,
    /\bexec\s*\(/,
    /\bopen\s*\(\s*["'][a-zA-Z]:\\/,
    /rmdir\s*\(/,
    /remove\s*\(/,
    /unlink\s*\(/,
    /rmtree\s*\(/,
    /while\s+True\s*:/,
  ];

  return patterns.some((pattern) => pattern.test(code));
}

function runPython(code: string) {
  return new Promise<{ stdout: string; stderr: string; exitCode: number | null; timedOut: boolean }>(
    async (resolve, reject) => {
      const dir = await mkdtemp(path.join(tmpdir(), "lab-report-run-"));
      const file = path.join(dir, "main.py");
      await writeFile(file, code, "utf8");

      const child = spawn(process.platform === "win32" ? "python" : "python3", [file], {
        cwd: dir,
        env: {
          ...process.env,
          PATH: process.env.PATH ?? "",
          PYTHONIOENCODING: "utf-8",
          PYTHONUTF8: "1",
        },
        windowsHide: true,
      });

      let stdout = "";
      let stderr = "";
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGKILL");
      }, PYTHON_TIMEOUT_MS);

      child.stdout.on("data", (chunk) => {
        stdout = (stdout + chunk.toString("utf8")).slice(-MAX_STDIO);
      });
      child.stderr.on("data", (chunk) => {
        stderr = (stderr + chunk.toString("utf8")).slice(-MAX_STDIO);
      });
      child.on("error", async (error) => {
        clearTimeout(timer);
        await rm(dir, { recursive: true, force: true });
        const message =
          (error as NodeJS.ErrnoException).code === "ENOENT"
            ? "当前线上环境暂不支持 Python 运行，请复制代码到本地运行，或在本地开发环境中测试。"
            : error.message;
        reject(new Error(message));
      });
      child.on("close", async (exitCode) => {
        clearTimeout(timer);
        await rm(dir, { recursive: true, force: true });
        resolve({ stdout, stderr, exitCode, timedOut });
      });
    },
  );
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
    inputContext: { file_count: taskDetail.files.length },
  });

  try {
    const prompt = requirementParserPrompt(context);
    const result = await callMoonshotJson<ParsedRequirement>({
      ...prompt,
      schema: parsedRequirementSchema,
      maxTokens: 4096,
      timeoutMs: 120000,
      metadata: { taskId, stepName: "analyze" },
    });
    const analysis = result.parsed;

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
      parsedRequirementJson: analysis as Record<string, unknown>,
      missingFieldsJson: analysis.missing_info,
      reportJson: { parsed_text: mergedParsedText(taskDetail.files) },
    });

    await updateTaskExecutionStatuses(supabase, taskId, {
      status: TASK_STATUS.ANALYZED,
      currentStep: TASK_CURRENT_STEP.ANALYSIS_READY,
      analysisStatus: TASK_EXECUTION_STATUS.SUCCESS,
      parsedRequirementJson: analysis,
      experimentName: analysis.experiment_title,
      courseName: analysis.course_name,
      description: `已解析 ${analysis.coding_tasks.length} 个 Python 任务，待用户确认。`,
      missingFields: analysis.missing_info,
      lastError: null,
    });
    await finishTaskRun(supabase, run.id, { status: "success" });
    return analysis;
  } catch (error) {
    const message = toErrorMessage(error);
    await finishTaskRun(supabase, run.id, { status: "error", errorMessage: message });
    await updateTaskExecutionStatuses(supabase, taskId, {
      status: TASK_STATUS.FAILED,
      currentStep: TASK_CURRENT_STEP.FAILED,
      analysisStatus: TASK_EXECUTION_STATUS.ERROR,
      lastError: message,
    });
    throw error;
  }
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
  if (!requirement) throw new Error("请先完成结构化解析并确认。");

  const run = await createTaskRun(supabase, {
    taskId,
    userId,
    runType: TASK_RUN_TYPE.GENERATE_CODE,
    modelName: process.env.MOONSHOT_MODEL || "kimi-k2.5",
    inputContext: { requirement },
  });

  try {
    const result = await callMoonshotText({
      systemPrompt: [
        "Generate safe Python code for a lab-report learning workbench.",
        "Return code only. No markdown fences.",
        "Do not delete files, access system-sensitive paths, run shell commands, or use network.",
        "Keep runtime under 10 seconds.",
        "The code should print clear stdout evidence for the report.",
      ].join("\n"),
      userPrompt: [
        "Structured requirement JSON:",
        JSON.stringify(requirement, null, 2),
        "",
        "Uploaded text context:",
        context.taskBookText || context.requirementText || "none",
      ].join("\n"),
      maxTokens: 4096,
      timeoutMs: 120000,
      metadata: { taskId, stepName: "generate_code" },
    });

    const code = result.content.replace(/^```(?:python)?/i, "").replace(/```$/g, "").trim() || fallbackCode(requirement);
    await createTaskOutput(supabase, {
      taskRunId: run.id,
      taskId,
      userId,
      reportJson: { generated_code: code },
    });
    await updateTaskExecutionStatuses(supabase, taskId, {
      status: TASK_STATUS.CONFIRMED,
      currentStep: TASK_CURRENT_STEP.CODE_READY,
      generationStatus: TASK_EXECUTION_STATUS.SUCCESS,
      lastError: null,
    });
    await finishTaskRun(supabase, run.id, { status: "success" });
    return code;
  } catch (error) {
    const code = fallbackCode(requirement);
    await createTaskOutput(supabase, {
      taskRunId: run.id,
      taskId,
      userId,
      reportJson: {
        generated_code: code,
        warning: `AI 代码生成失败，已生成可运行起始代码：${toErrorMessage(error)}`,
      },
    });
    await updateTaskExecutionStatuses(supabase, taskId, {
      status: TASK_STATUS.CONFIRMED,
      currentStep: TASK_CURRENT_STEP.CODE_READY,
      generationStatus: TASK_EXECUTION_STATUS.SUCCESS,
      lastError: `AI 代码生成失败，已使用安全起始代码：${toErrorMessage(error)}`,
    });
    await finishTaskRun(supabase, run.id, { status: "success" });
    return code;
  }
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
  if (containsDangerousPython(resolvedCode)) {
    throw new Error("代码包含被 P0 安全策略限制的危险操作，请修改后再运行。");
  }

  const run = await createTaskRun(supabase, {
    taskId,
    userId,
    runType: TASK_RUN_TYPE.RUN_CODE,
    modelName: "local-python",
    inputContext: { timeout_ms: PYTHON_TIMEOUT_MS },
  });

  try {
    const output = await runPython(resolvedCode);
    await createTaskOutput(supabase, {
      taskRunId: run.id,
      taskId,
      userId,
      reportJson: {
        generated_code: resolvedCode,
        stdout: output.stdout,
        stderr: output.stderr,
        exit_code: output.exitCode,
        timed_out: output.timedOut,
      },
    });
    await updateTaskExecutionStatuses(supabase, taskId, {
      status: TASK_STATUS.CONFIRMED,
      currentStep: TASK_CURRENT_STEP.CODE_RAN,
      lastError: output.exitCode === 0 && !output.timedOut ? null : output.stderr || "Python 运行失败。",
    });
    await finishTaskRun(supabase, run.id, {
      status: output.exitCode === 0 && !output.timedOut ? "success" : "error",
      errorMessage: output.exitCode === 0 && !output.timedOut ? null : output.stderr || "Python 运行失败。",
    });
    return output;
  } catch (error) {
    const message = toErrorMessage(error);
    await finishTaskRun(supabase, run.id, { status: "error", errorMessage: message });
    await markFailure(supabase, taskId, message);
    throw error;
  }
}

export async function generateReportDraft(
  supabase: SupabaseClient,
  userId: string,
  taskId: string,
) {
  const { context, taskDetail } = await buildTaskContext(supabase, userId, taskId);
  const requirement = context.parsedRequirement;
  if (!requirement) throw new Error("请先确认结构化解析结果。");

  const code = getLatestOutputValue<string>(taskDetail.outputs, "generated_code") || "";
  const stdout = getLatestOutputValue<string>(taskDetail.outputs, "stdout") || "";
  const stderr = getLatestOutputValue<string>(taskDetail.outputs, "stderr") || "";

  const markdown = [
    `# ${requirement.experiment_title}`,
    "",
    "## 实验名称",
    requirement.experiment_title,
    "",
    "## 实验目的",
    requirement.purpose,
    "",
    "## 实验环境",
    "- Python 3.x",
    "- 实验报告自动化助手任务工作台",
    "- 运行结果以本地 Python 子进程 stdout/stderr 为证据",
    "",
    "## 实验步骤",
    ...requirement.coding_tasks.map((task, index) => `${index + 1}. ${task.task_name}: ${task.description}`),
    "",
    "## 代码实现",
    "```python",
    code || "# 尚未生成代码",
    "```",
    "",
    "## 运行结果",
    "stdout:",
    "```text",
    stdout || "尚未运行代码或没有标准输出。",
    "```",
    "stderr:",
    "```text",
    stderr || "无错误输出。",
    "```",
    "",
    "## 结果分析",
    stdout
      ? "程序已完成运行，输出内容可作为实验结果证据。请根据课程要求补充截图或对关键结果进行解释。"
      : "当前尚缺少真实运行输出，建议先运行 Python 代码再完善本节。",
    "",
    "## 实验总结",
    "本次实验通过任务解析、代码生成、受限运行和报告草稿生成完成了 Python 实验报告的 P0 闭环。最终报告仍需由用户核对、修改并确认后再导出 DOCX。",
  ].join("\n");

  const run = await createTaskRun(supabase, {
    taskId,
    userId,
    runType: TASK_RUN_TYPE.GENERATE_REPORT,
    modelName: "deterministic-draft",
    inputContext: { sections: requirement.required_sections },
  });

  await createTaskOutput(supabase, {
    taskRunId: run.id,
    taskId,
    userId,
    reportJson: { report_draft: markdown, generated_code: code, stdout, stderr },
    reportMarkdown: markdown,
  });
  await updateTaskExecutionStatuses(supabase, taskId, {
    status: TASK_STATUS.GENERATED,
    currentStep: TASK_CURRENT_STEP.REPORT_DRAFT_READY,
    generationStatus: TASK_EXECUTION_STATUS.SUCCESS,
    reportMarkdown: markdown,
    lastError: null,
  });
  await finishTaskRun(supabase, run.id, { status: "success" });
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

export async function completeTaskFlow(
  supabase: SupabaseClient,
  userId: string,
  taskId: string,
  confirmationNotes?: string,
) {
  void confirmationNotes;
  const { context } = await buildTaskContext(supabase, userId, taskId);
  if (!context.parsedRequirement) {
    const analysis = await analyzeTask(supabase, userId, taskId);
    await confirmTaskAnalysis(supabase, userId, taskId, analysis);
  }
  const code = await generatePythonCode(supabase, userId, taskId);
  await runTaskPythonCode(supabase, userId, taskId, code);
  return generateReportDraft(supabase, userId, taskId);
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
  throw new Error("P0 工作台已改为生成 Python 代码，不再使用大纲步骤。");
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
  throw new Error("P0 工作台暂不执行一致性检查，请由用户在导出前编辑确认。");
}
