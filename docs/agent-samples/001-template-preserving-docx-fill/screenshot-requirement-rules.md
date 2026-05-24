# Screenshot Requirement Rules

## Keywords

The workflow should treat these terms as screenshot requirement signals:

- `截图`
- `运行截图`
- `实验截图`
- `结果截图`
- `界面截图`
- `运行界面`
- `请附图`
- `附运行结果图`
- `程序运行截图`
- `网页截图`
- `页面效果截图`
- `screenshot`
- `screen shot`

## Required Flags

If the task book explicitly asks for screenshots:

- `screenshotRequired = true`

If no real screenshot evidence is available:

- `screenshotMissing = true`

## Evidence Rules

Valid screenshot evidence can come from:

- Runner-generated `command_output_screenshot` PNG from real run-code evidence.
- Verified `browser_page_screenshot` PNG from real browser rendering.
- User-uploaded screenshots only when explicitly accepted as user-provided evidence.

Invalid evidence:

- AI-generated fake screenshots.
- Placeholder images presented as real screenshots.
- Markdown image references that do not point to verified files.

## Current Behavior

The workflow detects screenshot requirements during analysis, run-code, report generation, and DOCX export. For Python/command-line tasks, the system can generate a `command_output_screenshot` PNG from real run-code evidence and insert it into the patched DOCX. For frontend tasks, `browser_page_screenshot` evidence can be inserted when available. When screenshots are required but missing, the patched DOCX must include `【截图缺失】` instead of pretending the screenshot exists.
