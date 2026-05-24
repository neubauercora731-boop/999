# Verification Notes

This sample is a preservation regression target. It does not require Python or browser execution.

V5 replay status:

- `npm run samples:run -- --mode=local-fixture 008-docx-template-edge-cases`
- Result: partial locally.
- Reason: local-fixture mode does not yet generate binary DOCX fixtures or execute a real template-preserving patch replay.
- This sample must not be reported as passed until it includes at least one safe patch fixture and one unsafe fixture that returns a structured error.
- V7 adds an explicit fallback expectation: `.doc` / `.txt` / no-template cases should use `generated_report_docx` in `auto` mode.
