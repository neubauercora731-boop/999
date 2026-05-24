---
name: supabase-storage-metadata-workflow
description: Use this skill when uploading task artifacts to Supabase Storage or writing screenshot, report, DOCX, run, or trace metadata to task_outputs.report_json.
---

# Supabase Storage Metadata Workflow

Use this workflow for task artifacts and evidence metadata.

## Storage

- Bucket: `task-files`
- Preferred screenshot path: `task-files/{userId}/{taskId}/screenshots/{timestamp}-{fileName}.png`
- Do not expose service-role keys in frontend code.
- Do not log long signed URLs unless needed for a short debug note.

## Screenshot Metadata

Required fields:

- `id`
- `type`
- `source`
- `storagePath`
- `fileName`
- `contentType`
- `createdAt`
- `relatedRunId`
- `requiredByTask`
- `isRealScreenshot`
- `isAiGenerated`
- `missing`
- `warnings`

Browser screenshots should also include:

- `browser.engine`
- `browser.viewport`
- `browser.entryFile`
- `browser.fullPage`

## Missing Evidence

If evidence is required but unavailable, write structured missing metadata or insert `【截图缺失】` in the exported DOCX. Do not create placeholder evidence.
