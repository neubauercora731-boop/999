# lab-docx-delivery-workflow Reference

This project workflow standardizes the path from uploaded lab task-book DOCX to final DOCX delivery.

## Stages

1. `infer_file_role`
   Identify task book, report template, dataset, screenshot, source code, reference, and unknown files.

2. `select_task_book`
   Let the user confirm which file is the task book. Never blindly parse the first uploaded file.

3. `document-ingestion`
   Detect file type, extract raw text, normalize text, call Moonshot for structure, normalize model output, and use deterministic fallback if AI JSON is unstable.

4. `analyze`
   Read document-ingestion first, then fall back to task text, upload excerpts, and manual requirements.

5. `generate-code`
   Generate runnable code with filename and run command. Avoid `input()` unless required.

6. `run-code`
   Execute real code and capture stdout, stderr, exitCode, durationMs, and warnings.

7. `screenshot`
   If screenshots are required, generate evidence from real run/browser data. If unavailable, mark `screenshotMissing = true`.

8. `generate-report`
   Generate report content from real code and run evidence.

9. `template-preserving-docx-fill`
   Patch the original DOCX and insert labeled content under task blocks. Do not rewrite the whole document.

10. `export_acceptance`
    Check original content preservation, system-fill labels, real runtime evidence, screenshot handling, and file openability.

## Required Output Evidence

- Selected task book file id/name.
- Parser and fallback warnings.
- Structured task source: `ai` or `fallback`.
- Generated code filename and run command.
- stdout/stderr and exit code.
- screenshotRequired / screenshotMissing.
- DOCX export mode.
- Acceptance notes.
