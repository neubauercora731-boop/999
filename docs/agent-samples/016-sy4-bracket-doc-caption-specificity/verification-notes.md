# Verification Notes

Date: 2026-05-24

Website task id: `bdc513e7-cbf4-43e9-ad98-e34f3b2dcf9b`

Observed result:

- File role recognition treated `sy4.doc` as a task book.
- The uploaded file is actually an OOXML ZIP package with a `.doc` extension, so it could be patched as a DOCX package.
- Agent workflow generated Python code, ran it, captured stdout/stderr/exitCode/runtime, and generated one real `command_output_screenshot`.
- Export mode was `patch_original_docx`.
- Preservation validation passed.
- Final local export: `C:\Users\87808\Desktop\sy4_website_full_flow_export.docx`.

Regression lesson:

The first sy4 export preserved the template and inserted the real screenshot, but the screenshot caption matched the generic `stack` rule and said expression evaluation. The caption and default reflection logic now checks `括号匹配` before the generic `stack` branch.

Final checks:

- `系统填写`: absent.
- `表达式求值算法执行结果`: absent.
- `括号匹配程序的实际判断结果`: present.
- `哈夫曼`: absent.
- Real screenshot media: present.
- Original teacher template snippets: present.

## Local Replay

The accepted self-contained fixture is now stored at:

`docs/agent-samples/016-sy4-bracket-doc-caption-specificity/expected-docx/sy4-bracket-final.docx`

Replay command:

```bash
npm run samples:run -- --mode=local-fixture 016-sy4-bracket-doc-caption-specificity
```

The replay inspects the DOCX package directly and checks:

- original teacher-template snippets remain present
- `【代码】`, `【运行截图】`, and `【问题及思考】` exist
- `系统填写` is absent
- unrelated Huffman / expression-evaluation wording is absent
- screenshot caption contains `括号匹配程序的实际判断结果`
- exactly one `system-run-screenshot` media file exists
