# Browser Screenshot Integrity Rules

## Real Evidence

- `browser_page_screenshot` must come from a real Playwright Chromium render.
- Metadata must use `source = "real_browser_render"`.
- Metadata must use `isRealScreenshot = true`.
- Metadata must use `isAiGenerated = false`.

## Forbidden

- Do not use AI image generation as webpage evidence.
- Do not draw a fake webpage image from text output.
- Do not mark a screenshot as complete if no PNG was captured.
- Do not run unknown user package scripts just to get a screenshot.
- Do not pass existing app login cookies into the screenshot browser.

## Missing Screenshot Rule

If the task requires screenshots but browser capture fails:

- set `screenshotMissing = true`
- keep a Chinese `screenshotMissingReason`
- insert `【截图缺失】` during DOCX export when no real PNG exists

## DOCX Rule

When exporting original-format DOCX:

- browser screenshots should be labeled as real webpage effect screenshots
- command screenshots should be labeled as real run-code screenshots
- the original cover, teacher requirements, headers, footers, numbering, and media must remain unchanged
