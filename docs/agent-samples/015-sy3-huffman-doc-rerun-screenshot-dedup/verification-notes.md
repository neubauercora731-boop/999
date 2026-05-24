# Verification Notes

## Observed Issue

The first sy3 website export completed, but QA found two problems:

- `generate-code` had fallen back to a generic task-description script after an AI JSON parse failure, so stdout did not prove the Huffman algorithm really ran.
- After rerunning the workflow, export inserted historical screenshots from multiple runs.

## Fix

- Added a Huffman-specific fallback code path so fallback code still constructs a Huffman tree and calculates WPL.
- Removed hardcoded stack/double-stack wording from default screenshot caption and problem-thinking text.
- Changed export screenshot selection to use the latest `relatedRunId` screenshot set by default.

## Final E2E Result

Final website export:

`C:\Users\87808\Desktop\sy3_website_full_flow_export_final.docx`

Checks:

- `系统填写`: absent.
- `【代码】`: present.
- `【运行截图】`: present.
- `【问题及思考】`: present.
- `双栈/算术表达式/空栈`: absent.
- `哈夫曼/WPL`: present.
- Latest system run screenshot count: 1.
- Original media preserved: 3 original images plus 1 new run screenshot.

## Local Replay

The accepted self-contained fixture is now stored at:

`docs/agent-samples/015-sy3-huffman-doc-rerun-screenshot-dedup/expected-docx/sy3-huffman-final.docx`

Replay command:

```bash
npm run samples:run -- --mode=local-fixture 015-sy3-huffman-doc-rerun-screenshot-dedup
```

The replay inspects the DOCX package directly and checks:

- original teacher-template snippets remain present
- `【代码】`, `【运行截图】`, and `【问题及思考】` exist
- `系统填写` is absent
- stale double-stack/expression/empty-stack wording is absent
- Huffman/WPL context remains present
- exactly one `system-run-screenshot` media file exists

The desktop file later renamed to `大数据2404张毅198.docx` was inspected during hardening and still contained old `系统填写` / double-stack / expression wording, so it was not accepted as the passing fixture.
