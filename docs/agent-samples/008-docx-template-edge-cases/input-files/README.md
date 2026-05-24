# DOCX Edge Case Fixtures

This sample is intentionally partial in local-fixture mode.

The replay should eventually include:
- one patchable DOCX fixture with a clear task insertion point
- one unsafe DOCX fixture with no reliable insertion point
- a validation that unsafe patch attempts return structured errors

No binary DOCX fixture is added in this pass, so the sample runner reports `partial` instead of `passed`.
