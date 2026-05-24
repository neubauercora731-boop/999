export type LabWorkflowType =
  | "document_ingestion"
  | "template_preserving_docx_fill"
  | "python_algorithm_lab"
  | "python_file_io_lab"
  | "python_oop_lab"
  | "python_data_processing_lab"
  | "python_data_analysis_lab"
  | "frontend_static_html_lab"
  | "frontend_react_lab"
  | "frontend_nextjs_lab"
  | "failed_run_recovery"
  | "no_screenshot_required"
  | "unknown";

export type WorkflowRunner =
  | "python"
  | "browser"
  | "docx_export"
  | "quality_evaluation";

export type WorkflowEvidenceKind =
  | "command_output_screenshot"
  | "browser_page_screenshot"
  | "stdout"
  | "stderr"
  | "exitCode"
  | "runtime";

export interface WorkflowInferenceInput {
  taskText: string;
  fileRoles: string[];
  parsedRequirements?: unknown;
  explicitScreenshotRequired?: boolean;
}

export interface WorkflowInferenceResult {
  workflowType: LabWorkflowType;
  confidence: "high" | "medium" | "low";
  reasons: string[];
  requiredRunners: WorkflowRunner[];
  requiredEvidence: WorkflowEvidenceKind[];
}

const SCREENSHOT_NEGATION_PATTERNS = [
  /无截图要求/,
  /不需要截图/,
  /无需截图/,
  /不用截图/,
  /不必截图/,
  /no\s+screenshot/i,
  /screenshot\s+not\s+required/i,
  /without\s+screenshot/i,
];

const COMMAND_SCREENSHOT_PATTERNS = [
  /程序运行截图/,
  /运行结果截图/,
  /命令行截图/,
  /运行截图/,
  /running\s+screenshot/i,
  /command\s+output\s+screenshot/i,
];

const BROWSER_SCREENSHOT_PATTERNS = [
  /网页运行截图/,
  /网页截图/,
  /页面效果截图/,
  /页面截图/,
  /界面截图/,
  /运行界面截图/,
  /浏览器截图/,
  /网页效果图/,
  /HTML\/CSS\/JS\s*实现效果/i,
  /React\s*页面运行效果/i,
  /Next\.js\s*页面运行效果/i,
  /browser\s+screenshot/i,
  /page\s+screenshot/i,
];

function includesAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

function addUnique<T>(items: T[], item: T) {
  if (!items.includes(item)) items.push(item);
}

function textFromUnknown(value: unknown, depth = 0): string {
  if (value == null || depth > 4) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value.map((item) => textFromUnknown(item, depth + 1)).join("\n");
  }
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .map((item) => textFromUnknown(item, depth + 1))
      .join("\n");
  }
  return "";
}

export function inferWorkflowType(
  input: WorkflowInferenceInput,
): WorkflowInferenceResult {
  const combinedText = `${input.taskText}\n${textFromUnknown(
    input.parsedRequirements,
  )}`.trim();
  const lower = combinedText.toLowerCase();
  const reasons: string[] = [];
  const requiredRunners: WorkflowRunner[] = ["quality_evaluation"];
  const requiredEvidence: WorkflowEvidenceKind[] = [];
  const hasScreenshotNegation = includesAny(combinedText, SCREENSHOT_NEGATION_PATTERNS);
  const hasBrowserScreenshot =
    !hasScreenshotNegation && includesAny(combinedText, BROWSER_SCREENSHOT_PATTERNS);
  const hasCommandScreenshot =
    !hasScreenshotNegation &&
    (input.explicitScreenshotRequired === true ||
      includesAny(combinedText, COMMAND_SCREENSHOT_PATTERNS) ||
      /截图/.test(combinedText) ||
      /screenshot/i.test(combinedText));

  let workflowType: LabWorkflowType = "unknown";
  let confidence: WorkflowInferenceResult["confidence"] = "low";

  if (hasScreenshotNegation) {
    workflowType = "no_screenshot_required";
    confidence = "medium";
    reasons.push("Detected screenshot negation.");
  }

  if (/debug|stderr|failed run|运行失败|调试一次|修复一次/.test(lower)) {
    workflowType = "failed_run_recovery";
    confidence = "medium";
    reasons.push("Detected failed-run recovery keywords.");
  } else if (/next\.?js/i.test(combinedText)) {
    workflowType = "frontend_nextjs_lab";
    confidence = "high";
    reasons.push("Detected Next.js frontend task keywords.");
  } else if (/react/i.test(combinedText)) {
    workflowType = "frontend_react_lab";
    confidence = "high";
    reasons.push("Detected React frontend task keywords.");
  } else if (
    /\bhtml\b/i.test(combinedText) ||
    /\bcss\b/i.test(combinedText) ||
    /javascript|\bjs\b/i.test(combinedText)
  ) {
    workflowType = "frontend_static_html_lab";
    confidence = "high";
    reasons.push("Detected HTML/CSS/JavaScript frontend task keywords.");
  } else if (/class|oop|object|inherit|类|对象|继承/.test(lower)) {
    workflowType = "python_oop_lab";
    confidence = "medium";
    reasons.push("Detected OOP keywords.");
  } else if (/csv|dataframe|pandas|数据分析|统计分析|描述性统计/.test(lower)) {
    workflowType = "python_data_analysis_lab";
    confidence = "medium";
    reasons.push("Detected data analysis keywords.");
  } else if (/file|read|write|txt|文件|读取|写入/.test(lower)) {
    workflowType = "python_file_io_lab";
    confidence = "medium";
    reasons.push("Detected file IO keywords.");
  } else if (/python|算法|排序|循环|列表|函数|algorithm|sort/.test(lower)) {
    workflowType = "python_algorithm_lab";
    confidence = "medium";
    reasons.push("Detected Python or algorithm keywords.");
  }

  if (
    input.fileRoles.includes("task_book") ||
    input.fileRoles.includes("report_template")
  ) {
    addUnique(requiredRunners, "docx_export");
    reasons.push("Detected task-book or report-template file role.");
  }

  if (workflowType.startsWith("frontend_")) {
    addUnique(requiredRunners, "browser");
    if (hasBrowserScreenshot || hasCommandScreenshot) {
      addUnique(requiredEvidence, "browser_page_screenshot");
    }
  }

  if (
    workflowType.startsWith("python_") ||
    workflowType === "failed_run_recovery" ||
    workflowType === "no_screenshot_required"
  ) {
    addUnique(requiredRunners, "python");
    addUnique(requiredEvidence, "stdout");
    addUnique(requiredEvidence, "stderr");
    addUnique(requiredEvidence, "exitCode");
    addUnique(requiredEvidence, "runtime");
    if (hasCommandScreenshot) {
      addUnique(requiredEvidence, "command_output_screenshot");
    }
  }

  if (hasScreenshotNegation) {
    return {
      workflowType,
      confidence,
      reasons,
      requiredRunners,
      requiredEvidence: requiredEvidence.filter(
        (item) =>
          item !== "command_output_screenshot" &&
          item !== "browser_page_screenshot",
      ),
    };
  }

  if (reasons.length === 0) {
    reasons.push("No high-confidence workflow keyword was detected.");
  }

  return {
    workflowType,
    confidence,
    reasons,
    requiredRunners,
    requiredEvidence,
  };
}
