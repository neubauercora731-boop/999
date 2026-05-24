# DOCX Checklist

- Headers remain.
- Footers remain.
- Numbering remains.
- Tables remain.
- Images remain.
- If no safe insertion point exists, export returns a structured error.
- If no patchable `.docx` source exists and export mode is `auto`, export falls back to `generated_report_docx` instead of `QUALITY_GATE_FAILED`.
- If mode is explicitly `patch_original_docx` and no `.docx` template exists, the API returns `NO_PATCHABLE_DOCX_TEMPLATE` with a Chinese message.
