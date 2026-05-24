# Template-Preserving DOC/DOCX Fill Workflow

## Goal

This workflow turns a teacher-provided task book or report template into a filled DOCX while preserving the original document as much as possible.

The system must not rebuild the whole document by default. It should keep the original cover, task requirements, page breaks, tables, headers, footers, styles, numbering, and media. Generated content is inserted only under the matched task/question/requirement location.

The preservation rule is universal. Do not protect only a known list such as `项目任务书`, `项目计划`, and `填表说明`; protect every original document element by default. Only a reliably identified fillable answer area may receive system output, and the system should append rather than rewrite unless the template explicitly marks placeholder instructions as removable.

## Current Status

- Workflow rule documented in `AGENTS.md`.
- API export mode added:
  - `patch_original_docx`: default, template-preserving mode.
  - `generated_report_docx`: explicit legacy mode that does not preserve the teacher template.
- The first implementation supports standard Office Open XML `.docx` packages.
- Non-standard `.docx` packages and `.doc` files can be used for text extraction, but are not allowed to claim original-format-preserving export unless a safe `.docx` baseline exists.
- Legacy `.doc` files must first be converted by LibreOffice/soffice into a standard `.docx` baseline. If conversion is unavailable or fails, export stops with a Chinese error instead of producing a fake preserved document.
- `generated_report_docx` must not be used as a silent fallback when an original task book exists. It is only allowed with no original task book, explicit non-original-format export, or test mode.
- Task block detection is rule-based and conservative. If no safe insertion point is found, export stops.
- Export now performs a basic preservation validation after patching.
- Screenshot requirements are detected by keywords and must result in a real PNG insertion or `【截图缺失】`.

## Inserted Content

Inserted content must use clear system labels:

- `【代码】`
- `【运行结果】`
- `【运行截图】`
- `【结果分析】`
- `【问题及思考】`
- `【截图缺失】`

The inserted blocks are appended below the detected task block. Original teacher content must remain unchanged.

## Value

This sample is valuable because real school task books often already contain cover pages, grading tables, fixed section order, and formatting rules. Rebuilding a DOCX from Markdown can destroy those requirements. This workflow makes format preservation a first-class delivery rule.

## Completeness

Current sample is partially complete:

- Standard `.docx` patching is implemented.
- Screenshot requirement detection is implemented.
- Real command/browser screenshot evidence is supported when metadata and PNG files exist.
- Multi-task precise block mapping is still rule-based and conservative.
- If the insertion point is ambiguous, the system should stop and ask the user to confirm.

## Next Steps

- Add a user-confirmed insertion point UI when multiple task blocks are detected.
- Add visual regression checks by rendering DOCX to PDF/PNG.
- Add a user-facing insertion-point confirmation UI for ambiguous templates.
