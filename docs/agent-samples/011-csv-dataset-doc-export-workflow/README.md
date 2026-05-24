# CSV Dataset DOCX Fallback Workflow

This sample verifies that CSV is treated as a dataset, not a task-book parse target. The expected export mode is `generated_report_docx` because the fixture does not provide a patchable `.docx` template.

Value:
- Task-book text and CSV dataset are separated.
- Python code reads the real `data.csv` file from the runner working directory.
- Command-output screenshot evidence is generated from real stdout/stderr.
- DOCX export can fall back to generated report mode when no `.docx` template exists.
