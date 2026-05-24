# E2E Test Result

## 2026-05-23 Status

This round added code-level safeguards for original-format DOCX filling:

- Task block detection is now isolated in `src/lib/reports/task-block-detector.ts`.
- Patched DOCX export now inserts only after a scored task/requirement paragraph.
- Export stops when no safe insertion point is found.
- Patched DOCX export now validates original key snippets after patching through `src/lib/reports/docx-preservation-validator.ts`.
- `.doc` remains text-analysis-only unless a safe `.docx` baseline exists.
- Missing required screenshots are labeled with `【截图缺失】`.

## Manual E2E

Manual browser E2E with a real uploaded teacher DOCX was not run in this code pass. Required manual checks before production use:

1. Upload a standard `.docx` task book with cover fields.
2. Run analysis, generate code, run-code, and screenshot generation.
3. Export DOCX with default mode.
4. Open the exported DOCX in Word/WPS.
5. Confirm the cover, class/name/student ID/course fields, original task requirements, tables, headers, footers, styles, and page breaks remain.
6. Confirm `【代码】`, `【运行结果】`, `【运行截图】`, `【结果分析】`, and `【问题及思考】` appear in the correct fill locations without the words `系统填写`.
7. Confirm real screenshots are inserted or `【截图缺失】` is present.

## Current Limitation

The preservation validator is text-snippet based. It catches major content loss and missing fill labels, but it is not a pixel-perfect layout renderer. Visual DOCX rendering should be added before production-scale acceptance.

## 2026-05-23 Strict Export Hardening

- `.doc` export now attempts LibreOffice/soffice conversion to a `.docx` baseline; if conversion is unavailable or fails, export stops with a Chinese error and does not generate a fake preserved DOCX.
- Silent fallback from an original task book to `generated_report_docx` is blocked. Generated DOCX is only available as explicit non-original-format export or when no original task book exists.
- System-filled output is required to use Chinese labels and Chinese explanations by default.
- The `sy.doc + sy1.csv` case should therefore parse and run, but must not produce a fake original-format export unless `.doc` conversion succeeds or the user uploads a standard `.docx` template.

## 2026-05-23 sy.doc + sy1.csv Website Full Flow

A real authenticated website flow was run with the user's files:

- Task book: `C:\Users\87808\Desktop\sy.doc`
- Dataset: `C:\Users\87808\Desktop\sy1.csv`
- Website task id: `d067b88a-48ff-4566-a825-294a45a8618d`
- Exported file: `C:\Users\87808\Desktop\sy_website_full_flow_export.docx`
- Validation file: `C:\Users\87808\Desktop\sy-website-validation\validation-ascii.json`

Result:

- `sy.doc` was converted through LibreOffice Portable `soffice.com` into a `.docx` baseline, then patched.
- Export actual mode was `patch_original_docx`; no generated-report fallback was used.
- Original page count was preserved: baseline PDF 9 pages, exported PDF 9 pages.
- The exported DOCX preserved key original content: `??????`, `????`, `????`, `?????`, task title, `?????????`, `?????`, `????`, and `??????`.
- The implementation/result right cell contains only `???????????`, a real command-output screenshot, and a Chinese caption.
- The implementation/result cell does not contain `?????????` or `???????????` text blocks.
- The original red instruction text in the implementation/result cell was removed as required by the teacher template.
- The `?????` right cell contains only the reflection text block.
- The exported DOCX contains the original image media plus the generated PNG screenshot media and a relationship entry for the PNG.

Regression lesson:

- Some teacher templates require screenshot-only evidence rather than pasted code. For templates with `?????????` and `?????` table rows, use `screenshot_only_table` fill mode and target the right-hand cells directly.
- Do not insert full generated code or stdout text into the document body when the template explicitly says the result should be displayed as screenshots with text explanation.
- `.doc` preservation depends on safe conversion to a `.docx` baseline. If conversion is unavailable or fails, stop instead of producing a fake preserved export.

## 2026-05-23 sy2.doc Website Full Flow

A real authenticated website flow was run with the user's `sy2.doc` file:

- Task book: `C:\Users\87808\Desktop\sy2.doc`
- Website task id: `95410bd3-612c-4b25-8de5-603015f90a7a`
- Exported file: `C:\Users\87808\Desktop\sy2_website_full_flow_export.docx`
- Validation folder: `C:\Users\87808\Desktop\sy2-website-validation\`

Result:

- `sy2.doc` was converted through LibreOffice Portable `soffice.com` into a `.docx` baseline, then patched by the website.
- Export actual mode was `patch_original_docx`; no generated-report fallback was used.
- The source template has no Word tables, so the website added a new `sectioned_lab_report` fill mode for paragraph-marker templates.
- The mode fills three independent markers:
  - `实验代码：` receives `【代码】` plus generated Python code.
  - `实验结果与分析：（附上运行结果截图）` receives the real command-output screenshot and a Chinese caption.
  - `问题及思考：` receives `【问题及思考】` content.
- Original key content remained present after export, including the cover/course report title, `教学与研究部 制`, `指导老师`, `实验名称：栈的应用`, `一、实验要求`, `二、实验目的`, `三、实验内容及原理`, `四、实验设备及实验步骤`, `五、实验步骤`, `实验代码`, `实验结果与分析`, and `问题及思考`.
- The exported DOCX contains the original media plus the generated real screenshot media.
- The output naturally expanded from 4 rendered pages to 7 rendered pages because full generated code was appended. This is acceptable for this sample because original content was not deleted, consumed, or rewritten.

Regression lesson:

- Original-format preservation means original content and structure are immutable; it does not require forcing appended answers into the original page count.
- Do not delete teacher-provided content to make appended code or screenshots fit the old pagination.
- Paragraph-marker templates need marker-specific fills instead of a single generic append point.
