# DOCX Download Header Checklist

- `Content-Disposition` contains `attachment`.
- `Content-Disposition` contains `filename="lab-report.docx"`.
- `Content-Disposition` contains `filename*=UTF-8''`.
- `Content-Disposition` contains no raw Chinese characters.
- Chinese display filename is preserved through UTF-8 percent encoding.
