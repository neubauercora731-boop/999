export type ScreenshotEvidenceKind =
  | "command_output_screenshot"
  | "browser_page_screenshot";

export type ScreenshotEvidenceStatus = "ok" | "missing" | "failed";

export type ScreenshotEvidenceSource =
  | "run-code"
  | "browser-runner"
  | "agent-trace"
  | "task-output-report-json"
  | "export-docx"
  | "sample-fixture"
  | "quality-evaluation";

export type CanonicalScreenshotEvidence = {
  kind: ScreenshotEvidenceKind;
  status: ScreenshotEvidenceStatus;
  source: ScreenshotEvidenceSource;
  relatedRunId?: string;
  label?: string;
  storagePath?: string;
  signedUrl?: string;
  localPath?: string;
  fileName?: string;
  createdAt?: string;
  runtimeMs?: number;
  missingReason?: string;
  metadata?: Record<string, unknown>;
};

function getRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function getString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

function getNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return undefined;
}

function normalizeKind(value: unknown): ScreenshotEvidenceKind | null {
  if (value === "command_output_screenshot" || value === "browser_page_screenshot") {
    return value;
  }
  return null;
}

function normalizeStatus(record: Record<string, unknown>): ScreenshotEvidenceStatus {
  if (record.status === "missing" || record.missing === true) return "missing";
  if (record.status === "failed") return "failed";
  return "ok";
}

function normalizeSource(value: unknown, kind: ScreenshotEvidenceKind): ScreenshotEvidenceSource {
  if (
    value === "run-code" ||
    value === "browser-runner" ||
    value === "agent-trace" ||
    value === "task-output-report-json" ||
    value === "export-docx" ||
    value === "sample-fixture" ||
    value === "quality-evaluation"
  ) {
    return value;
  }
  if (value === "real_run_code_result") return "run-code";
  if (value === "real_browser_render") return "browser-runner";
  return kind === "browser_page_screenshot" ? "browser-runner" : "run-code";
}

export function normalizeScreenshotEvidence(
  input: unknown,
): CanonicalScreenshotEvidence | null {
  const record = getRecord(input);
  if (!record) return null;
  const metadata = getRecord(record.metadata);
  const merged = metadata ? { ...metadata, ...record } : record;
  const kind = normalizeKind(merged.kind ?? merged.type);
  if (!kind) return null;

  const status = normalizeStatus(merged);
  const source = normalizeSource(merged.source, kind);
  const path = getString(merged, ["storagePath", "path"]);
  const signedUrl = getString(merged, ["signedUrl", "url"]);
  const localPath = getString(merged, ["localPath"]);

  return {
    kind,
    status,
    source,
    relatedRunId: getString(merged, ["relatedRunId", "runId", "related_run_id"]),
    label: getString(merged, ["label"]),
    storagePath: path,
    signedUrl,
    localPath,
    fileName: getString(merged, ["fileName", "filename"]),
    createdAt: getString(merged, ["createdAt", "created_at"]),
    runtimeMs: getNumber(merged, ["runtimeMs", "runtime_ms"]),
    missingReason: getString(merged, ["missingReason", "missing_reason", "reason"]),
    metadata: merged,
  };
}

export function isValidScreenshotEvidence(screenshot: CanonicalScreenshotEvidence) {
  return (
    screenshot.status === "ok" &&
    (screenshot.kind === "command_output_screenshot" ||
      screenshot.kind === "browser_page_screenshot") &&
    Boolean(screenshot.storagePath || screenshot.signedUrl || screenshot.localPath)
  );
}

export function hasUsableScreenshotEvidence(screenshots: CanonicalScreenshotEvidence[]) {
  return screenshots.some(isValidScreenshotEvidence);
}

function dedupeKey(screenshot: CanonicalScreenshotEvidence) {
  if (screenshot.storagePath) return `${screenshot.kind}:storage:${screenshot.storagePath}`;
  return `${screenshot.kind}:file:${screenshot.fileName ?? ""}:${screenshot.createdAt ?? ""}`;
}

export function mergeScreenshotEvidence(
  ...sources: Array<unknown[] | undefined | null>
): CanonicalScreenshotEvidence[] {
  const seen = new Set<string>();
  const screenshots: CanonicalScreenshotEvidence[] = [];

  for (const source of sources) {
    if (!Array.isArray(source)) continue;
    for (const item of source) {
      const screenshot = normalizeScreenshotEvidence(item);
      if (!screenshot) continue;
      const key = dedupeKey(screenshot);
      if (seen.has(key)) continue;
      seen.add(key);
      screenshots.push(screenshot);
    }
  }

  return screenshots;
}

export function extractScreenshotsFromRunResult(value: unknown) {
  const record = getRecord(value);
  const screenshots = record?.screenshots;
  return Array.isArray(screenshots) ? mergeScreenshotEvidence(screenshots) : [];
}

export function extractScreenshotsFromTrace(value: unknown) {
  const record = getRecord(value);
  const steps = Array.isArray(value)
    ? value
    : Array.isArray(record?.steps)
      ? record.steps
      : [];
  const artifacts = steps.flatMap((step) => {
    const stepRecord = getRecord(step);
    const stepArtifacts = stepRecord?.artifacts;
    return Array.isArray(stepArtifacts) ? stepArtifacts : [];
  });
  return mergeScreenshotEvidence(artifacts);
}

export function extractScreenshotsFromReportJson(value: unknown) {
  const record = getRecord(value);
  if (!record) return [];
  const traceScreenshots = extractScreenshotsFromTrace(record.agent_trace ?? record.agentTrace);
  return mergeScreenshotEvidence(
    Array.isArray(record.screenshots) ? record.screenshots : [],
    traceScreenshots,
    Array.isArray(record.artifacts) ? record.artifacts : [],
    extractScreenshotsFromRunResult(record.run_result ?? record.runResult),
    extractScreenshotsFromRunResult(record.first_run ?? record.firstRun),
    extractScreenshotsFromRunResult(record.final_run ?? record.finalRun),
  );
}

export function createMissingScreenshotEvidence(
  kind: ScreenshotEvidenceKind,
  missingReason: string,
): CanonicalScreenshotEvidence {
  return {
    kind,
    status: "missing",
    source: "quality-evaluation",
    missingReason,
    metadata: {
      missing: true,
      missingReason,
    },
  };
}
