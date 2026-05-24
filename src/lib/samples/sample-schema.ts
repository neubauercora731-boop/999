export type SampleTaskType =
  | "document_ingestion"
  | "template_preserving_docx_fill"
  | "python_algorithm_lab"
  | "python_file_io_lab"
  | "python_oop_lab"
  | "python_data_analysis_lab"
  | "frontend_static_html_lab"
  | "frontend_react_lab"
  | "frontend_nextjs_lab"
  | "failed_run_recovery"
  | "no_screenshot_required";

export type SampleRunner =
  | "python"
  | "browser"
  | "docx_export"
  | "quality_evaluation";

export type SampleEvidenceKind =
  | "command_output_screenshot"
  | "browser_page_screenshot"
  | "stdout"
  | "stderr"
  | "exitCode"
  | "runtime"
  | "docx_export";

export type AgentSampleMetadata = {
  sample_id: string;
  title: string;
  task_type: SampleTaskType;
  required_runners: SampleRunner[];
  required_evidence: SampleEvidenceKind[];
  docx_mode: "patch_original_docx" | "generated_report_docx" | "none";
  must_preserve_original_docx: boolean;
  must_not_fake_screenshot: boolean;
  screenshot_policy: {
    required: boolean;
    allowed_kinds: SampleEvidenceKind[];
    missing_behavior:
      | "insert_missing_screenshot_marker"
      | "not_required"
      | "fail_export";
  };
  expected_failure_behavior: {
    run_failed: "record_real_failure" | "debug_once_then_record";
    screenshot_failed: "insert_missing_screenshot_marker" | "fail_export";
    export_failed: "return_structured_error";
  };
  quality_checks: {
    task_requirements_covered: boolean;
    code_actually_runs: boolean;
    evidence_attached_or_missing_marked: boolean;
    docx_structure_preserved: boolean;
  };
};

export const STANDARD_SAMPLE_REQUIRED_FILES = [
  "README.md",
  "sample.json",
  "sample-task.md",
  "expected-analysis.json",
  "expected-plan.json",
  "expected-run-result.json",
  "expected-screenshots.json",
  "expected-report.md",
  "expected-docx-checklist.md",
  "verification-notes.md",
] as const;

export function isStandardSampleDirectoryName(name: string) {
  return /^(00[2-9]|01[0-9])-/.test(name);
}

export function isAgentSampleMetadata(
  value: unknown,
): value is AgentSampleMetadata {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.sample_id === "string" &&
    typeof record.title === "string" &&
    typeof record.task_type === "string" &&
    Array.isArray(record.required_runners) &&
    Array.isArray(record.required_evidence) &&
    typeof record.screenshot_policy === "object" &&
    record.screenshot_policy !== null
  );
}
