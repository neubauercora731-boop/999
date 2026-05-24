import type {
  BuiltTaskContext,
  OutlineDocument,
  ParsedRequirement,
} from "@/lib/ai/types";

function formatFiles(context: BuiltTaskContext) {
  if (context.files.length === 0) {
    return "No uploaded files.";
  }

  return context.files
    .map((file) => {
      const excerpt = file.excerpt ? `\nExcerpt:\n${file.excerpt}` : "";
      return [
        `- Type: ${file.fileType}`,
        `  Role: ${file.role}`,
        `  File name: ${file.fileName}`,
        `  MIME: ${file.mimeType ?? "unknown"}`,
        `  Storage path: ${file.storagePath}`,
        file.datasetPreview
          ? `  Dataset columns: ${(file.datasetPreview.columns ?? []).join(", ") || "unknown"}\n  Dataset preview:\n${file.datasetPreview.rawTextPreview ?? ""}`
          : "",
        excerpt,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");
}

export function requirementParserPrompt(context: BuiltTaskContext) {
  return {
    systemPrompt: [
      "You extract Python lab-report requirements for a learning-assistance workbench.",
      "This product is not a homework-submission or screenshot-forgery system.",
      "Do not imply automatic school submission. Do not invent screenshots.",
      "Screenshots/evidence must come from real execution output or uploaded materials.",
      "Return exactly one JSON object.",
      "Do not return markdown.",
      "Do not wrap the JSON in code fences.",
      "Do not explain your answer.",
      "Use snake_case keys.",
      "If information is missing, keep the field but describe the gap in missing_info.",
      "The JSON must include exactly these top-level keys:",
      "experiment_title, course_name, purpose, required_sections, coding_tasks, materials_needed, missing_info, risk_notes.",
      "coding_tasks must be an array of objects with: task_name, language, description, needs_screenshot, expected_output.",
      "Set needs_screenshot=true only when the source materials explicitly ask for screenshots, running screenshots, result images, or UI screenshots.",
      "Use language='Python' unless the task explicitly says otherwise.",
    ].join("\n"),
    userPrompt: [
      "Build the required structured JSON from the following context.",
      "",
      `Task title: ${context.title}`,
      `Experiment name from form: ${context.experimentName ?? "not provided"}`,
      `Course name from form: ${context.courseName ?? "not provided"}`,
      "",
      "Task-book text:",
      context.taskBookText || "none",
      "",
      "Requirement text:",
      context.requirementText || "none",
      "",
      "Student notes:",
      context.notes || "none",
      "",
      "Template instructions:",
      context.templateInstructions || "none",
      "",
      "Uploaded file summary:",
      formatFiles(context),
    ].join("\n"),
  };
}

export function outlineGeneratorPrompt(
  context: BuiltTaskContext,
  requirement: ParsedRequirement,
) {
  return {
    systemPrompt: [
      "You generate a structured lab-report outline.",
      "Return exactly one JSON object.",
      "Do not return markdown.",
      "Do not wrap the JSON in code fences.",
      "The top-level JSON keys must be: title, summary, sections.",
      "Each section must include: title, goal, contentSummary, dependentMaterials.",
      "Keep the outline practical for a student to expand into a full report.",
      "If the uploaded task book or template already contains a fixed report template, preserve the original section order and section names as much as possible.",
      "Prefer Chinese section titles when the source materials are Chinese.",
    ].join("\n"),
    userPrompt: [
      "Generate an OutlineDocument JSON object based on the requirement JSON and context below.",
      "Return this exact top-level shape:",
      "{\"title\":\"string\",\"summary\":\"string\",\"sections\":[{\"title\":\"string\",\"goal\":\"string\",\"contentSummary\":\"string\",\"dependentMaterials\":[\"string\"]}]}",
      "",
      "Requirement JSON:",
      JSON.stringify(requirement, null, 2),
      "",
      "Confirmation notes:",
      context.confirmationNotes || "none",
      "",
      "Student notes:",
      context.notes || "none",
      "",
      "Uploaded file summary:",
      formatFiles(context),
    ].join("\n"),
  };
}

export function reportGeneratorPrompt(
  context: BuiltTaskContext,
  requirement: ParsedRequirement,
  outline: OutlineDocument,
) {
  return {
    systemPrompt: [
      "You generate the final lab report body.",
      "Return markdown only.",
      "Do not return JSON.",
      "Do not add commentary before or after the report.",
      "The report body and all labels inserted into DOCX must be Chinese by default.",
      "If the source task is Chinese, do not switch to English section titles or English explanatory paragraphs.",
      "Do not invent concrete experiment data that is not supported by the materials.",
      "If data is missing, say it is based on the available materials and mark missing details conservatively.",
      "When the source materials look like a school lab-report template, follow that template closely instead of writing a generic article.",
      "Keep the report in Chinese when the source materials are in Chinese.",
      "Use Chinese labels for evidence sections without the words 系统填写: 【代码】, 【运行结果】, 【运行截图】, 【结果分析】, 【问题及思考】, and 【截图缺失】.",
      "Include a cover-information block when the materials contain cover fields such as course, semester, college, major, class, instructor, experiment name, student name, or student number.",
      "If student name or student number is not available, leave them as clear blanks or placeholders rather than inventing them.",
      "Preserve the section order and wording from the task book/template when they are explicitly given.",
      "For evidence-dependent sections such as screenshots, do not fabricate images; instead add a concise placeholder note that real screenshots should be inserted.",
      "Make the report feel submission-ready, not like rough notes.",
    ].join("\n"),
    userPrompt: [
      "Write the lab report in markdown.",
      "Cover all required sections from the requirement JSON.",
      "Keep the tone formal and student-appropriate.",
      "If the source text includes a fixed template, follow this preferred section pattern when applicable:",
      "1. Cover / basic information block",
      "2. 实验目的",
      "3. 实验内容及原理",
      "4. 实验设备及实验步骤",
      "5. 项目截图",
      "6. 问题及思考",
      "Use exact headings from the source template when they are available.",
      "Fill all sections except student name and student number if they are unavailable.",
      "",
      "Requirement JSON:",
      JSON.stringify(requirement, null, 2),
      "",
      "Outline JSON:",
      JSON.stringify(outline, null, 2),
      "",
      "Confirmation notes:",
      context.confirmationNotes || "none",
      "",
      "Student notes:",
      context.notes || "none",
      "",
      "Template instructions:",
      context.templateInstructions || "none",
      "",
      "Task-book text:",
      context.taskBookText || "none",
      "",
      "Uploaded file summary:",
      formatFiles(context),
    ].join("\n"),
  };
}

export function consistencyCheckerPrompt(
  requirement: ParsedRequirement,
  outline: OutlineDocument,
  reportMarkdown: string,
) {
  return {
    systemPrompt: [
      "You check consistency across requirement, outline, and report.",
      "Return exactly one JSON object.",
      "Do not return markdown.",
      "Do not wrap the JSON in code fences.",
      "Use status=passed only when the overall output is acceptable.",
      "Otherwise use status=needs_revision.",
      "Populate missingSections, conflicts, omittedFields, and suggestions precisely.",
    ].join("\n"),
    userPrompt: [
      "Check the following lab-report artifacts for consistency.",
      "Return this exact top-level shape:",
      "{\"status\":\"passed | needs_revision\",\"summary\":\"string\",\"missingSections\":[\"string\"],\"conflicts\":[\"string\"],\"omittedFields\":[\"string\"],\"suggestions\":[\"string\"]}",
      "",
      "Requirement JSON:",
      JSON.stringify(requirement, null, 2),
      "",
      "Outline JSON:",
      JSON.stringify(outline, null, 2),
      "",
      "Report markdown:",
      reportMarkdown,
    ].join("\n"),
  };
}

export type PromptPayload =
  | ReturnType<typeof requirementParserPrompt>
  | ReturnType<typeof outlineGeneratorPrompt>
  | ReturnType<typeof reportGeneratorPrompt>
  | ReturnType<typeof consistencyCheckerPrompt>;
