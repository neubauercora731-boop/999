# Sample Regression Plan

## Phase 1: Structural Checks

Run:

```bash
npm run samples:check
```

Checks:

- standard sample directories exist
- required files exist
- `sample.json` is parseable
- screenshot policy is internally consistent
- frontend samples require the browser runner
- Python samples require the Python runner

## Phase 2: Local Fixture Replay

Current command:

```bash
npm run samples:run -- --mode=local-fixture --all
```

Checks:

- workflow type inference
- expected runner selection
- evidence requirements
- screenshot missing behavior
- DOCX mode routing

Currently replayable:

- `002-real-run-screenshot-workflow`: Python command screenshot evidence
- `003-browser-page-screenshot-workflow`: browser page screenshot evidence
- `004-python-file-io-lab`: Python file IO
- `005-python-oop-lab`: Python OOP
- `006-python-data-analysis-lab`: CSV data analysis
- `007-frontend-basic-lab`: browser action screenshots
- `009-failed-run-recovery`: failed first run plus debug-once recovery
- `010-no-screenshot-required`: no forced screenshot
- `014-sy2-sectioned-doc-preservation-workflow`: high-value original-template preservation artifact for the `sy2.doc` paragraph-marker workflow
- `015-sy3-huffman-doc-rerun-screenshot-dedup`: accepted sy3 Huffman DOCX artifact validation, stale-context rejection, and latest-run screenshot dedup guard.
- `016-sy4-bracket-doc-caption-specificity`: accepted sy4 bracket-matching DOCX artifact validation, task-specific screenshot caption guard, and original-template preservation check.
- `017-sy5-code-block-formatting-workflow`: accepted sy5 sequence-list DOCX artifact validation, code paragraph formatting guard, screenshot media check, and original-template preservation check.

Partial:

- `008-docx-template-edge-cases`: structure exists, but local-fixture replay does not yet generate binary DOCX fixtures or execute template patch validation.

## Phase 3: Real Replay

Future server-task checks:

- parse task material
- generate code
- run code
- generate command/browser screenshots
- export DOCX
- compare exported DOCX checklist
- write quality score
