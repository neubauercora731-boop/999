import { z } from "zod";

export const codingTaskSchema = z.object({
  task_name: z.string().trim().default("Python 实验任务"),
  language: z.string().trim().default("Python"),
  description: z.string().trim().default("根据任务要求完成 Python 实验。"),
  needs_screenshot: z.boolean().default(true),
  expected_output: z
    .string()
    .trim()
    .default("运行代码并保存 stdout/stderr 作为证据。"),
});

const defaultReportSections = [
  "实验名称",
  "实验目的",
  "实验环境",
  "实验原理",
  "实验步骤",
  "程序代码",
  "运行结果",
  "结果分析",
  "实验总结",
];

export const parsedRequirementSchema = z
  .object({
    experiment_title: z.string().trim().default("未命名 Python 实验"),
    course_name: z.string().trim().default("未识别课程"),
    purpose: z
      .string()
      .trim()
      .default("根据任务要求完成 Python 实验并形成报告草稿。"),
    required_sections: z.array(z.string().trim()).default([]),
    coding_tasks: z.array(codingTaskSchema).default([]),
    materials_needed: z.array(z.string().trim()).default([]),
    missing_info: z.array(z.string().trim()).default([]),
    risk_notes: z.array(z.string().trim()).default([]),
    task_type: z.string().trim().default("python_lab"),
    language: z.string().trim().default("Python"),
    expected_output: z
      .string()
      .trim()
      .default("运行代码并保存 stdout/stderr 作为证据。"),
    report_outline: z.array(z.string().trim()).default([]),
    assumptions: z.array(z.string().trim()).default([]),
  })
  .transform((value) => {
    const codingTasks =
      value.coding_tasks.length > 0
        ? value.coding_tasks
        : [
            {
              task_name: "Python 实验任务",
              language: value.language || "Python",
              description: "根据任务要求完成 Python 实验。",
              needs_screenshot: true,
              expected_output:
                value.expected_output || "运行代码并保存 stdout/stderr 作为证据。",
            },
          ];
    const requiredSections =
      value.required_sections.length > 0
        ? value.required_sections
        : defaultReportSections;

    return {
      experiment_title: value.experiment_title || "未命名 Python 实验",
      course_name: value.course_name || "未识别课程",
      purpose: value.purpose || "根据任务要求完成 Python 实验并形成报告草稿。",
      required_sections: requiredSections,
      coding_tasks: codingTasks,
      materials_needed: value.materials_needed,
      missing_info: value.missing_info,
      risk_notes: value.risk_notes,
      task_type: value.task_type || "python_lab",
      language: value.language || codingTasks[0]?.language || "Python",
      expected_output:
        value.expected_output ||
        codingTasks[0]?.expected_output ||
        "运行代码并保存 stdout/stderr 作为证据。",
      report_outline:
        value.report_outline.length > 0
          ? value.report_outline
          : requiredSections,
      assumptions:
        value.assumptions.length > 0 ? value.assumptions : ["使用内置示例数据"],
    };
  });

export type CodingTask = z.infer<typeof codingTaskSchema>;
export type ParsedRequirement = z.infer<typeof parsedRequirementSchema>;

export function normalizeParsedRequirement(input: unknown) {
  return parsedRequirementSchema.parse(input);
}
