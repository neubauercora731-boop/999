# GitHub Actions Regression Plan

This plan is now partially implemented by `.github/workflows/regression.yml`. Do not enable CI jobs that require secrets until a dedicated test Supabase project exists.

## Phase 1

- `npm ci`
- `npm run lint`
- `npm run build`
- `npm run samples:check`

## Phase 2

- `npm run samples:run -- --mode=local-fixture --all`
- Playwright browser screenshot sample
- command screenshot sample
- DOCX export regression

Current CI includes local-fixture replay for 004, 005, 006, 007, 009, and 010. It does not run server-task mode and does not require Supabase secrets.

008 remains outside the pass list because its DOCX edge replay is currently partial.

## Phase 3

- Supabase test project
- Storage upload test
- signed URL test
- authenticated task E2E

## Suggested Workflow

```yaml
name: regression

on:
  push:
  pull_request:

permissions:
  contents: read

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
      - run: npm ci
      - run: npx playwright install chromium
      - run: npm run lint
      - run: npm run build
      - run: npm run samples:check
      - run: npm run samples:run -- --mode=local-fixture 004-python-file-io-lab
      - run: npm run samples:run -- --mode=local-fixture 005-python-oop-lab
      - run: npm run samples:run -- --mode=local-fixture 006-python-data-analysis-lab
      - run: npm run samples:run -- --mode=local-fixture 007-frontend-basic-lab
      - run: npm run samples:run -- --mode=local-fixture 009-failed-run-recovery
      - run: npm run samples:run -- --mode=local-fixture 010-no-screenshot-required
```

Security notes:

- keep `GITHUB_TOKEN` read-only unless a job needs write access
- do not run production Supabase writes in public pull requests
- do not put service-role keys into workflow logs
- keep deployment separate from regression until local and CI checks are stable
