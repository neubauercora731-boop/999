---
name: lab-docx-delivery-workflow
description: Use when working on this repository's lab task-book DOCX delivery flow, especially from uploaded DOCX task book to document ingestion, code generation, real run evidence, screenshot handling, report generation, and template-preserving DOCX export.
---

# Lab DOCX Delivery Workflow

Use this skill when a task in this repository involves turning an uploaded lab task book or report template into a final DOCX deliverable.

## When To Use

- The user provides a DOCX task book, lab requirement, or report template.
- The output must be a DOCX deliverable.
- The original task book format must be preserved.
- The workflow includes code generation, `run-code`, report generation, screenshots, or DOCX export.
- The task asks for an end-to-end sample or acceptance record.

## When Not To Use

- The user only wants a standalone explanation or a new report with no original template.
- The task is unrelated to DOCX delivery.
- The user asks to fake runtime output, fake screenshots, or auto-submit to a school system.
- The insertion point in the original DOCX is unclear and the user has not confirmed where to insert content.

## Workflow

Follow the project workflow in `references/workflow.md`:

1. Infer file roles and select the task book.
2. Run document ingestion.
3. Analyze the task from parsed document evidence.
4. Generate runnable code.
5. Run real code and preserve stdout/stderr.
6. Generate real screenshots when required, or mark screenshot missing.
7. Generate report content from real evidence.
8. Fill the original DOCX in template-preserving mode.
9. Run export acceptance checks.
10. Save trace and failure notes.

## Safety Rules

- Default `preserve_original_docx = true`.
- Default `rewrite_whole_document = false`.
- Default `insertion_mode = append_under_task`.
- Treat every original document element as immutable by default. This rule applies to all teacher-provided text, tables, notes, instructions, media, headers, footers, page breaks, styles, numbering, and section order, not only obvious sections such as `项目任务书`, `项目计划`, or `填表说明`.
- Do not modify the cover page.
- Do not modify teacher-provided requirements.
- Do not delete existing paragraphs, tables, images, headers, footers, numbering, styles, or page breaks.
- Only write into a reliably identified fillable answer area. Prefer append-only behavior; replace placeholder instructions only if the source document explicitly says that placeholder text should be removed for submission.
- Do not fake stdout, stderr, run success, screenshots, or screenshots metadata.
- If screenshots are required but unavailable, insert `【截图缺失】`.
- If preserving the original DOCX is unsafe, stop and return a Chinese error instead of exporting a damaged file.

## Output Checklist

Before claiming completion, confirm:

- File roles were identified.
- The selected task book was explicit.
- Parsed document text came from a real file.
- Code was generated with filename and run command.
- Runtime evidence is real.
- Screenshot requirement was checked.
- Screenshot evidence is real or marked missing.
- DOCX export used template-preserving mode when required.
- Original cover, teacher requirements, section labels, project plans, fill instructions, and sampled source snippets across the document remain present.
- Lint/build status is reported if code changed.

## References

- `references/workflow.md`
- `references/docx-preservation-rules.md`
- `references/screenshot-rules.md`
