---
name: report-quality-evaluation-workflow
description: Use this skill when evaluating whether a generated lab report satisfies task requirements, runtime evidence, screenshot requirements, DOCX preservation, and no-fake-evidence rules.
---

# Report Quality Evaluation Workflow

Use this workflow before marking a task deliverable as ready.

## Checks

- task requirements covered
- code generated
- code actually ran
- stdout captured
- stderr captured
- exitCode captured
- runtime captured
- screenshot requirement handled
- real screenshot attached or `【截图缺失】` inserted
- original DOCX structure preserved
- report has required sections
- no fake evidence

## Scoring

- 90-100: deliverable
- 75-89: minor issues
- 60-74: needs repair
- below 60: not deliverable

## Blocking Rules

- Code not run but report claims success.
- Required screenshot missing without `【截图缺失】`.
- AI-generated image marked as a real screenshot.
- Original DOCX cover or teacher requirement text modified.
- `stdout`, `stderr`, `exitCode`, or `runtimeMs` invented.

## Current Integration

- `evaluateTaskOutput()` computes checks from run results, screenshot metadata, report text, and DOCX mode.
- `/api/tasks/[id]/export-docx` runs the quality gate before exporting.
- The agent orchestrator persists quality results under `task_outputs.report_json.quality`.
