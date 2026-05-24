# Automation Boundaries

This project must preserve the difference between generated content and real evidence.

## Evidence That Must Not Be Faked

- whether code ran successfully
- `stdout`
- `stderr`
- `exitCode`
- `runtimeMs`
- screenshot PNG files
- DOCX image insertion
- Supabase `storagePath`
- signed URLs
- source file hashes or run metadata

## Failure Strategy

- Run fails: record the real failure, including stderr and exit code.
- Debug fails: stop after one debug attempt and keep the real failure.
- Screenshot fails: mark `【截图缺失】`.
- Browser screenshot not implemented for a task type: mark the browser screenshot missing.
- DOCX patch fails: return a structured Chinese error, do not export a misleading file.
- AI report generation fails: do not export a fake report.
- Storage upload fails: keep local run evidence if available and return a warning/error.

## Safe Automation

The workflow may automatically run deterministic steps when inputs and ownership are clear. It must stop for user confirmation when:

- the task-book file cannot be identified reliably
- multiple possible DOCX insertion points exist
- the original DOCX cannot be patched safely
- a required screenshot cannot be produced
- the task asks for behavior outside the learning-assistance scope
