# Verification Notes

Run:

```bash
npm run samples:run -- --mode=local-fixture 012-run-code-screenshot-trace-export-consistency
```

The replay should write:

- `.tmp/sample-runs/012-run-code-screenshot-trace-export-consistency/artifacts/command-output-screenshot.png`
- `.tmp/sample-runs/012-run-code-screenshot-trace-export-consistency/actual-screenshots.json`
- `.tmp/sample-runs/012-run-code-screenshot-trace-export-consistency/trace.json`

The `trace.json` file must include screenshot artifacts on both `run-code` and `generate-screenshot`.
