import type {
  DebugResult,
  GeneratedCode,
  RunResult,
  TaskPlan,
} from "@/lib/agent/types";
import type { ParsedRequirement } from "@/lib/ai/types";

function strictJsonRules() {
  return [
    "输出必须是严格 JSON。",
    "不要输出 markdown。",
    "不要输出代码块围栏。",
    "不要在 JSON 前后添加解释、寒暄或废话。",
    "产品定位是学习辅助、代码验证、实验报告整理、任务流程自动化。",
    "不得出现代写作业、作弊、包过等表述。",
    "不得伪造运行结果。",
  ].join("\n");
}

function joinUploadedMaterials(...values: Array<string | undefined>) {
  const joined = values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .join("\n\n");

  return joined || "无";
}

export function buildPlanPrompt(input: {
  title: string;
  requirementText: string;
  taskBookText?: string;
  notes?: string;
  fileSummary?: string;
}) {
  return {
    systemPrompt: [
      "你是实验报告自动化助手的任务规划器，只服务学生实验任务。",
      strictJsonRules(),
      "优先识别 Python 实验；无法判断时 taskType 使用 unknown。",
      "如果信息很少，也要给出最小可执行分析结构。",
      "fallback 不允许编造具体运行结果。",
      "JSON 字段必须包含 title, taskType, language, steps, needRunCode, expectedOutput, reportOutline, assumptions, missingInfo, riskNotes。",
    ].join("\n"),
    userPrompt: [
      `任务标题：${input.title || "未命名实验任务"}`,
      "",
      "用户原始任务要求：",
      input.requirementText || "未提供明确文字要求。",
      "",
      "上传材料摘要：",
      joinUploadedMaterials(input.taskBookText, input.fileSummary),
      "",
      "用户补充说明：",
      input.notes || "无",
      "",
      "请输出 JSON：",
      JSON.stringify(
        {
          title: "实验标题",
          taskType: "python_lab",
          language: "Python",
          steps: ["理解实验要求", "设计算法或处理流程", "生成代码", "运行验证", "整理报告"],
          needRunCode: true,
          expectedOutput: "程序应输出可引用到报告中的 stdout 结果",
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
          ],
          assumptions: ["使用内置示例数据"],
          missingInfo: [],
          riskNotes: [],
        },
        null,
        2,
      ),
    ].join("\n"),
  };
}

export function buildCodePrompt(input: {
  plan: TaskPlan;
  parsedRequirement: ParsedRequirement;
  requirementText: string;
  taskBookText?: string;
  fileSummary?: string;
}) {
  return {
    systemPrompt: [
      "你是实验报告自动化助手的 Python 代码生成器。",
      strictJsonRules(),
      "当前 P1 版本只生成 Python 单文件 main.py。",
      "Python 代码必须能直接运行。",
      "默认不要使用 input()，必须使用内置示例数据。",
      "如果上传材料包含 CSV 等数据集文件，必须优先使用提供的真实文件名读取当前工作目录中的数据集。",
      "处理 CSV 时优先使用 Python 标准库 csv，不要编造 CSV 内容。",
      "默认不要依赖 pandas、numpy、matplotlib、requests 等第三方库，除非任务明确要求。",
      "不要输出 markdown 代码块符号。",
      "代码必须包含 if __name__ == \"__main__\": 入口。",
      "代码必须有清晰 print 输出，便于报告引用真实 stdout。",
      "代码要短小、清晰、适合学生实验报告展示。",
      "JSON 字段必须包含 filename, language, code, explanation, runCommand, expectedStdout。",
    ].join("\n"),
    userPrompt: [
      "任务计划 JSON：",
      JSON.stringify(input.plan, null, 2),
      "",
      "结构化分析 JSON：",
      JSON.stringify(input.parsedRequirement, null, 2),
      "",
      "原始任务要求：",
      input.requirementText || "无",
      "",
      "上传材料摘要：",
      joinUploadedMaterials(input.taskBookText, input.fileSummary),
      "",
      "请只输出 JSON，code 字段内放完整 Python 代码。",
    ].join("\n"),
  };
}

export function buildDebugPrompt(input: {
  plan: TaskPlan;
  code: string;
  stdout: string;
  stderr: string;
  errorType?: string;
}) {
  return {
    systemPrompt: [
      "你是实验报告自动化助手的 Python 单次调试器。",
      strictJsonRules(),
      "只允许自动修复一次。",
      "返回完整修复后的代码，不要返回 diff。",
      "保留原任务目标。",
      "修复后的代码仍必须是单文件 main.py、无 input()、默认无第三方依赖、有 main 入口、有示例数据、有 print 输出。",
      "如果无法修复，fixed 必须为 false，fixedCode 为空字符串，并给出中文 reason。",
      "JSON 字段必须包含 fixed, fixedCode, reason, changedPoints。",
    ].join("\n"),
    userPrompt: [
      "任务计划 JSON：",
      JSON.stringify(input.plan, null, 2),
      "",
      "当前代码：",
      input.code,
      "",
      `错误类型：${input.errorType || "runtime_error"}`,
      "stdout：",
      input.stdout || "无",
      "",
      "stderr：",
      input.stderr || "无",
      "",
      "请输出 DebugResult JSON。",
    ].join("\n"),
  };
}

export function buildReportPrompt(input: {
  plan: TaskPlan;
  parsedRequirement: ParsedRequirement;
  generatedCode: GeneratedCode;
  fileSummary?: string;
  screenshotEvidenceSummary?: string;
  firstRun?: RunResult;
  debugResult?: DebugResult;
  finalRun?: RunResult;
}) {
  return {
    systemPrompt: [
      "你是实验报告自动化助手的报告整理器。",
      strictJsonRules(),
      "报告语言必须为中文。",
      "报告标题、章节名、截图说明、运行说明和结果分析都必须默认使用中文，除非用户原任务明确要求英文。",
      "导出到 DOCX 的填写标签必须使用中文，且不要包含“系统填写”四个字：【代码】、【运行结果】、【运行截图】、【结果分析】、【问题及思考】、【截图缺失】。",
      "报告定位为学习辅助、代码验证和实验记录整理。",
      "报告必须基于用户要求、结构化分析、生成代码和最终运行结果。",
      "如果 stdout 存在，运行结果部分必须引用真实 stdout。",
      "如果任务上下文包含数据集文件，报告必须写明实际使用的数据集文件名和可见字段，不要编造数据值。",
      "如果 stderr 存在但修复成功，可以在结果分析中说明初次运行有错误，系统已修复并重新运行。",
      "如果最终运行失败，必须说明失败原因，不要假装成功。",
      "如果环境不支持运行，必须说明当前环境未完成真实运行验证。",
      "不得伪造 stdout，不得编造不存在的运行结果。",
      "JSON 字段必须包含 title, purpose, environment, principle, steps, code, result, analysis, summary, limitations。",
    ].join("\n"),
    userPrompt: [
      "任务计划 JSON：",
      JSON.stringify(input.plan, null, 2),
      "",
      "结构化分析 JSON：",
      JSON.stringify(input.parsedRequirement, null, 2),
      "",
      "生成代码 JSON：",
      JSON.stringify(input.generatedCode, null, 2),
      "",
      "Screenshot evidence summary:",
      input.screenshotEvidenceSummary || "none",
      "",
      "上传材料摘要：",
      input.fileSummary || "无",
      "",
      "首次运行结果 JSON：",
      JSON.stringify(input.firstRun ?? null, null, 2),
      "",
      "调试结果 JSON：",
      JSON.stringify(input.debugResult ?? null, null, 2),
      "",
      "最终运行结果 JSON：",
      JSON.stringify(input.finalRun ?? null, null, 2),
      "",
      "请输出 ReportResult JSON。",
    ].join("\n"),
  };
}
