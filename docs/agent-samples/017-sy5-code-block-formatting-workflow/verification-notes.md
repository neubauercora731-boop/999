# Verification Notes

Regression added after the sy5 manual website E2E showed that code copied into the DOCX could become visually unreadable when inserted as one compact paragraph.

The replay checks the accepted website-generated DOCX artifact:

- Code paragraph count is at least 10.
- Maximum inserted code paragraph length stays below the guard threshold.
- Original teacher snippets remain present.
- Screenshot media exists.
- `系统填写` is absent.
