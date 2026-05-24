# 012 Run-Code Screenshot Trace Export Consistency

This sample guards the evidence propagation bug where `run-code` generates a real `command_output_screenshot`, but trace, quality evaluation, report generation, or DOCX export still treat screenshots as missing.

Expected contract:

- `run-code` returns and stores one real command screenshot.
- `run-code` trace artifacts include the screenshot.
- `generate-screenshot` trace step references the screenshot generated inside `run-code`.
- quality evaluation sets screenshot requirement handling to true.
- DOCX export can find the same screenshot evidence through canonical screenshot metadata.
