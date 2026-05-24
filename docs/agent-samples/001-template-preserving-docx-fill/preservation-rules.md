# DOC/DOCX Preservation Rules

## Never Modify

- The universal rule is broader than any named section: every piece of original document content is immutable by default.
- Do not treat only `项目任务书`, `项目计划`, `填表说明`, or cover fields as protected. All teacher-provided paragraphs, tables, section labels, notes, instructions, media, and layout choices are protected.
- Cover page content and layout.
- Teacher-provided task requirements.
- Original paragraphs, tables, images, headers, footers, page breaks, styles, numbering, and media files.
- Grading tables, teacher comment areas, or score fields.
- Student identity fields unless the user explicitly provides values and asks to fill them.
- Original section order.

## Allowed Insertions

The system may insert content only under a reliable task/question/requirement block:

- Generated code.
- Real stdout/stderr.
- Result analysis.
- Screenshot block with real screenshot evidence or a screenshot-missing note.

For table-based templates, the system may fill a right-hand answer cell only when the matching left-hand label has been reliably identified. The preferred behavior is append-only. Replacing existing placeholder/instruction text is allowed only when that text is inside the fillable answer cell and explicitly says it should be removed before submission.

Every inserted block must use one of these labels:

- `【代码】`
- `【运行结果】`
- `【运行截图】`
- `【结果分析】`
- `【问题及思考】`
- `【截图缺失】`

## Insertion Point Rules

Task block candidates may include paragraphs containing:

- `任务`
- `实验内容`
- `实验要求`
- `任务要求`
- `题目`
- `第1题` / `第一题` / numbered question markers
- `步骤`
- `编程题`
- `代码`
- `实现`
- `完成以下`

The system must avoid inserting into:

- Cover pages.
- Tables of contents.
- Course/student information blocks.
- Name/student-number fields.
- Teacher grading areas.
- Locations before the original task requirements.

## DOC And Non-Standard DOCX Policy

- Standard `.docx` is the only format eligible for direct original-format patching.
- `.doc` may be extracted for analysis, but cannot be patched directly. A safe `.docx` baseline is required before claiming original-format preservation; the first implementation may create that baseline with LibreOffice/soffice, and must stop if conversion is unavailable or fails.
- Non-standard or corrupted `.docx` packages may be extracted for text if possible, but original-format export must stop with a Chinese error.
- `generated_report_docx` is allowed only as a clearly labeled non-template-preserving legacy/export fallback when no original task book exists, the user explicitly chooses a new document, or a test fixture explicitly targets generated output.
- `generated_report_docx` must never be used silently after a patch failure when an original task book exists.
- All generated fill content must default to Chinese labels, Chinese run descriptions, Chinese screenshot captions, and Chinese result analysis unless the assignment explicitly requests English. Delivered DOC/DOCX labels must not contain the words `系统填写`.

## Failure Behavior

If the original file cannot be safely patched, the system must stop and return a Chinese error. It must not silently fall back to a format-damaging regenerated DOCX.

Known stop conditions:

- The file is not a standard Office Open XML `.docx` package.
- `word/document.xml` is missing.
- No reliable insertion point is found.
- Multiple insertion points require user confirmation and no confirmation exists.
- Preservation validation detects missing original key snippets after patching.

## Disqualification Criteria

A generated DOCX is not acceptable if:

- It rebuilds the whole document while pretending to preserve the original format.
- It removes or rewrites teacher content.
- It changes the cover page without explicit user instruction.
- It fabricates screenshots or runtime evidence.
- It hides screenshot requirements when screenshots are missing.
- It uses a regenerated DOCX while claiming that the original teacher template was preserved.
