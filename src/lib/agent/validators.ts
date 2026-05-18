import { z, type ZodType } from "zod";

import { AGENT_ERROR_CODE, AgentWorkflowError } from "@/lib/agent/errors";
import type {
  DebugResult,
  GeneratedCode,
  ReportResult,
  RunResult,
  TaskPlan,
} from "@/lib/agent/types";

const nonEmptyStringArray = z
  .array(z.string().trim())
  .default([])
  .transform((items) => items.filter(Boolean));

export const taskPlanSchema = z
  .object({
    title: z.string().trim().default("Python 实验报告"),
    taskType: z.string().trim().default("python_lab"),
    language: z.string().trim().default("Python"),
    steps: nonEmptyStringArray,
    needRunCode: z.boolean().default(true),
    expectedOutput: z
      .string()
      .trim()
      .default("程序输出可引用到实验报告中的 stdout 结果。"),
    reportOutline: nonEmptyStringArray,
    assumptions: nonEmptyStringArray,
    missingInfo: nonEmptyStringArray,
    riskNotes: nonEmptyStringArray,
  })
  .transform((value): TaskPlan => ({
    title: value.title || "Python 实验报告",
    taskType: value.taskType || "python_lab",
    language: value.language || "Python",
    steps:
      value.steps.length > 0
        ? value.steps
        : ["理解实验要求", "设计算法或处理流程", "生成代码", "运行验证", "整理报告"],
    needRunCode: value.needRunCode,
    expectedOutput:
      value.expectedOutput || "程序输出可引用到实验报告中的 stdout 结果。",
    reportOutline:
      value.reportOutline.length > 0
        ? value.reportOutline
        : [
            "实验名称",
            "实验目的",
            "实验环境",
            "实验原理",
            "实验步骤",
            "程序代码",
            "运行结果",
            "结果分析",
            "实验总结",
          ],
    assumptions:
      value.assumptions.length > 0 ? value.assumptions : ["使用内置示例数据"],
    missingInfo: value.missingInfo,
    riskNotes: value.riskNotes,
  }));

export const generatedCodeSchema = z
  .object({
    filename: z.string().trim().default("main.py"),
    language: z.string().trim().default("Python"),
    code: z.string().trim().min(1),
    explanation: z.string().trim().default("生成了可运行的 Python 实验代码。"),
    runCommand: z.string().trim().default("python main.py"),
    expectedStdout: z.string().trim().default("运行后会输出实验结果。"),
  })
  .transform((value): GeneratedCode => ({
    ...value,
    filename: "main.py",
    language: "Python",
    runCommand: "python main.py",
    code: normalizeGeneratedPythonCode(value.code),
  }));

export const runResultSchema = z.object({
  success: z.boolean(),
  stdout: z.string().default(""),
  stderr: z.string().default(""),
  runtimeMs: z.number().nonnegative().default(0),
  errorType: z
    .enum(["runtime_error", "timeout", "environment_error", "security_blocked"])
    .optional(),
}) satisfies ZodType<RunResult>;

export const debugResultSchema = z
  .object({
    fixed: z.boolean().default(false),
    fixedCode: z.string().default(""),
    reason: z.string().trim().default("未返回修复原因。"),
    changedPoints: nonEmptyStringArray,
  })
  .transform((value): DebugResult => ({
    fixed: value.fixed && Boolean(value.fixedCode.trim()),
    fixedCode: value.fixed ? normalizeGeneratedPythonCode(value.fixedCode) : "",
    reason: value.reason,
    changedPoints: value.changedPoints,
  }));

export const reportResultSchema = z.object({
  title: z.string().trim().default("实验报告"),
  purpose: z.string().trim().default("根据实验要求完成代码验证和报告整理。"),
  environment: z.string().trim().default("Python 3.x"),
  principle: z.string().trim().default("根据实验任务选择合适的数据结构或算法流程。"),
  steps: z.string().trim().default("理解需求，编写代码，运行验证，整理报告。"),
  code: z.string().default(""),
  result: z.string().trim().default("暂无真实运行结果。"),
  analysis: z.string().trim().default("需要结合真实运行结果继续完善分析。"),
  summary: z.string().trim().default("本次实验完成了基础流程验证。"),
  limitations: z.string().trim().optional().default(""),
}) satisfies ZodType<ReportResult>;

export function stripMarkdownFences(value: string) {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:json|python|text)?\s*([\s\S]*?)\s*```$/i);

  if (fenced) {
    return fenced[1].trim();
  }

  return trimmed
    .replace(/^```(?:json|python|text)?/i, "")
    .replace(/```$/i, "")
    .trim();
}

export function extractJsonFromText(value: string) {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const text = stripMarkdownFences(fenced?.[1] ?? value);

  try {
    JSON.parse(text);
    return text;
  } catch {
    // Continue to object extraction below.
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1).trim();
  }

  throw new AgentWorkflowError(AGENT_ERROR_CODE.JSON_PARSE_FAILED);
}

export function parseJsonWithSchema<T>(value: string, schema: ZodType<T>) {
  try {
    return schema.parse(JSON.parse(extractJsonFromText(value)));
  } catch (error) {
    if (error instanceof AgentWorkflowError) {
      throw error;
    }

    throw new AgentWorkflowError(AGENT_ERROR_CODE.JSON_PARSE_FAILED, undefined, {
      details: error,
    });
  }
}

export function sanitizeGeneratedPythonCode(value: string) {
  const fenced = value.match(/```(?:python)?\s*([\s\S]*?)```/i);
  const code = stripMarkdownFences(fenced?.[1] ?? value);

  return code
    .replace(/^\s*#?\s*main\.py\s*$/im, "")
    .trim();
}

function indentPython(code: string) {
  return code
    .split("\n")
    .map((line) => (line.trim() ? `    ${line}` : ""))
    .join("\n");
}

export function normalizeGeneratedPythonCode(value: string) {
  const code = sanitizeGeneratedPythonCode(value);

  if (/if\s+__name__\s*==\s*["']__main__["']\s*:/.test(code)) {
    return code;
  }

  if (/def\s+main\s*\(/.test(code)) {
    return `${code.trim()}\n\nif __name__ == "__main__":\n    main()`;
  }

  return `def main():\n${indentPython(code)}\n\nif __name__ == "__main__":\n    main()`;
}

export function getFallbackTaskPlan(input: {
  title?: string;
  requirementText?: string;
}) {
  const source = `${input.title ?? ""}\n${input.requirementText ?? ""}`.toLowerCase();
  const isWeb = /web|html|css|javascript|react|前端/.test(source);
  const isDatabase = /sql|数据库|mysql|postgres|表/.test(source);
  const isPython = /python|冒泡|排序|成绩|算法|数据结构|统计/.test(source);

  return taskPlanSchema.parse({
    title: input.title?.trim() || (isPython ? "Python 实验报告" : "实验报告"),
    taskType: isPython ? "python_lab" : isWeb ? "web_lab" : isDatabase ? "database_lab" : "unknown",
    language: isPython ? "Python" : isWeb ? "Web" : isDatabase ? "SQL" : "Unknown",
    steps: ["理解实验要求", "拆解实验步骤", "生成实验代码", "运行验证结果", "整理实验报告"],
    needRunCode: isPython,
    expectedOutput: isPython
      ? "Python 程序输出清晰 stdout，作为实验报告运行结果。"
      : "当前版本暂不运行非 Python 任务。",
    reportOutline: [
      "实验名称",
      "实验目的",
      "实验环境",
      "实验原理",
      "实验步骤",
      "程序代码",
      "运行结果",
      "结果分析",
      "实验总结",
      "当前限制说明",
    ],
    assumptions: ["使用内置示例数据", "报告作为学习记录草稿，需要用户最终核对"],
    missingInfo: input.requirementText?.trim() ? [] : ["缺少明确实验任务要求"],
    riskNotes: ["AI 生成内容需要用户复核，不会自动提交到学校系统"],
  });
}
