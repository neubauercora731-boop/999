# 013 Download Filename Encoding

This sample verifies that DOCX download responses never put raw Chinese characters in HTTP headers.

Expected behavior:

- `Content-Disposition` is ASCII-only.
- `filename` provides an ASCII fallback such as `lab-report.docx`.
- `filename*` contains UTF-8 percent-encoded Chinese download filenames.
- Storage object names remain ASCII-safe and are not confused with display download filenames.
