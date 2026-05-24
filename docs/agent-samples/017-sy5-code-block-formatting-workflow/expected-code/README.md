The generated code is validated inside the accepted DOCX artifact. The key regression is DOCX formatting, not a fixed source-code fixture.

Expected properties:

- Code appears after `【代码】`.
- Code is split across many DOCX paragraphs.
- Indentation is preserved with spaces.
- No one-paragraph compact code block is allowed.
