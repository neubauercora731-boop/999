# 014 sy2 Sectioned DOC Preservation Workflow

This sample captures the successful website delivery pattern for the user's `sy2.doc` teacher template.

The important lesson is that original teacher-provided document content is immutable. The website may only fill the explicit answer areas:

- code-related content goes under `实验代码`;
- real run screenshots and their explanation go under `实验结果与分析`;
- reflection text goes under `问题及思考`;
- labels inserted into the final document must not contain the words `系统填写`.

The sample stores the original `.doc` template, the CSV support file when available, and the accepted DOCX delivery artifact exported by the website after the label cleanup.
