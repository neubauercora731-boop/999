# Screenshot Rules

## Requirement Detection

Set `screenshotRequired = true` when task text, document-ingestion output, or confirmed analysis contains:

- 截图
- 运行截图
- 实验截图
- 结果截图
- 界面截图
- 运行界面
- 运行结果图
- 附图
- 附运行结果图
- 请截图
- 请附截图

## Real Screenshot Evidence

Screenshots must come from real execution evidence.

For command-line tasks, `command_output_screenshot` must be rendered from:

- command
- stdout
- stderr
- exitCode
- durationMs
- generated code filename or preview
- createdAt

For frontend tasks, `browser_page_screenshot` must come from a real rendered page state.

## Prohibited

- Do not use AI-generated pictures as runtime screenshots.
- Do not invent stdout/stderr for a screenshot.
- Do not claim a screenshot exists when only text output exists.
- Do not hide screenshot generation failures.

## Missing Screenshot Handling

If screenshots are required but unavailable:

- Set `screenshotMissing = true`.
- Preserve real run result.
- Insert `【截图缺失】` into DOCX output.
- Explain that the task requires a real screenshot and the current workflow did not capture one.
