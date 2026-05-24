# Real Run Screenshot Workflow

## Purpose

Some lab task books explicitly require running screenshots, result screenshots, UI screenshots, or attached result images. These screenshots are evidence, so the system must never fake them.

This workflow provides the local minimum closed loop for Python and command-line tasks:

1. Detect screenshot requirements.
2. Respect negative phrases such as `无截图要求` and `不需要截图`.
3. Run code and capture real stdout/stderr/exit code/runtime.
4. Generate a PNG `command_output_screenshot` from the real run-code result.
5. Upload the PNG to Supabase Storage.
6. Save screenshot metadata in `task_outputs.report_json.screenshots`.
7. Insert the real PNG into template-preserving DOCX export.
8. If no real screenshot exists when one is required, mark the screenshot as missing instead of faking it.

## Command Output Screenshot

`command_output_screenshot` is a terminal-style PNG generated from persisted run-code evidence:

- task id and run id
- command
- filename
- code hash and code preview
- stdout
- stderr
- exit code
- runtime
- timestamp

It is not AI-generated. It is rendered from real execution data.

## Browser Page Screenshot

`browser_page_screenshot` is planned for frontend/HTML tasks. It should be generated only from a real opened URL or local HTML page state. It is not implemented in the current minimal version.

## Storage

Screenshots are uploaded to the existing Supabase Storage bucket `task-files` under:

```text
{userId}/{taskId}/screenshots/{timestamp}-run-output-{runId}.png
```

Exported DOCX files use an ASCII-safe Storage object name while preserving the Chinese download filename for the user.

Metadata is saved in existing `task_outputs.report_json.screenshots`. No Supabase schema change is required.

## Current Status

- `screenshotRequired` detection: implemented.
- Negative screenshot requirement detection: implemented.
- `command_output_screenshot`: implemented.
- Upload to Supabase Storage: implemented.
- Workbench status display: implemented.
- Template-preserving DOCX insertion: implemented for PNG screenshots.
- `browser_page_screenshot`: planned, not implemented.

## E2E Status

Local E2E passed on 2026-05-22:

- Standard DOCX screenshot task completed.
- Real PNG screenshot was generated and uploaded.
- Screenshot metadata was saved.
- Template-preserving DOCX export inserted the screenshot under the task requirement.
- Original task title and original requirement text remained in the DOCX.
- No-screenshot tasks no longer generate screenshots.
- Failed run-code tasks preserve real stderr and can still generate failure evidence screenshots.
