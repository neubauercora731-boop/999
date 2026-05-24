# Real Run Screenshot Workflow E2E Result

## Test Time

2026-05-22, local development environment.

## Environment

- App: `http://localhost:3000`
- Project: `C:\Users\87808\Desktop\lab-report-assistant-github-fix`
- Supabase Storage bucket: `task-files`
- No Supabase schema change.
- No GitHub push.
- No Vercel deployment.
- Real code execution ran through the existing `run-code` API.

## TypeError: fetch failed

The previous `TypeError: fetch failed` was not reproducible in this E2E pass.

Observed checks:

- `/tasks` loaded successfully.
- `/api/tasks` returned `200`.
- `/api/tasks/a2e3c74e-fc55-418e-9c96-72428f163040` returned `200`.
- The page did not show `fetch failed`.
- No CORS, auth, Supabase query, Storage download, Moonshot, or Sharp runtime failure was observed for the current clean task.

The actual issues found during this pass were:

1. Workbench client state did not update screenshot status after the one-click agent flow, although the backend had already saved screenshot metadata.
2. Template-preserving DOCX export used a Chinese display filename in the Supabase Storage object key, which caused `Invalid key`.
3. Screenshot keyword detection treated negative phrases such as `无截图要求` as positive screenshot requirements.

## Fix Record

| Issue | Minimal Fix | Result |
|---|---|---|
| One-click flow showed `截图缺失` after screenshot was generated | Synced screenshot state from `firstRun` / `finalRun` inside `Workbench.applyAgentResult` | Workbench now shows `已生成真实运行截图` immediately after the one-click flow finishes. |
| Supabase Storage rejected exported DOCX object path | Added ASCII-only `storage_file_name` for Storage keys while preserving the Chinese download filename | `patch_original_docx` export now returns `200`. |
| `无截图要求` triggered screenshot generation | Added screenshot negation patterns such as `无截图要求`, `不需要截图`, `no screenshot` | No-screenshot tasks no longer generate screenshots. |

## Standard DOCX Screenshot Task

Test task:

- Task id: `a2e3c74e-fc55-418e-9c96-72428f163040`
- Source file: `standard-real-run-screenshot-task.docx`
- Requirement: Python bubble sort, real run screenshot required, final DOCX should preserve the original task book.

Actual result:

- File role: `task_book`
- Document ingestion: passed
- Analyze: passed
- `screenshotRequired`: `true`
- Code generation: passed
- `run-code`: passed
- Real stdout captured:

```text
排序前: [64, 34, 25, 12, 22, 11, 90]
排序后: [11, 12, 22, 25, 34, 64, 90]
排序正确性检查: 通过
```

- `command_output_screenshot`: generated
- Screenshot uploaded to Storage:

```text
ada428f5-eca1-42d6-854b-5d562a0f70e5/a2e3c74e-fc55-418e-9c96-72428f163040/screenshots/1779383369930-run-output-7e296833-933a-4b65-822e-a699698c9a45.png
```

- Screenshot metadata:
  - `type = command_output_screenshot`
  - `source = real_run_code_result`
  - `requiredByTask = true`
  - `isRealScreenshot = true`
  - `isAiGenerated = false`
  - `missing = false`

## DOCX Export Verification

Export mode: `patch_original_docx`

Output:

```text
ada428f5-eca1-42d6-854b-5d562a0f70e5/a2e3c74e-fc55-418e-9c96-72428f163040/outputs/1779383526326-Python.docx
```

Patch metadata:

- `preserveOriginalDocx = true`
- `rewriteWholeDocument = false`
- `insertionMode = append_under_task`
- `insertedAfterParagraphText = 3. 请附上真实运行截图，并把代码、运行结果、结果分析填写在本任务要求下方。`
- `screenshotRequired = true`
- `screenshotMissing = false`
- `screenshotInsertedCount = 1`
- `screenshotDownloadWarnings = []`

DOCX package inspection:

- Original title preserved: passed
- Original screenshot requirement preserved: passed
- Inserted `【代码】`: passed
- Inserted `【运行结果】`: passed
- Inserted `【运行截图】`: passed
- Inserted `【截图缺失】`: no, correctly absent
- `word/media/system-run-screenshot-...png` exists: passed
- PNG relationship exists: passed
- Downloaded screenshot PNG signature: `89504e470d0a1a0a`

## No Screenshot Requirement Task

Test task:

- Task id: `ef57e86d-bbba-46ab-8728-686960fdd7af`
- Requirement: Python list sum, no screenshot requirement.

Actual result:

- `run-code`: passed
- `stdout`: `列表: [1, 2, 3, 4, 5]` and `求和结果: 15`
- `screenshotRequired = false`
- `screenshotMissing = false`
- Generated screenshots: `0`
- Stored screenshots: `0`

Negative phrase regression:

- Task id: `c258f31c-cfae-4265-afad-1879b6800aef`
- Requirement includes `无截图要求` / `不需要截图`
- `screenshotRequired = false`
- Generated screenshots: `0`

## Run-Code Failure Task

Test task:

- Task id: `c8814b8c-406c-4097-b6af-a9befed56f94`
- Requirement: real screenshot required.
- Code intentionally raises `ValueError`.

Actual result:

- `run-code` returned `success = false`
- `exitCode = 1`
- `errorType = runtime_error`
- `stdout` preserved: `before failure`
- `stderr` preserved with real Python traceback.
- `screenshotRequired = true`
- `screenshotMissing = false`
- Failure evidence screenshot generated and uploaded:

```text
ada428f5-eca1-42d6-854b-5d562a0f70e5/c8814b8c-406c-4097-b6af-a9befed56f94/screenshots/1779383842534-run-output-e372a2e3-bf5e-435b-846e-a698a2a5669d.png
```

The failed run was not converted into a successful result, and the traceback remained visible.

## Current Limits

- `command_output_screenshot` is a rendered terminal evidence PNG based on real run data, not an OS-level terminal window capture.
- `browser_page_screenshot` is still planned and not implemented.
- Template-preserving DOCX patching still requires a reliable insertion point; if no safe task block is found, export must stop instead of modifying the document unpredictably.
- Non-standard `.docx` files can be parsed by fallback logic, but cannot always be safely patched while preserving formatting.
