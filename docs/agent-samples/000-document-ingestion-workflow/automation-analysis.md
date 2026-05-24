# Automation Analysis

## Program-Automated Steps

- Detect file type from extension and MIME type.
- Infer file role from filename, extension, and MIME type.
- Let the UI default to the most likely parse-supported task-book file.
- Download the selected file from Supabase Storage.
- Extract text with `mammoth`, `word-extractor`, or direct text decoding.
- Fallback from broken/non-standard `.docx` to `word-extractor`.
- Normalize whitespace and truncate overly long text.
- Extract JSON from model text.
- Normalize model field aliases and coerce loose arrays.
- Validate structured task shape with Zod.
- Build deterministic structured fallback when AI JSON is unusable.
- Save parser metadata, text, structured task, warnings, and selected role.
- Hand off saved document-ingestion data to analyze.

## AI-Assisted Steps

- Identify the experiment title, course name, task type, and programming language.
- Separate explicit and implicit requirements.
- Extract deliverables, report sections, code requirements, run requirements, and format requirements.
- Identify missing information and risk notes.
- Produce the later formal analysis / task plan based on document-ingestion context.

## User-Confirmed Steps

- Choose which uploaded file is the task book.
- Confirm low-confidence role inference, such as a file named `888.docx`.
- Review text preview and structured task before analyze.
- Confirm or edit the final analysis JSON before entering the workbench.

## Stable Fallbacks

- Non-standard `.docx`: fallback from `mammoth` to `word-extractor`.
- AI JSON drift: fallback from strict model output to extracted JSON plus normalization.
- AI structure failure: fallback to deterministic structured task based on normalized text.
- Older local Supabase schema: compatibility writes avoid missing `parsed_text` / `docx_url` columns and map newer statuses/run types to older enum values when needed.

## Agent Trace Fields To Add Later

- `uploaded_file_count`
- `candidate_files`
- `inferred_role`
- `role_confidence`
- `role_reason`
- `selected_task_book_file_id`
- `selection_source`
- `parse_supported`
- `extraction_method`
- `raw_text_length`
- `normalized_text_length`
- `ai_structure_source`
- `fallback_used`
- `warnings`
- `save_targets`
- `analyze_source_priority`

## Website Module Mapping

| Module | Role |
|---|---|
| `analyze` | Use `documentIngestion.structured_task` and normalized text before older fallbacks. |
| `plan` | Convert confirmed requirements into executable lab steps. |
| `generate-code` | Generate code from confirmed analysis. |
| `run-code` | Run code and capture real stdout/stderr. |
| `debug-code` | Repair once based on real stderr when applicable. |
| `generate-report` | Generate report from confirmed requirements, code, and real run results. |
| `evaluate` | Later quality scoring for consistency and evidence. |
| `save-report` | Save user-confirmed report draft. |
| `export-docx` | Export final report to DOCX. |
