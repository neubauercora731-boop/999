# Verification Notes

Current MVP supports static HTML/CSS/JS rendering through the safe preview runner. It does not run user-provided `npm install`, `npm run dev`, or package scripts.

`npm run samples:run -- 003-browser-page-screenshot-workflow` now performs a real local replay and writes:

- `artifacts/browser-page-screenshot.png`
- `artifacts/actual-screenshots.json`
- `artifacts/actual-run-result.json`

`npm run samples:run -- --all` runs this replay and marks unsupported future samples as skipped.

Regression guardrails:

- Unknown sample ids fail explicitly.
- A run that only skips samples fails explicitly.
- Local replay artifacts are ignored by Git.
- `actual-screenshots.json` uses project-relative artifact paths instead of absolute local paths.
