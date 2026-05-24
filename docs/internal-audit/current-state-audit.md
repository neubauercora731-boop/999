# Current State Audit

Date: 2026-05-22

## Implemented Capabilities

- Python run-code captures stdout, stderr, exitCode, and runtime.
- `command_output_screenshot` generates PNG evidence from real run-code data.
- `browser_page_screenshot` generates real Playwright-rendered PNGs for static HTML/CSS/JS fixtures.
- Screenshots use existing `task_outputs.report_json.screenshots` metadata.
- DOCX export defaults to `patch_original_docx`.
- `samples:check` validates standard sample structure.
- `samples:run --mode=local-fixture` now replays sample 002 and 003.
- `/api/tasks/[id]/agent/run` can now execute an orchestrated workflow and persist trace/quality.
- `/api/tasks/[id]/agent/trace` can now return the latest persisted trace from `task_outputs.report_json.agent_trace`.

## Remaining Skeleton Or Partial Areas

- Full one-click DOCX export is not executed inside the orchestrator; export remains a separate quality-gated endpoint.
- Frontend code generation is not connected to the one-click orchestrator.
- Browser screenshot actions and multi-screenshot flows are not implemented yet.
- Samples 004-010 are still structural samples and are skipped by local fixture replay.
- Production runner isolation is not complete; local Python/Playwright execution is still local-first.

## Locally Verifiable Flows

- `npm run samples:check`
- `npm run samples:run -- --mode=local-fixture 002-real-run-screenshot-workflow`
- `npm run samples:run -- --mode=local-fixture 003-browser-page-screenshot-workflow`
- `npm run samples:run -- --mode=local-fixture --all`

## Security Risks

- Python execution must not be treated as a production security boundary. It now uses a small environment whitelist, but it is still application-host execution.
- Service-role Storage reads must validate that paths stay under `{userId}/{taskId}/`.
- Trace and report JSON must not store secrets, cookies, or complete signed URLs.

## This Change Scope

- Connected agent run to an orchestrator that persists trace and quality.
- Added real quality evaluation from runtime and screenshot metadata.
- Added local fixture replay for 002 and retained real browser replay for 003.
- Added quality gate and Storage path boundary checks to DOCX export.
- Updated canonical project change log.

## Out Of Scope

- No Supabase schema migration.
- No Vercel deployment.
- No GitHub push.
- No production worker implementation.
- No OCR/PDF expansion.
