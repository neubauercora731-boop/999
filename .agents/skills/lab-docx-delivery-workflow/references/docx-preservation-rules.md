# DOCX Preservation Rules

## Absolute Rules

- All original document content is immutable by default. Do not limit protection to known examples like `项目任务书`, `项目计划`, or `填表说明`; protect every source paragraph, table, note, instruction, image, header, footer, page break, style, numbering definition, and section order.
- Do not rebuild the whole DOCX when the user expects the teacher's original format to remain.
- Do not modify the cover page.
- Do not modify teacher-provided requirements.
- Do not delete original paragraphs, tables, pictures, headers, footers, page breaks, styles, numbering, or media.
- Do not change user identity fields, scoring fields, or teacher comments unless explicitly requested.

## Allowed Changes

Only insert generated content under a reliably identified task/question/requirement block.

For table-based forms, only write into the corresponding fillable answer cell after matching the row/label with high confidence. Prefer appending. Replace existing placeholder/instruction text only if that text is inside the answer cell and explicitly says it should be removed before submission.

Inserted content must be clearly labeled:

- `【系统填写：代码】`
- `【系统填写：运行结果】`
- `【系统填写：结果分析】`
- `【系统填写：截图】`
- `【截图缺失】`

## Insertion Point Rules

Prefer insertion points near task body paragraphs containing:

- 任务
- 实验内容
- 实验要求
- 题目
- 第一题 / 第1题 / 1.
- 步骤
- 编程题
- 代码
- 实现
- 完成以下

Avoid inserting into:

- Cover pages.
- Table of contents.
- Course information blocks.
- Name/student-number fields.
- Teacher scoring tables.
- The area before original requirements.

## Failure Handling

If no safe insertion point exists, stop and request user confirmation.

If OOXML patching may damage the file, do not export a misleading DOCX. Return a Chinese error explaining that original-format fill mode cannot be completed safely.
