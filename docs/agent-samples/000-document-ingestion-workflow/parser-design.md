# Parser Design

## detect_file_type

输入：

- `original_filename`
- `mime_type`

输出：

- `docx`
- `doc`
- `txt`
- `md`
- `pdf`
- `image`
- `unknown`

PDF 和图片第一版只识别，不解析。

## extract_raw_text

策略：

- `docx`：优先 `mammoth.extractRawText`
- `doc`：优先 `word-extractor`
- `txt/md`：直接 UTF-8 解码
- `pdf`：返回 `UNSUPPORTED_FILE_TYPE`
- `image`：返回 `UNSUPPORTED_FILE_TYPE`

安全规则：

- 不执行宏。
- 不解析或运行嵌入脚本。
- 只读取文字。
- 文件大小限制为 10MB。
- raw text 最大保留 60,000 字。

## normalize_text

清洗规则：

- 统一换行。
- 去除 `\u0000`。
- 去除行尾多余空格。
- 压缩 4 个以上连续空行为最多 3 个。
- 保留章节标题、评分标准、提交要求和实验步骤。
- normalized text 最大保留 40,000 字。

## analyze_document_structure

调用 Moonshot，将正文结构化为：

```json
{
  "title": "",
  "courseName": "",
  "taskType": "",
  "language": "",
  "explicitRequirements": [],
  "implicitRequirements": [],
  "deliverables": [],
  "reportSections": [],
  "codeRequirements": [],
  "runRequirements": [],
  "formatRequirements": [],
  "missingInfo": [],
  "riskNotes": []
}
```

要求：

- 不编造文档中没有的内容。
- 缺失信息写入 `missingInfo`。
- 风险写入 `riskNotes`。

## save_task_input

第一版不新增 schema，写入现有字段：

- `task_files.parsed_text = normalized_text`
- `task_files.metadata.document_ingestion = {...}`
- `task_inputs.task_book_text += normalized_text`
- `task_inputs.raw_payload.documentIngestion[fileId] = {...}`

## handoff_to_agent_analyze

现有 analyze 阶段会读取 `task_files.parsed_text` 和 `task_inputs.task_book_text`。因此 parse-document 成功后，用户点击“开始解析任务书”时，现有 analyze 流程会自然使用文档解析结果。

## Responsibility Boundary

### `src/lib/files.ts`

`src/lib/files.ts` 负责上传时基础文本摘录。

目标：

- 在文件刚上传时快速生成最低限度可用的文本。
- 写入 `task_files.parsed_text`。
- 写入 `task_files.metadata.text_excerpt`。
- 在任务书和模板场景下追加到 `task_inputs.task_book_text` 或 `task_inputs.template_instructions`。

它不负责：

- 调用 AI。
- 生成 `structuredTask`。
- 判断显性/隐性要求。
- 记录 parser workflow。
- 用户确认。

### `document-ingestion`

`src/lib/agent/document-ingestion/` 负责正式文档解析 workflow。

目标：

- `detect_file_type`
- `extract_raw_text`
- `normalize_text`
- `analyze_document_structure`
- `save_task_input`
- `handoff_to_agent_analyze`

它会写入：

- `task_files.parsed_text = normalized_text`
- `task_files.metadata.document_ingestion`
- `task_files.metadata.text_excerpt = normalized_text`
- `task_inputs.task_book_text += normalized_text`
- `task_inputs.raw_payload.documentIngestion[fileId]`

### `analyze`

`analyze` 负责正式 AI 任务分析，不负责底层文件解析。它可以消费 document-ingestion 的 structuredTask 和 normalizedText，但不应该重新读取 Word 文件或执行 OCR。

## Analyze Read Priority

当前推荐读取优先级：

1. `task_inputs.raw_payload.documentIngestion[*].structured_task`
2. `task_inputs.raw_payload.documentIngestion[*].normalized_text`
3. `task_inputs.task_book_text`
4. `task_files.metadata.document_ingestion.structured_task`
5. `task_files.metadata.document_ingestion.normalized_text`
6. `task_files.parsed_text`
7. `task_files.metadata.text_excerpt`
8. 用户手动输入的 `requirement_text`

实现说明：

- `context-builder` 会把 `raw_payload.documentIngestion` 中的 `structured_task` 与 `normalized_text` 拼成 `documentIngestionText`，并优先作为 `requirementText`。
- `task-runner` 的文件摘要会优先读取 `metadata.document_ingestion`，再 fallback 到 `parsed_text` 和 `metadata.text_excerpt`。
- 没有执行 parse-document 的旧任务仍会使用旧的 `parsed_text` / `text_excerpt` fallback。

## Field Usage

| Field | Writer | Purpose |
|---|---|---|
| `task_files.parsed_text` | upload excerpt 或 document-ingestion | analyze 的通用文本 fallback |
| `task_files.metadata.text_excerpt` | upload excerpt 或 document-ingestion | 兼容旧摘要和文件列表预览 |
| `task_files.metadata.document_ingestion` | document-ingestion | 保存正式解析的 raw/normalized/structured/parser_version/extracted_at |
| `task_inputs.task_book_text` | upload excerpt 或 document-ingestion | 任务书正文聚合，供 analyze 使用 |
| `task_inputs.raw_payload.documentIngestion` | document-ingestion | 按 fileId 保存结构化解析结果，供 analyze 和未来 trace 使用 |

## Why Not Merge Upload Excerpt And Formal Parsing

上传摘录和正式解析不能混成一层：

- 上传摘录要快、稳、低成本，不依赖 AI。
- 正式解析要可预览、可确认、可记录来源，需要 AI 结构化。
- 如果混在一起，用户上传文件后就会产生隐藏 AI 行为，难以解释成本、失败原因和数据来源。
- 分层后，未点击 parse-document 的任务仍可用；点击 parse-document 的任务则获得更高质量输入。

## Avoiding Duplicate Parsing

第一版允许用户重新解析同一文件，但 UI 应提示已有结果：

- 如果 `metadata.document_ingestion` 已存在，前端展示“已解析”状态。
- 用户仍可点击“解析任务书”覆盖旧结果。
- 后续可以增加 `parser_version + checksum` 判断，提示“该文件已用当前 parser 解析，可直接使用已有结果”。

## Agent Trace Source Fields

后续接入 agent_trace 时，建议记录：

- `file_id`
- `storage_path`
- `original_filename`
- `mime_type`
- `file_size`
- `checksum`
- `parser_version`
- `extracted_at`
- `extraction_method`
- `raw_text_length`
- `normalized_text_length`
- `structured_task`
- `warnings`
- `source_priority`
- `user_confirmed`
