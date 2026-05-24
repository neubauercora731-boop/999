# Manual Authenticated E2E Checklist

Date: 2026-05-22

Purpose: verify the product path with a real browser session after the local replay suite passes. This checklist is intentionally separate from `samples:run` because it depends on a logged-in Supabase session and a human-visible browser.

## Current Status

- Status: not run in this hardening pass.
- Reason: no active browser-authenticated session was available in this run, and the task scope forbids asking for or printing credentials/secrets.
- Safe fallback completed: local-fixture sample replay, lint, and build verification.

Do not mark production ready until this checklist has been executed with a test account.

## Checklist

1. Open `/auth`.
2. Log in with a test account.
3. Refresh `/tasks` and confirm the session is still active.
4. Create a Python file-IO task from `/tasks/new`.
5. Open `/tasks/[id]`.
6. Click `开始全流程`.
7. Confirm Trace UI shows at least `run-code`, `generate-screenshot`, `generate-report`, and `evaluate`.
8. Confirm `command_output_screenshot` is generated from real stdout/stderr/exitCode/runtime.
9. Click `导出 DOCX`.
10. Open the exported DOCX and confirm a real command-output screenshot is inserted.
11. Create a frontend basic task.
12. Click `开始全流程`.
13. Confirm `browser_page_screenshot` generates `initial` and `after-click` evidence when actions are present.
14. Export DOCX and confirm real webpage screenshots are inserted.
15. Create a no-screenshot-required task.
16. Confirm the workflow does not force screenshots and does not insert `【截图缺失】`.
17. Create a deliberately failing Python task.
18. Confirm `debug-once` is attempted once or the real failure is recorded.
19. Confirm failed runs are not displayed as successful.
20. Refresh the workbench and confirm trace/report/artifact state still appears.

## Pass Criteria

- No white screen.
- No infinite loading state.
- Authenticated pages keep the session after refresh.
- Trace states match real step results.
- Screenshot success is only shown when a real PNG exists.
- Quality failures are visible before DOCX export.
- DOCX export keeps original template structure.

## Failure Recording

If any step fails, record:

- page URL
- failing action
- visible UI state
- Network response status/body if available
- server terminal error summary
- whether the failure is auth, workflow, screenshot, quality, or DOCX related
