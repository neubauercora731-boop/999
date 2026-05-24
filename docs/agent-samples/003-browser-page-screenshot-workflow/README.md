# Browser Page Screenshot Workflow

This system capability sample records the first local implementation of real browser-rendered screenshots for frontend or webpage lab tasks.

## Goal

- Generate real webpage effect screenshots from user-provided frontend files.
- Use Playwright Chromium to render the page in a clean browser context.
- Save the PNG as real screenshot evidence, not an AI-generated image.
- Store screenshot metadata in existing task output JSON.
- Let DOCX export insert browser screenshots under the task block without rewriting the original DOCX.

## Current Scope

First version supports a safe static preview runner:

- `index.html`
- `.css`
- `.js`
- `.mjs`
- `.json`
- `.svg`
- multi-file static frontend packages

It does not run arbitrary user `npm install`, `npm run dev`, `vite`, `next dev`, or third-party package scripts.

`samples:run` can replay this sample locally and writes artifacts under `artifacts/`:

- `browser-page-screenshot.png`
- `actual-screenshots.json`
- `actual-run-result.json`

The `artifacts/` directory is local verification output and is ignored by Git. The replay metadata stores local artifact paths as project-relative paths, not absolute user-machine paths.

## API Entry

`POST /api/tasks/[id]/run-code`

```json
{
  "runMode": "frontend_browser",
  "frontendFiles": [
    { "path": "index.html", "content": "<!doctype html><html>...</html>" },
    { "path": "style.css", "content": "body { ... }" },
    { "path": "script.js", "content": "..." }
  ],
  "entryFile": "index.html",
  "viewport": { "width": 1280, "height": 720 },
  "fullPage": true
}
```

If `runMode` is absent, Python run-code behavior remains unchanged.

## Metadata

Browser screenshots are saved to the existing `task-files` bucket:

```text
task-files/{userId}/{taskId}/screenshots/{timestamp}-browser-page-{runId}.png
```

Metadata is stored in `task_outputs.report_json.screenshots`:

```json
{
  "type": "browser_page_screenshot",
  "source": "real_browser_render",
  "storagePath": "...",
  "contentType": "image/png",
  "requiredByTask": true,
  "isRealScreenshot": true,
  "isAiGenerated": false,
  "missing": false,
  "browser": {
    "engine": "chromium",
    "viewport": { "width": 1280, "height": 720 },
    "entryFile": "index.html",
    "fullPage": true
  }
}
```

## Security Boundary

- The screenshot browser uses a fresh context with no Supabase login cookies.
- Only the temporary local preview server is reachable.
- External network requests are blocked.
- User package scripts are not executed.
- Environment files and `node_modules` paths are rejected.
- No Supabase schema change is required.

## Current Limitations

- React tasks must be provided as static/bundled HTML/CSS/JS artifacts.
- CDN-based React examples may not render because external network requests are blocked.
- Full frontend project runners should move to a Docker/Worker boundary later.
- Browser screenshots require local Playwright Chromium to be installed.

## Local Replay

Run:

```bash
npm run samples:check
npm run samples:run -- 003-browser-page-screenshot-workflow
```

Expected result: a real `browser_page_screenshot` PNG and metadata marked with `source = real_browser_render`, `isRealScreenshot = true`, and `isAiGenerated = false`.

If a requested sample id does not exist or only unsupported future samples are selected, `samples:run` must exit with a failure instead of reporting a false pass.
