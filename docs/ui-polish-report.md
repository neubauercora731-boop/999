# UI Polish Report

Date: 2026-05-24

## Goal

This UI pass improves the website presentation without changing the lab delivery workflow. The product should read as a real experiment-task Agent workspace, not a generic chat box or early demo.

## Current Project State Confirmed

I read `WEBSITE_CHANGE_LOG.md` and `docs/website-change-log.md` before editing. The current product already includes:

- Supabase Auth and task history.
- File upload and file-role recognition.
- Document ingestion and AI analysis.
- Code generation and real `run-code`.
- Real `command_output_screenshot` evidence.
- Browser screenshot workflow foundation.
- Agent trace console and quality evaluation.
- Template-preserving DOCX export.
- `.doc` to `.docx` baseline conversion support.
- Regression samples for sy2, sy3, and sy4 preservation behavior.

## Skills / Methods Used

- `plan-design-review`: used before editing to define scope and avoid workflow changes.
- `design-review`: used to review visual hierarchy, status clarity, copy, spacing, and product trust.
- `web-design-guidelines`: local skill not available; used the same Web UI/accessibility principles as reference only. No third-party skill was installed.
- `qa-only`: planned for browser verification after implementation.
- `review`: used as a scope check so UI changes do not alter API/workflow semantics.

## UI Audit Summary

### P0

- Several primary pages still reflected early demo positioning instead of the current DOCX-preserving workflow.
- Main navigation and hero copy did not clearly explain the user path: upload materials -> role recognition -> parse -> Agent run -> evidence -> quality -> DOCX export.
- File upload copy did not make the `task_book` versus `dataset` distinction explicit enough.

### P1

- Workbench status language needed stronger evidence wording: real run, real screenshot, trace, quality, and original-template export.
- Task center and new task page needed clearer product-level hierarchy and less demo-oriented language.
- Login page needed clearer account-purpose explanation without touching Supabase Auth behavior.

### P2

- Global shell had decorative styling that made the operational tool feel more like a demo landing page.
- Cards/buttons/navigation needed a quieter, more consistent SaaS feel.

## Changed Pages

- `/`
- `/auth`
- `/tasks`
- `/tasks/new`
- `/tasks/[id]/analysis`
- `/tasks/[id]`

## Changed UI Components

- `src/components/ui/shell.tsx`
- `src/components/ui/shell-nav.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/button.tsx`
- `src/components/task/execution-status-panel.tsx`

## Business Modules Not Touched

This pass did not intentionally change:

- API routes
- Supabase schema
- document-ingestion logic
- file-role inference logic
- agent workflow orchestration
- screenshot evidence metadata shape
- export-docx / template-preserving DOCX logic
- core sample-regression logic for 002-014. A narrow replay addition was later added for 015/016 high-value DOCX artifact checks.

## Regression Results

- `npm run samples:check`: passed.
- `npm run samples:run -- --mode=local-fixture 014-sy2-sectioned-doc-preservation-workflow`: passed.
- `npm run samples:run -- --mode=local-fixture 015-sy3-huffman-doc-rerun-screenshot-dedup`: passed after adding DOCX artifact replay.
- `npm run samples:run -- --mode=local-fixture 016-sy4-bracket-doc-caption-specificity`: passed after adding DOCX artifact replay.
- `npm run samples:run -- --mode=local-fixture --all`: passed overall after 015/016 replay enablement. Replay-capable samples passed; 008 remains partial by design.
- `npm run lint`: passed.
- `npm run build`: passed.

## Browser Smoke QA

- `/`: loaded successfully and presents the product workflow as a lab delivery system.
- `/auth`: redirected to `/tasks` under the existing logged-in session, confirming session preservation was not disturbed.
- `/tasks`: loaded the task center with task cards and actions.
- `/tasks/new`: loaded the task creation/upload flow with clearer file role guidance.
- `/tasks/[id]/analysis`: loaded the file-role and document parsing view without a white screen.
- `/tasks/[id]`: loaded the workbench, trace/report areas, and export controls without a white screen.
- Workbench Trace rows now render as compact expandable summaries.
- The report editor now renders as an expandable section with a generated-text length summary.
- Narrow viewport smoke check at `390x844` did not show a white screen or console error.
- No severe browser console or unhandled network failure was observed during the smoke pass.

## Remaining UI Risks

- Deep Workbench Trace and report editing sections are now collapsed into summary-first rows. Future polish should be based on real user E2E observations rather than hiding additional details by default.
- Narrow-screen QA should continue after every workflow UI change because long Chinese labels and trace artifacts can wrap aggressively.

## Next Suggestions

- Add a compact evidence summary strip to the workbench only if users still miss screenshot/quality/export state after one more real E2E pass.
- Add a dedicated “DOCX export safety” panel only if users continue to miss the original-template preservation rule.
