import type {
  DebugResult,
  GeneratedCode,
  ReportResult,
  RunResult,
  TaskPlan,
} from "@/lib/agent/types";
import type { ParsedRequirement } from "@/lib/ai/types";
import { parsedRequirementSchema } from "@/lib/validators/parsed-requirement";

export function parsedRequirementToTaskPlan(
  requirement: ParsedRequirement,
): TaskPlan {
  return {
    title: requirement.experiment_title,
    taskType: requirement.task_type || "python_lab",
    language: requirement.language || requirement.coding_tasks[0]?.language || "Python",
    steps:
      requirement.coding_tasks.length > 0
        ? requirement.coding_tasks.map((task) => `${task.task_name}: ${task.description}`)
        : ["理解实验要求", "生成代码", "运行验证", "整理报告"],
    needRunCode: (requirement.language || "Python").toLowerCase().includes("python"),
    expectedOutput:
      requirement.expected_output ||
      requirement.coding_tasks[0]?.expected_output ||
      "程序输出可引用到实验报告中的 stdout 结果。",
    reportOutline:
      requirement.report_outline?.length > 0
        ? requirement.report_outline
        : requirement.required_sections,
    assumptions:
      requirement.assumptions?.length > 0
        ? requirement.assumptions
        : ["使用内置示例数据"],
    missingInfo: requirement.missing_info,
    riskNotes: requirement.risk_notes,
  };
}

export function taskPlanToParsedRequirement(
  plan: TaskPlan,
  options: {
    courseName?: string | null;
    purpose?: string;
  } = {},
) {
  return parsedRequirementSchema.parse({
    experiment_title: plan.title,
    course_name: options.courseName || "未识别课程",
    purpose:
      options.purpose ||
      `根据“${plan.title}”的实验要求完成任务拆解、代码验证和报告整理。`,
    required_sections: plan.reportOutline,
    coding_tasks: [
      {
        task_name: plan.title,
        language: plan.language || "Python",
        description: plan.steps.join("；"),
        needs_screenshot: false,
        expected_output: plan.expectedOutput,
      },
    ],
    materials_needed: ["原始实验要求", "生成代码", "运行输出"],
    missing_info: plan.missingInfo,
    risk_notes: plan.riskNotes,
    task_type: plan.taskType,
    language: plan.language,
    expected_output: plan.expectedOutput,
    report_outline: plan.reportOutline,
    assumptions: plan.assumptions,
  });
}

export function isPythonPlan(plan: TaskPlan | ParsedRequirement) {
  const language =
    "language" in plan && typeof plan.language === "string"
      ? plan.language
      : "Python";
  const taskType =
    "taskType" in plan && typeof plan.taskType === "string"
      ? plan.taskType
      : "task_type" in plan && typeof plan.task_type === "string"
        ? plan.task_type
        : "python_lab";

  return (
    language.toLowerCase().includes("python") ||
    taskType === "python_lab"
  );
}

export function reportResultToMarkdown(report: ReportResult) {
  const sections = [
    ["实验名称", report.title],
    ["实验目的", report.purpose],
    ["实验环境", report.environment],
    ["实验原理", report.principle],
    ["实验步骤", report.steps],
    ["程序代码", `\`\`\`python\n${report.code || "# 暂无代码"}\n\`\`\``],
    ["运行结果", report.result],
    ["结果分析", report.analysis],
    ["实验总结", report.summary],
  ];

  if (report.limitations?.trim()) {
    sections.push(["当前限制说明", report.limitations.trim()]);
  }

  return [
    `# ${report.title}`,
    "",
    ...sections.flatMap(([title, content]) => [
      `## ${title}`,
      content || "暂无内容。",
      "",
    ]),
  ].join("\n").trim();
}

export function buildReportFallback(input: {
  plan: TaskPlan;
  requirement: ParsedRequirement;
  generatedCode: GeneratedCode;
  firstRun?: RunResult;
  debugResult?: DebugResult;
  finalRun?: RunResult;
}): ReportResult {
  const finalRun = input.finalRun ?? input.firstRun;
  const stdout = finalRun?.stdout?.trim() || "";
  const stderr = finalRun?.stderr?.trim() || "";
  const debugText = input.debugResult?.fixed
    ? "初次运行存在错误，系统已根据错误信息自动修复并重新运行。"
    : input.debugResult
      ? `系统尝试自动修复，但未完成修复：${input.debugResult.reason}`
      : "";
  const environmentUnsupported = finalRun?.errorType === "environment_error";
  const failed = finalRun && !finalRun.success && !environmentUnsupported;

  return {
    title: input.requirement.experiment_title || input.plan.title,
    purpose: input.requirement.purpose,
    environment: environmentUnsupported
      ? "Python 3.x；当前线上环境未完成真实运行验证。"
      : "Python 3.x；实验报告自动化助手任务工作台。",
    principle:
      "根据实验任务要求设计可运行的 Python 程序，使用内置示例数据完成处理流程，并通过 stdout 记录运行结果。",
    steps:
      input.plan.steps.length > 0
        ? input.plan.steps.map((step, index) => `${index + 1}. ${step}`).join("\n")
        : "1. 理解实验要求\n2. 编写 Python 程序\n3. 运行验证\n4. 整理实验报告",
    code: input.generatedCode.code,
    result: stdout
      ? `本次最终运行得到以下真实 stdout：\n\n\`\`\`text\n${stdout}\n\`\`\``
      : stderr
        ? `本次最终运行未成功，错误信息如下：\n\n\`\`\`text\n${stderr}\n\`\`\``
        : "当前没有可引用的真实 stdout。",
    analysis: [
      stdout
        ? "程序已输出可用于实验报告的结果，说明核心流程可以被验证。"
        : "当前缺少成功运行输出，需要结合错误信息或本地运行结果继续完善。",
      debugText,
      failed ? "最终运行仍未成功，报告中不能将该结果描述为已验证成功。" : "",
    ]
      .filter(Boolean)
      .join("\n"),
    summary:
      "本次实验完成了任务理解、代码生成、运行验证和报告草稿整理的流程。报告内容仍建议由用户结合课程要求进行最终核对。",
    limitations: environmentUnsupported
      ? "当前环境未完成真实运行验证，请复制代码到本地 Python 环境运行，或后续接入 Docker Runner Worker。"
      : failed
        ? "最终运行失败，报告仅能作为未验证草稿使用。"
        : "",
  };
}
