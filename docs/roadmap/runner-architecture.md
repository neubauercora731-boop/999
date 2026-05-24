# Runner Architecture

## Current Local-First Runner

The current project uses Next.js Route Handlers and local server utilities to run the task flow. This is acceptable for local verification and early product iteration.

Current runner responsibilities include:

- Python execution
- stdout/stderr capture
- exit code and runtime capture
- command-output screenshot generation
- static frontend browser screenshot generation
- artifact upload to Supabase Storage

This should not become the permanent production boundary for every heavy or untrusted workload.

## Recommended Future Architecture

```text
Next.js API
  -> create run request
  -> runner worker
  -> execute Python / browser / DOCX export
  -> upload artifacts to Supabase Storage
  -> write metadata
  -> return trace
```

## Future Runner Types

- `python_runner`: executes Python code in an isolated workspace.
- `browser_runner`: renders HTML/CSS/JS/React/Next.js and captures real screenshots.
- `docx_export_runner`: patches original DOCX and validates exported packages.
- `sample_regression_runner`: runs sample library checks and future replay tests.
- `quality_evaluation_runner`: performs rule-based and AI-assisted quality scoring.

## Production Notes

- Docker Worker, Render, Railway, or VPS are better fits for long-running and isolated execution.
- Vercel Serverless should not be treated as the long-term place for persistent Chromium workloads.
- Supabase Edge Functions are not a good fit for heavy browser rendering.
- Service-role keys must remain server-side and must be paired with task ownership checks.

## V5 Hardening Decision

The current Python runner and Playwright runner remain **local-first**. This pass does not implement Docker Worker isolation because the immediate goal is acceptance hardening, sample replay, and safety review rather than production infrastructure.

Recommended production split:

```text
Next.js Route Handlers
  - authenticate user
  - verify task ownership
  - create workflow request
  - expose trace/status/export responses

Runner Worker
  - execute Python
  - render Playwright screenshots
  - patch DOCX in an isolated workspace
  - upload artifacts to Supabase Storage
  - return artifact metadata and trace steps

Supabase
  - store tasks and task outputs
  - store artifact metadata
  - store task-files objects
```

Production runner requirements:

- no application secrets in the child execution environment
- isolated temporary directories
- process, CPU, memory, and wall-clock limits
- no external network by default
- task-owned artifact paths only
- real stdout/stderr/exitCode/runtime capture
- no fake screenshots or fake runtime evidence
