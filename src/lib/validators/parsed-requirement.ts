import { z } from "zod";

export const codingTaskSchema = z.object({
  task_name: z.string().trim().default("Python 实验任务"),
  language: z.string().trim().default("Python"),
  description: z.string().trim().default("根据任务书完成 Python 实验。"),
  needs_screenshot: z.boolean().default(true),
  expected_output: z.string().trim().default("运行代码并保存 stdout/stderr 作为证据。"),
});

export const parsedRequirementSchema = z
  .object({
    experiment_title: z.string().trim().default("未命名 Python 实验"),
    course_name: z.string().trim().default("未识别课程"),
    purpose: z.string().trim().default("根据任务书完成 Python 实验并形成报告草稿。"),
    required_sections: z.array(z.string().trim()).default([]),
    coding_tasks: z.array(codingTaskSchema).default([]),
    materials_needed: z.array(z.string().trim()).default([]),
    missing_info: z.array(z.string().trim()).default([]),
    risk_notes: z.array(z.string().trim()).default([]),
  })
  .transform((value) => ({
    experiment_title: value.experiment_title || "未命名 Python 实验",
    course_name: value.course_name || "未识别课程",
    purpose: value.purpose || "根据任务书完成 Python 实验并形成报告草稿。",
    required_sections:
      value.required_sections.length > 0
        ? value.required_sections
        : [
            "实验名称",
            "实验目的",
            "实验环境",
            "实验步骤",
            "代码实现",
            "运行结果",
            "结果分析",
            "实验总结",
          ],
    coding_tasks:
      value.coding_tasks.length > 0
        ? value.coding_tasks
        : [
            {
              task_name: "Python 实验任务",
              language: "Python",
              description: "根据任务书完成 Python 实验。",
              needs_screenshot: true,
              expected_output: "运行代码并保存 stdout/stderr 作为证据。",
            },
          ],
    materials_needed: value.materials_needed,
    missing_info: value.missing_info,
    risk_notes: value.risk_notes,
  }));

export type CodingTask = z.infer<typeof codingTaskSchema>;
export type ParsedRequirement = z.infer<typeof parsedRequirementSchema>;

export function normalizeParsedRequirement(input: unknown) {
  return parsedRequirementSchema.parse(input);
}
