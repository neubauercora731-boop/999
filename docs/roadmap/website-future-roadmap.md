# Website Future Roadmap

This roadmap turns Lab Report Assistant from a working local-first task flow into a repeatable, evidence-driven Agent workflow system.

## Phase 1: Stable Evidence Chain

Goal: every deliverable must include real evidence or an explicit missing marker.

Core evidence:

- `stdout`
- `stderr`
- `exitCode`
- `runtimeMs`
- `command_output_screenshot`
- `browser_page_screenshot`
- screenshot metadata
- DOCX image insertion
- `【截图缺失】` when evidence is required but unavailable

Python command-line tasks continue to use `command_output_screenshot`. Frontend HTML/CSS/JS/React/Next.js tasks should use `browser_page_screenshot`. Screenshot failure must never be hidden by generated prose.

## Phase 2: Sample-Library-Driven Quality

Goal: the sample library becomes the regression set, prompt improvement source, skill update source, workflow classifier source, and quality scoring source.

Planned pieces:

- sample metadata schema
- standard sample directory layout
- `npm run samples:check`
- future `npm run samples:run`
- failure attribution
- feedback from failures into prompts, workflows, and project skills

## Phase 3: One-Click Agent Workflow

Goal: one user action can run the full flow while still exposing checkpoints and evidence.

Target flow:

```text
parse-document
-> analyze
-> plan
-> generate-code
-> run-code
-> debug-once
-> generate-screenshot
-> generate-report
-> evaluate
-> save-report
-> export-docx
```

The first implementation should be a skeleton that reports trace steps clearly before it mutates production data.

## Phase 4: Runner Layer Separation

Goal: Next.js should not carry every heavy execution job forever.

Target architecture:

```text
Next.js app
  pages, auth, tasks, previews, report editing, export entry points

Runner layer
  Python execution, browser rendering, screenshot capture, isolation, artifact upload

Storage layer
  Supabase Storage task-files bucket

Metadata layer
  task_outputs.report_json and future agent_trace records
```

Future runner types:

- `python_runner`
- `browser_runner`
- `docx_export_runner`
- `sample_regression_runner`
- `quality_evaluation_runner`

Production candidates: Docker Worker, Render, Railway, or VPS. Supabase Edge Functions and Vercel Serverless are not ideal places for long-running Chromium or arbitrary code execution.

## Phase 5: CI, Regression, And Production Hardening

Goal: every code change can verify that core capabilities still work.

Initial commands:

```bash
npm run lint
npm run build
npm run samples:check
```

Future commands:

```bash
npm run samples:run --all
```

Future checks:

- Playwright E2E for auth/task creation/upload
- browser screenshot sample
- command screenshot sample
- DOCX export regression
- Supabase test project smoke
