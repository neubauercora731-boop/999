# Verification Notes

Run:

```bash
npm run samples:run -- --mode=local-fixture 013-download-filename-encoding
```

The replay checks multiple filenames:

- `当前任务报告.docx`
- `实验报告.docx`
- `数据分析实验报告.docx`
- `report.docx`
- filenames with spaces
- filenames with path separators
