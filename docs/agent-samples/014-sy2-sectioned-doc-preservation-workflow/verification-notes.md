# Verification Notes

The accepted delivery artifact was produced through the website task flow and then refreshed after the label cleanup so that the final DOCX no longer contains `系统填写`.

Stored artifacts:

- Original task template: `input-files/sy2.doc`
- CSV support file, if present locally: `input-files/sy1.csv`
- Accepted DOCX delivery artifact: `expected-docx/大数据2404张毅198.docx`

Local replay checks:

```bash
npm run samples:run -- --mode=local-fixture 014-sy2-sectioned-doc-preservation-workflow
```

The replay validates the DOCX package directly:

- no `系统填写`;
- required concise labels exist;
- original teacher snippets exist;
- at least one screenshot media file exists.
