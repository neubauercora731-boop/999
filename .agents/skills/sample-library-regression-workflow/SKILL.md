---
name: sample-library-regression-workflow
description: Use this skill when adding, validating, or running agent samples for Lab Report Assistant regression testing, prompt improvement, workflow classification, and quality scoring.
---

# Sample Library Regression Workflow

Use this workflow when adding or validating files under `docs/agent-samples/`.

## Purpose

- regression testing
- prompt improvement
- skill update source
- workflow classification source
- report quality scoring source
- multi-agent coordination examples

## Required Standard Sample Files

Every new standard sample should include:

- `README.md`
- `sample.json`
- `sample-task.md`
- `input-files/`
- `expected-analysis.json`
- `expected-plan.json`
- `expected-code/`
- `expected-run-result.json`
- `expected-screenshots.json`
- `expected-report.md`
- `expected-docx-checklist.md`
- `verification-notes.md`

## Failure Handling

When a sample fails, classify the reason:

- prompt issue
- workflow issue
- skill issue
- runner issue
- storage/metadata issue
- DOCX preservation issue
- evidence integrity issue

Update the smallest responsible layer. Do not use sample failures as a reason to fake evidence.

## Current Replay Status

- `samples:check` is the structural gate.
- `samples:run -- --mode=local-fixture 002-real-run-screenshot-workflow` replays the Python command-output screenshot fixture.
- `samples:run -- --mode=local-fixture 003-browser-page-screenshot-workflow` replays the static browser screenshot fixture.
- Samples 004-010 are intentionally skipped until their replay runners are connected.
