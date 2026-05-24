# Screenshot Integrity Rules

## Required Evidence

Screenshots must come from real execution evidence:

- `run-code` result for command-line/Python tasks.
- Real browser page state for frontend tasks.
- User-uploaded screenshot files only when the user confirms they are real.

## Requirement Detection

Positive screenshot phrases include:

- `截图`
- `运行截图`
- `实验截图`
- `结果截图`
- `界面截图`
- `运行界面`
- `运行结果图`
- `附图`
- `附运行结果图`
- `请截图`
- `请附截图`
- `screenshot`
- `screen shot`

Negative screenshot phrases must override filename/title keyword matches unless an explicit structured flag says screenshots are required:

- `无截图要求`
- `无需截图`
- `不用截图`
- `不需要截图`
- `不要求截图`
- `不必截图`
- `无需运行截图`
- `不需要运行截图`
- `no screenshot`
- `screenshot not required`
- `without screenshot`

## Forbidden

- AI-generated fake screenshots.
- Placeholder images presented as real evidence.
- Invented stdout/stderr.
- Reusing a screenshot from a different task without marking its source.
- Hiding a missing screenshot when the task explicitly asks for one.
- Treating `无截图要求` as a screenshot requirement.

## Metadata Requirements

Every generated screenshot metadata record must include:

- `type`
- `source`
- `storagePath`
- `createdAt`
- `relatedRunId`
- `requiredByTask`
- `isRealScreenshot`
- `isAiGenerated`
- `missing`
- `warnings`

## Missing Screenshot Rule

If the task requires screenshots and no real screenshot exists:

```json
{
  "screenshotRequired": true,
  "screenshotMissing": true,
  "missingReason": "任务要求运行截图，但当前没有可用的真实运行截图。"
}
```

DOCX export must insert a visible `【截图缺失】` note rather than pretending the screenshot exists.
