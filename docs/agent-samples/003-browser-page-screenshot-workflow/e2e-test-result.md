# Browser Page Screenshot E2E Test Result

Test date: 2026-05-22

## Environment

- Local project: `C:\Users\87808\Desktop\lab-report-assistant-github-fix`
- Runtime: Next.js local development / Node.js
- Browser runner: Playwright Chromium
- Storage: existing Supabase `task-files` bucket

## Implementation Result

- Added a safe browser screenshot runner in `src/lib/screenshots/browser-page-screenshot.ts`.
- Extended `POST /api/tasks/[id]/run-code` with `runMode = "frontend_browser"`.
- Added `browser_page_screenshot` metadata support.
- Kept Python `run-code` behavior unchanged.
- Kept Supabase schema unchanged.
- Kept DOCX patch mode as the default export path.

## Planned Test Scenarios

1. Static HTML task: provide `index.html + style.css + script.js` and capture PNG.
2. Static frontend artifact task: provide bundled HTML/CSS/JS and capture PNG.
3. Screenshot-required frontend task: verify metadata and DOCX insertion.
4. No-screenshot task: verify Python/default flow does not force browser screenshots.
5. Render failure: missing entry file or JS error should not fake screenshots.
6. Security regression: no cookies, no secrets, no arbitrary npm scripts, external network blocked.
7. DOCX check: exported DOCX contains `word/media/*.png` and keeps original text.

## Current Notes

- Playwright package was installed locally.
- Playwright bundled Chromium install timed out on this machine, but the runner successfully fell back to local Chrome/Edge.
- Static HTML smoke test passed: real PNG generated with size `1280x720`.
- `npm run samples:run -- 003-browser-page-screenshot-workflow` now replays this sample locally.
- The replay writes real artifacts:
  - `artifacts/browser-page-screenshot.png`
  - `artifacts/actual-screenshots.json`
  - `artifacts/actual-run-result.json`
- Latest replay result: passed.
- Latest replay PNG signature: `89-50-4E-47-0D-0A-1A-0A`.
- Latest replay PNG size: `15558` bytes.
- Replay metadata now uses project-relative local artifact paths and includes `storagePath`, `viewport`, and `fullPage` fields required by the sample expectation file.
- Unknown sample ids and unsupported-only sample selections now fail explicitly, avoiding false-positive `samples:run` passes.
- Server workflow-level task run passed on existing local task `a2e3c74e-fc55-418e-9c96-72428f163040`.
- Browser screenshot metadata was written with `type = browser_page_screenshot` and `source = real_browser_render`.
- Screenshot Storage path verified as downloadable PNG:
  `ada428f5-eca1-42d6-854b-5d562a0f70e5/a2e3c74e-fc55-418e-9c96-72428f163040/screenshots/1779427252616-browser-page-9e97a049-d677-433c-9eb3-23721a25cefe.png`
- DOCX export smoke passed: exported DOCX contains `word/media/*.png` entries and text label `真实网页效果截图，来源于浏览器渲染结果`.
- Missing entry failure test passed: runner returned Chinese error `找不到入口文件 missing.html，无法生成真实网页效果截图。`
- Full UI button click test was not completed because the available Playwright MCP tool set did not expose a fill/evaluate action in this session; the workbench page itself loaded successfully under the current local login, and the route compiles through Next build.

## Verification Commands

- `npm run lint`: pass
- `npm run build`: pass
- `npm run samples:check`: pass
- `npm run samples:run -- 003-browser-page-screenshot-workflow`: pass
- `npm run samples:run -- --all`: pass for 003, skipped for samples whose replay runner is not implemented yet
- static runner smoke: pass
- Storage PNG download check: pass
- DOCX media/label check: pass
