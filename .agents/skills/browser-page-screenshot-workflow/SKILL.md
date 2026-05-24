---
name: browser-page-screenshot-workflow
description: Use this skill when implementing, debugging, or validating real browser page screenshots for HTML/CSS/JS/React/Next.js lab tasks. It enforces Playwright-rendered screenshots, Supabase Storage metadata, DOCX insertion, and missing-screenshot fallback.
---

# Browser Page Screenshot Workflow

Use this workflow for frontend lab tasks that require webpage, page effect, browser, UI, interface, or rendered-result screenshots.

## Rules

- Generate screenshots only from a real browser render.
- Do not use AI-generated images as evidence.
- Do not use text descriptions as screenshot evidence.
- Do not inject the user's Supabase login cookies into the screenshot browser.
- Do not run user-uploaded `package.json` scripts in the MVP.
- Block or document external network access unless the user explicitly approves a trusted source.
- If screenshot generation fails and screenshots are required, mark `【截图缺失】`.

## MVP Scope

- static HTML
- CSS
- JavaScript
- viewport `1280x720`
- `fullPage: true`
- optional waits before screenshot
- storage under `task-files/{userId}/{taskId}/screenshots/...png`
- metadata in `task_outputs.report_json.screenshots`

## Second Stage

- React build artifacts
- Vite build artifacts
- Next.js local preview through an isolated worker
- multiple screenshots
- form interactions
- console logs
- page errors

## Required Metadata

Screenshot metadata must include:

- `type: "browser_page_screenshot"`
- `source: "real_browser_render"`
- `storagePath`
- `fileName`
- `viewport`
- `fullPage`
- `createdAt`
- `isRealScreenshot: true`
- `isAiGenerated: false`
- `missing: false`

## DOCX Integration

When exporting DOCX:

- Insert real browser PNG screenshots under the task block.
- Label them as real webpage effect screenshots from browser rendering.
- If missing, insert `【截图缺失】`.
- Preserve original task-book structure.
