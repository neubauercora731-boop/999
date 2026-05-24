# Agent Samples

The sample library is the long-term regression and learning surface for Lab Report Assistant.

It is used for:

1. regression testing
2. prompt improvement
3. skill updates
4. workflow routing
5. quality scoring
6. multi-agent coordination examples

## Standard Sample Layout

New standard samples should contain:

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

Some files may be intentionally minimal. If a file is empty or not applicable, explain why in `verification-notes.md`.

## Legacy/System Samples

Existing `000-*`, `001-*`, and `002-*` directories may follow older system-capability formats. They are still useful and should not be deleted. The first `samples:check` implementation validates standard samples, starting with `003-*` and later.

## Evidence Rules

- Do not fake stdout, stderr, exit code, runtime, or screenshots.
- If screenshot evidence is required and unavailable, mark `【截图缺失】`.
- If a DOCX must preserve the original template, use `patch_original_docx`.
- If a task does not require screenshots, `expected-screenshots.json` should state `required: false`.

## High-Value Preservation Samples

- `014-sy2-sectioned-doc-preservation-workflow` records the successful website workflow for a paragraph-marker teacher template. It checks that original document snippets remain present, a real screenshot media file is preserved, generated content is placed under `实验代码`, `实验结果与分析`, and `问题及思考`, and the delivered DOCX does not contain the words `系统填写`.
- `015-sy3-huffman-doc-rerun-screenshot-dedup` records the sy3 Huffman website E2E lesson and now has a local DOCX replay. It validates the accepted artifact under `expected-docx/`, rejects stale double-stack/expression/empty-stack wording, requires Huffman/WPL context, and requires exactly one latest run screenshot.
- `016-sy4-bracket-doc-caption-specificity` records the sy4 bracket-matching website E2E lesson and now has a local DOCX replay. It validates the accepted artifact under `expected-docx/`, checks the bracket-specific screenshot caption, rejects unrelated Huffman/expression wording, and preserves the teacher template.
- `017-sy5-code-block-formatting-workflow` records the sy5 sequence-list website E2E lesson. It validates that the accepted artifact keeps teacher snippets, includes real screenshot media, omits `系统填写`, and stores inserted code as many readable/copyable paragraphs instead of one compact block.
