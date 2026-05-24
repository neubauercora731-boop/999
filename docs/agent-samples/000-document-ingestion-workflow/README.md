# 000 Document Ingestion Workflow

This system capability sample records how the site turns uploaded Word/text task books into structured requirements for the lab-report agent workflow.

## Current Status

- Local auth: fixed and verified.
- Backend document-ingestion: implemented.
- Frontend parse preview: implemented on `/tasks/[id]/analysis`.
- File role inference and user selection: implemented.
- Non-standard `.docx` fallback: implemented and verified with `888.docx`.
- Moonshot structure fallback: implemented.
- Analyze handoff: verified locally.
- Workbench handoff after user confirmation: verified locally.

## Workflow

```text
detect_file_type
-> infer_file_role
-> select_task_book
-> extract_raw_text
-> fallback_extract_with_word_extractor
-> normalize_text
-> call_moonshot_structure
-> extract_json_from_model_text
-> normalize_structured_task
-> fallback_structured_task
-> save_task_input
-> handoff_to_agent_analyze
```

## Supported File Types

Supported for task-book text extraction:

- `docx`
- `doc`
- `txt`
- `md`

Not supported in the first version:

- `pdf`: returns a Chinese unsupported message.
- `image`: returns a Chinese OCR-unsupported message.
- `csv/xlsx/xls/json`: treated as datasets, not task books.
- source code files: treated as code materials, not task books.

## Important Boundaries

- `src/lib/files.ts` handles upload-time lightweight text excerpt fallback.
- `src/lib/agent/document-ingestion/*` handles formal parsing, normalization, AI structure, warnings, and save targets.
- `analyze` should prefer document-ingestion results, then fall back to task-book text, file excerpts, and manual requirement text.

## Local E2E Verification

Verified on 2026-05-21 with `888.docx`.

Key result:

- `mammoth` could not parse the file as a standard docx.
- `word-extractor` fallback succeeded.
- `parse-document` returned 200.
- UI stopped loading and showed preview.
- `task_files.metadata.document_ingestion` and `task_inputs.raw_payload.documentIngestion` were written.
- `analyze` used `[document-ingestion structured_task]`.
- User confirmation entered `/tasks/[id]` workbench.

See [e2e-test-result.md](./e2e-test-result.md).

## Current Limits

- PDF parsing and OCR are intentionally not implemented yet.
- File role inference is rule-based, so vague filenames like `888.docx` need user confirmation.
- The current local Supabase schema is behind the newest migration files; code includes compatibility fallbacks, but schema alignment should be handled deliberately later.

## Next Suggestions

1. Align local/production Supabase schema with migrations in a controlled migration pass.
2. Add editable structured-task preview.
3. Add PDF text extraction.
4. Add image OCR.
5. Add `agent_trace` records for file role, selected file, extraction method, warnings, and fallback usage.
