import {
  extractScreenshotsFromReportJson,
  extractScreenshotsFromRunResult,
  extractScreenshotsFromTrace,
  isValidScreenshotEvidence,
  mergeScreenshotEvidence,
} from "@/lib/screenshots/evidence";

export type QualityEvaluationCheck = {
  id: string;
  label: string;
  passed: boolean;
  severity: "blocking" | "warning" | "info";
  evidence?: string;
};

export type QualityEvaluationResult = {
  score: number;
  passed: boolean;
  blockingIssues: string[];
  warnings: string[];
  checks: {
    taskRequirementsCovered: boolean;
    codeGenerated: boolean;
    codeActuallyRan: boolean;
    stdoutCaptured: boolean;
    stderrCaptured: boolean;
    exitCodeCaptured: boolean;
    runtimeCaptured: boolean;
    screenshotRequirementHandled: boolean;
    realScreenshotAttachedOrMissingMarked: boolean;
    docxOriginalStructurePreserved: boolean;
    reportHasRequiredSections: boolean;
    noFakeEvidence: boolean;
  };
  detailedChecks: QualityEvaluationCheck[];
};

export type QualityEvaluationInput = Partial<QualityEvaluationResult["checks"]>;

export type QualityEvaluationPhase = "pre_export" | "post_export";

export type EvaluateTaskOutputInput = {
  workflowType?: string;
  taskText?: string;
  parsedRequirements?: unknown;
  generatedCode?: unknown;
  runResult?: unknown;
  screenshots?: unknown[];
  trace?: unknown;
  reportJson?: unknown;
  reportText?: string;
  exportMode?: "auto" | "patch_original_docx" | "generated_report_docx" | "none";
  phase?: QualityEvaluationPhase;
  docxPatchResult?: unknown;
  patchSourceDocxAvailable?: boolean;
  screenshotRequired?: boolean;
  screenshotMissing?: boolean;
  missingScreenshotMarkerWillBeInserted?: boolean;
};

const DEFAULT_CHECKS: QualityEvaluationResult["checks"] = {
  taskRequirementsCovered: false,
  codeGenerated: false,
  codeActuallyRan: false,
  stdoutCaptured: false,
  stderrCaptured: false,
  exitCodeCaptured: false,
  runtimeCaptured: false,
  screenshotRequirementHandled: false,
  realScreenshotAttachedOrMissingMarked: false,
  docxOriginalStructurePreserved: false,
  reportHasRequiredSections: false,
  noFakeEvidence: true,
};

const CHECK_LABELS: Record<keyof QualityEvaluationResult["checks"], string> = {
  taskRequirementsCovered: "Task requirements are covered",
  codeGenerated: "Code was generated",
  codeActuallyRan: "Code actually ran",
  stdoutCaptured: "stdout was captured",
  stderrCaptured: "stderr was captured",
  exitCodeCaptured: "exitCode was captured",
  runtimeCaptured: "runtime was captured",
  screenshotRequirementHandled: "Screenshot requirement was handled",
  realScreenshotAttachedOrMissingMarked:
    "Real screenshot attached or missing marker inserted",
  docxOriginalStructurePreserved: "Original DOCX structure was preserved",
  reportHasRequiredSections: "Report has required sections",
  noFakeEvidence: "No fake evidence is present",
};

const CHECK_FAILURE_MESSAGES: Record<keyof QualityEvaluationResult["checks"], string> = {
  taskRequirementsCovered: "任务要求信息不足，无法确认报告是否覆盖原始任务。",
  codeGenerated: "当前没有找到已生成的代码。",
  codeActuallyRan: "当前没有找到真实代码运行记录。",
  stdoutCaptured: "当前没有捕获到 stdout 输出。",
  stderrCaptured: "当前没有记录 stderr 字段。",
  exitCodeCaptured: "当前没有记录 exitCode。",
  runtimeCaptured: "当前没有记录运行耗时。",
  screenshotRequirementHandled: "任务要求截图，但没有找到真实截图，也没有可插入的【截图缺失】标记。",
  realScreenshotAttachedOrMissingMarked:
    "任务要求截图，但既没有真实截图，也没有明确的截图缺失标记。",
  docxOriginalStructurePreserved: "DOCX 原结构保留检查未通过。",
  reportHasRequiredSections: "报告正文缺少必要实验章节。",
  noFakeEvidence: "报告或元数据中存在疑似伪造运行证据的表述。",
};

const BLOCKING_CHECKS = new Set<keyof QualityEvaluationResult["checks"]>([
  "codeActuallyRan",
  "screenshotRequirementHandled",
  "realScreenshotAttachedOrMissingMarked",
  "noFakeEvidence",
]);

export function createQualityEvaluation(
  input: QualityEvaluationInput,
): QualityEvaluationResult {
  const checks = { ...DEFAULT_CHECKS, ...input };
  const detailedChecks = Object.entries(checks).map(([key, passed]) => {
    const id = key as keyof QualityEvaluationResult["checks"];
    return {
      id,
      label: CHECK_LABELS[id],
      passed,
      severity: BLOCKING_CHECKS.has(id) ? "blocking" : "warning",
    } satisfies QualityEvaluationCheck;
  });
  const blockingIssues = detailedChecks
    .filter((check) => !check.passed && check.severity === "blocking")
    .map((check) => CHECK_FAILURE_MESSAGES[check.id as keyof QualityEvaluationResult["checks"]]);
  const warnings = detailedChecks
    .filter((check) => !check.passed && check.severity === "warning")
    .map((check) => CHECK_FAILURE_MESSAGES[check.id as keyof QualityEvaluationResult["checks"]]);
  const passedCount = detailedChecks.filter((check) => check.passed).length;
  const score = Math.round((passedCount / detailedChecks.length) * 100);

  return {
    score,
    passed: blockingIssues.length === 0 && score >= 75,
    blockingIssues,
    warnings,
    checks,
    detailedChecks,
  };
}

function textFromUnknown(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function getRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function getNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function getString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string") return value;
  }
  return "";
}

function hasReportSection(reportText: string, keywords: string[]) {
  const lower = reportText.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword.toLowerCase()));
}

function hasMissingScreenshotMarker(input: EvaluateTaskOutputInput) {
  const reportText = input.reportText ?? "";
  return (
    input.screenshotMissing === true ||
    input.missingScreenshotMarkerWillBeInserted === true ||
    reportText.includes("【截图缺失】") ||
    reportText.includes("截图缺失") ||
    reportText.toLowerCase().includes("screenshot missing")
  );
}

function inferScreenshotRequired(input: EvaluateTaskOutputInput) {
  if (typeof input.screenshotRequired === "boolean") return input.screenshotRequired;
  const text = `${input.taskText ?? ""}\n${textFromUnknown(input.parsedRequirements)}`;
  if (/无截图要求|不需要截图|无需截图|不用截图|不必截图|no screenshot/i.test(text)) {
    return false;
  }
  return /截图|运行截图|页面效果截图|网页截图|界面截图|screenshot/i.test(text);
}

function hasFakeSuccessClaim(reportText: string, runRecord: Record<string, unknown>) {
  const exitCode = getNumber(runRecord, ["exitCode", "exit_code"]);
  const success = runRecord.success === true;
  if (success || exitCode === 0) return false;
  return /运行成功|执行成功|successfully|succeeded/i.test(reportText);
}

export function evaluateTaskOutput(input: EvaluateTaskOutputInput): QualityEvaluationResult {
  const phase = input.phase ?? "pre_export";
  const runRecord = getRecord(input.runResult);
  const reportText = input.reportText ?? "";
  const screenshots = mergeScreenshotEvidence(
    Array.isArray(input.screenshots) ? input.screenshots : [],
    extractScreenshotsFromRunResult(input.runResult),
    extractScreenshotsFromTrace(input.trace),
    extractScreenshotsFromReportJson(input.reportJson),
  );
  const realScreenshots = screenshots.filter(isValidScreenshotEvidence);
  const screenshotRequired = inferScreenshotRequired(input);
  const screenshotHandled =
    !screenshotRequired || realScreenshots.length > 0 || hasMissingScreenshotMarker(input);
  const generatedCodeText = textFromUnknown(input.generatedCode);
  const stdout = getString(runRecord, ["stdout"]);
  const stderr = getString(runRecord, ["stderr"]);
  const exitCode = getNumber(runRecord, ["exitCode", "exit_code"]);
  const runtimeMs = getNumber(runRecord, ["runtimeMs", "runtime_ms"]);
  const codeActuallyRan =
    runRecord.success === true ||
    exitCode !== null ||
    stdout.length > 0 ||
    stderr.length > 0 ||
    runtimeMs !== null;
  const reportHasRequiredSections =
    !reportText.trim() ||
    (hasReportSection(reportText, ["实验目的", "purpose"]) &&
      hasReportSection(reportText, ["运行结果", "stdout", "result"]) &&
      hasReportSection(reportText, ["结果分析", "analysis", "总结", "summary"]));
  const fakeSuccessClaim = hasFakeSuccessClaim(reportText, runRecord);
  const fakeScreenshotClaim =
    screenshotRequired &&
    realScreenshots.length === 0 &&
    !hasMissingScreenshotMarker(input) &&
    /已生成截图|截图已生成|screenshot generated/i.test(reportText);
  const docxPreserved =
    input.exportMode === "generated_report_docx" ||
    input.exportMode === "auto" ||
    input.exportMode === "none" ||
    input.exportMode == null ||
    (input.exportMode === "patch_original_docx" &&
      (phase === "pre_export"
        ? input.patchSourceDocxAvailable !== false
        : input.docxPatchResult != null &&
          getRecord(input.docxPatchResult).rewriteWholeDocument !== true));

  const base = createQualityEvaluation({
    taskRequirementsCovered: Boolean(input.taskText || input.parsedRequirements),
    codeGenerated: generatedCodeText.trim().length > 0,
    codeActuallyRan,
    stdoutCaptured: stdout.length > 0,
    stderrCaptured: "stderr" in runRecord || "stderr" in getRecord(input.runResult),
    exitCodeCaptured: exitCode !== null,
    runtimeCaptured: runtimeMs !== null,
    screenshotRequirementHandled: screenshotHandled,
    realScreenshotAttachedOrMissingMarked: screenshotHandled,
    docxOriginalStructurePreserved: docxPreserved,
    reportHasRequiredSections,
    noFakeEvidence: !fakeSuccessClaim && !fakeScreenshotClaim,
  });

  const extraBlocking: string[] = [];
  const extraWarnings: string[] = [];

  if (fakeSuccessClaim) {
    extraBlocking.push("Report claims run success while the recorded exit code is not 0.");
  }
  if (fakeScreenshotClaim) {
    extraBlocking.push("Report claims a screenshot exists without real screenshot metadata.");
  }
  if (screenshotRequired && realScreenshots.length === 0 && hasMissingScreenshotMarker(input)) {
    extraWarnings.push("任务要求截图，但当前没有真实截图；将插入【截图缺失】标记。");
  }
  if (stderr && reportText && !/错误|失败|stderr|error|traceback/i.test(reportText)) {
    extraWarnings.push("stderr has content but the report does not mention the error.");
  }
  if (phase === "post_export" && !docxPreserved) {
    extraBlocking.push("DOCX 导出后未能确认原结构保留。");
  }

  const blockingIssues = [...base.blockingIssues, ...extraBlocking];
  const warnings = [...base.warnings, ...extraWarnings];
  const score = Math.max(0, base.score - extraBlocking.length * 25 - extraWarnings.length * 5);

  const screenshotEvidenceSummary = realScreenshots
    .map((screenshot) => {
      const location = screenshot.storagePath || screenshot.localPath || screenshot.signedUrl || "";
      return `${screenshot.kind} from ${screenshot.source}${location ? `, ${location}` : ""}`;
    })
    .join("; ");

  return {
    ...base,
    score,
    passed: blockingIssues.length === 0 && score >= 85,
    blockingIssues,
    warnings,
    detailedChecks: [
      ...base.detailedChecks,
      {
        id: "screenshotEvidenceFound",
        label: "已找到真实截图证据",
        passed: !screenshotRequired || realScreenshots.length > 0,
        severity: "info",
        evidence: !screenshotRequired
          ? "任务未要求截图"
          : screenshotEvidenceSummary || "未找到可用真实截图证据",
      },
    ],
  };
}
