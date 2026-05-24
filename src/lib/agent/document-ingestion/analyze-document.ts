import { callMoonshotText } from "@/lib/ai/moonshot";
import { extractJsonFromText } from "@/lib/agent/validators";

import {
  DOCUMENT_INGESTION_PARSER_VERSION,
  structuredDocumentTaskSchema,
  type StructuredDocumentTask,
} from "./types";

const defaultReportSections = [
  "实验名称",
  "实验目的",
  "实验环境",
  "实验内容",
  "程序代码",
  "运行结果",
  "结果分析",
  "实验总结",
];

function pickAlias(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (record[key] !== undefined) return record[key];
  }
  return undefined;
}

function normalizeStructuredTaskInput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const record = value as Record<string, unknown>;
  return {
    title: pickAlias(record, [
      "title",
      "taskTitle",
      "task_title",
      "experimentTitle",
      "experiment_title",
      "实验标题",
    ]),
    courseName: pickAlias(record, ["courseName", "course_name", "course", "课程名称"]),
    taskType: pickAlias(record, ["taskType", "task_type", "type", "任务类型"]),
    language: pickAlias(record, [
      "language",
      "programmingLanguage",
      "programming_language",
      "编程语言",
    ]),
    explicitRequirements: pickAlias(record, [
      "explicitRequirements",
      "explicit_requirements",
      "requirements",
      "显性要求",
    ]),
    implicitRequirements: pickAlias(record, [
      "implicitRequirements",
      "implicit_requirements",
      "隐性要求",
    ]),
    deliverables: pickAlias(record, ["deliverables", "outputs", "交付物"]),
    reportSections: pickAlias(record, [
      "reportSections",
      "report_sections",
      "sections",
      "报告章节",
    ]),
    codeRequirements: pickAlias(record, [
      "codeRequirements",
      "code_requirements",
      "代码要求",
    ]),
    runRequirements: pickAlias(record, [
      "runRequirements",
      "run_requirements",
      "运行要求",
    ]),
    formatRequirements: pickAlias(record, [
      "formatRequirements",
      "format_requirements",
      "格式要求",
    ]),
    missingInfo: pickAlias(record, ["missingInfo", "missing_info", "missing", "缺失信息"]),
    riskNotes: pickAlias(record, ["riskNotes", "risk_notes", "risks", "风险提示"]),
  };
}

function extractJsonFromModelText(value: string) {
  try {
    return JSON.parse(extractJsonFromText(value));
  } catch {
    return null;
  }
}

function firstMeaningfulLine(text: string) {
  return (
    text
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length >= 4 && line.length <= 80) ?? ""
  );
}

function inferTaskType(text: string) {
  const lower = text.toLowerCase();
  if (/sql|mysql|postgres|数据库|crud/.test(lower)) return "database_lab";
  if (/html|css|javascript|react|前端|网页/.test(lower)) return "frontend_basic_lab";
  if (/python|算法|数据结构|排序|bf|模式匹配|字符串/.test(lower)) return "python_lab";
  return "unknown";
}

function inferLanguage(text: string) {
  const lower = text.toLowerCase();
  if (/python|算法|数据结构|排序|bf|模式匹配/.test(lower)) return "Python";
  if (/sql|mysql|postgres|数据库/.test(lower)) return "SQL";
  if (/html|css|javascript|react|前端|网页/.test(lower)) return "HTML/CSS/JavaScript";
  return "unknown";
}

function extractRequirementLines(text: string) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const keywords = ["实验内容", "实验要求", "任务要求", "要求", "实验步骤", "提交"];
  const picked: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    if (!keywords.some((keyword) => lines[index].includes(keyword))) continue;
    picked.push(lines[index]);
    for (let offset = 1; offset <= 5; offset += 1) {
      const next = lines[index + offset];
      if (next) picked.push(next);
    }
  }

  return Array.from(new Set(picked)).slice(0, 12);
}

function buildFallbackStructuredTask(input: {
  fileName: string;
  normalizedText: string;
  warning: string;
}): StructuredDocumentTask {
  const title =
    firstMeaningfulLine(input.normalizedText) ||
    input.fileName.replace(/\.[^.]+$/, "") ||
    "未命名实验任务";
  const explicitRequirements = extractRequirementLines(input.normalizedText);
  const structuredAt = new Date().toISOString();

  return structuredDocumentTaskSchema.parse({
    title,
    courseName: input.normalizedText.includes("数据结构") ? "数据结构与算法" : "",
    taskType: inferTaskType(input.normalizedText),
    language: inferLanguage(input.normalizedText),
    explicitRequirements:
      explicitRequirements.length > 0
        ? explicitRequirements
        : ["已从文档正文提取到任务材料，但未能稳定定位明确的分条要求，请用户确认。"],
    implicitRequirements: [
      "报告内容应基于真实代码和真实运行结果，不伪造 stdout、stderr 或截图。",
    ],
    deliverables: ["实验报告草稿"],
    reportSections: defaultReportSections,
    codeRequirements: [],
    runRequirements: ["如任务涉及代码，应真实运行并保留 stdout/stderr。"],
    formatRequirements: [],
    missingInfo:
      explicitRequirements.length > 0
        ? []
        : ["文档中明确任务要求的位置不够稳定，需要用户确认。"],
    riskNotes: [input.warning],
    structuredBy: "fallback",
    source: "fallback",
    parserVersion: DOCUMENT_INGESTION_PARSER_VERSION,
    structuredAt,
    warnings: [input.warning],
  });
}

export async function analyzeDocumentStructure(input: {
  taskId: string;
  fileName: string;
  normalizedText: string;
}): Promise<StructuredDocumentTask> {
  try {
    const result = await callMoonshotText({
      systemPrompt: [
        "你是实验报告自动化助手的文档解析器。",
        "你的任务是只根据用户上传文档正文提取实验任务要求，并输出严格 JSON。",
        "不要编造文档中没有的要求。",
        "如果信息缺失，写入 missingInfo。",
        "如果发现安全、真实性或格式风险，写入 riskNotes。",
      ].join("\n"),
      userPrompt: [
        `文件名：${input.fileName}`,
        "请把下面的实验任务书/模板正文结构化为一个 JSON object。",
        "只返回 JSON，不要 Markdown 代码块，不要解释，不要把结果包在数组里。",
        "字段必须是英文 key，数组字段必须是 string[]。",
        "JSON 字段必须包含：title, courseName, taskType, language, explicitRequirements, implicitRequirements, deliverables, reportSections, codeRequirements, runRequirements, formatRequirements, missingInfo, riskNotes。",
        "输出格式示例：",
        JSON.stringify({
          title: "",
          courseName: "",
          taskType: "",
          language: "",
          explicitRequirements: [],
          implicitRequirements: [],
          deliverables: [],
          reportSections: [],
          codeRequirements: [],
          runRequirements: [],
          formatRequirements: [],
          missingInfo: [],
          riskNotes: [],
        }),
        "文档正文：",
        input.normalizedText,
      ].join("\n\n"),
      maxTokens: 4096,
      timeoutMs: 120000,
      metadata: {
        taskId: input.taskId,
        stepName: "document_structure",
      },
    });

    const extractedJson = extractJsonFromModelText(result.content);
    if (extractedJson) {
      const normalized = normalizeStructuredTaskInput(extractedJson);
      const parsed = structuredDocumentTaskSchema.safeParse({
        ...normalized,
        structuredBy: "moonshot",
        source: "moonshot",
        parserVersion: DOCUMENT_INGESTION_PARSER_VERSION,
        structuredAt: new Date().toISOString(),
      });

      if (parsed.success) {
        return parsed.data;
      }

      console.warn("document_structure_schema_fallback", {
        task_id: input.taskId,
        model_response_length: result.content.length,
        reason: parsed.error.message,
      });
    } else {
      console.warn("document_structure_json_extract_fallback", {
        task_id: input.taskId,
        model_response_length: result.content.length,
      });
    }

    return buildFallbackStructuredTask({
      fileName: input.fileName,
      normalizedText: input.normalizedText,
      warning: "AI 结构化校验失败，已使用规则 fallback，请确认解析结果。",
    });
  } catch (error) {
    console.warn("document_structure_request_fallback", {
      task_id: input.taskId,
      message: error instanceof Error ? error.message : "unknown_error",
    });

    return buildFallbackStructuredTask({
      fileName: input.fileName,
      normalizedText: input.normalizedText,
      warning: "AI 结构化请求失败，已使用规则 fallback，请确认解析结果。",
    });
  }
}
