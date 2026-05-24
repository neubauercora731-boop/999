# lab-docx-delivery-workflow

## Sectioned Teacher-Template Fill Rule

The `sy2.doc` acceptance sample is now the reference workflow for paragraph-marker teacher templates:

- keep all original teacher text, markers, page content, media, and layout intact;
- fill code content under `实验代码`;
- fill the real run screenshot plus a short Chinese caption under `实验结果与分析`;
- fill reflection text under `问题及思考`;
- generated code may be long and may add pages, but it must not consume or delete original document content;
- final delivered DOC/DOCX labels must be concise, such as `【代码】`, `【运行截图】`, and `【问题及思考】`;
- the words `系统填写` must not be inserted into the delivered document.

Regression sample: `docs/agent-samples/014-sy2-sectioned-doc-preservation-workflow/`.

## Universal Original-Document Preservation Default

This workflow must protect every original DOC/DOCX element by default. The rule is not limited to examples such as `项目任务书`, `项目计划`, `填表说明`, cover pages, or teacher requirements. It applies to all original paragraphs, table labels, table cells, notes, instructions, pictures, headers, footers, page breaks, numbering, styles, media, and section order.

Default export behavior:

- `preserveOriginalDocument = true`
- `rewriteWholeDocument = false`
- `insertionMode = append_under_task`
- `originalDocumentPolicy = immutable_except_explicit_fill_cells`

Allowed writes:

- Append system-generated content under a reliably identified task/question/requirement block.
- Fill a corresponding answer cell only after matching the left-hand label or table structure with high confidence.
- Replace existing placeholder/instruction text only when it is inside the fillable answer area and explicitly says that the placeholder/instruction text should be removed before submission.
- For paragraph-marker templates, fill each marker separately. Examples: append code under `实验代码`, insert real screenshots plus a short caption under `实验结果与分析`, and fill reflection under `问题及思考`.
- Appended code or screenshots may naturally add pages. This is acceptable when the original content remains present and unchanged; never delete or rewrite teacher-provided content just to preserve the original page count.

Stop conditions:

- No reliable insertion point.
- A patch would delete or rewrite original source content.
- Preservation validation detects missing source snippets from the beginning, middle, end, or known section labels.
- `.doc` conversion to a safe `.docx` baseline fails.

## 目标

把“从上传老师任务书 DOC/DOCX 到最终交付 DOCX 文件”的过程标准化，保证交付物基于真实代码和真实运行证据，同时尽量保留原始任务书格式。

核心约束：

- `preserve_original_docx = true`
- `rewrite_whole_document = false`
- `insertion_mode = append_under_task`
- 不改首页封面。
- 不改老师原始任务要求。
- 不伪造 stdout、stderr、运行截图或运行结果。
- 任务要求截图时，必须插入真实截图或明确标记 `【截图缺失】`。

## DOC/DOCX 输入策略

- 标准 `.docx`：默认进入 `patch_original_docx`，只 patch OOXML 包中的必要部分，不能重写整份文档。
- `.doc`：可以用 `word-extractor` 提取文本用于分析；原格式保护导出必须先用 LibreOffice/soffice 安全转换出 `.docx` baseline，再进入 patch。没有转换能力或转换失败时返回中文错误，请用户上传标准 `.docx`，不得生成伪原格式文档。
- 非标准 `.docx`：如果不能作为 zip/OOXML 打开，只能用于文本分析；不得输出“假原格式保护”文档。
- 无原始任务书：可以生成新版 DOCX，但必须标记为 `generated_report_docx`，不能声称保留老师模板。
- 有原始任务书时，`generated_report_docx` 不得作为静默兜底；只有用户显式选择“生成新版 DOCX（非原格式）”或测试模式时才允许。
- 系统追加内容默认必须使用中文标签、中文运行说明、中文截图说明和中文结果分析，除非原任务明确要求英文。

## 标准 DOCX Patch 流程

1. 读取原始 DOCX zip 包。
2. 保留 `[Content_Types].xml`、`_rels/`、`docProps/`、`word/styles.xml`、`word/numbering.xml`、headers/footers、media、theme 等原有资源。
3. 主要只修改 `word/document.xml`。
4. 插入真实图片时才新增 `word/media/*`、`word/_rels/document.xml.rels` relationship，并补充 PNG content type。
5. 不删除原有 XML 节点。
6. 导出后运行原文关键片段校验。

## 任务块定位策略

优先在包含 `任务`、`实验内容`、`实验要求`、`任务要求`、`题目`、`编程题`、`代码`、`运行结果`、`运行截图`、`截图`、`请完成`、`请编写`、`请实现`、`第1题`、`第一题` 的段落下方追加内容。

不得插入到封面、目录、班级/姓名/学号/课程名栏、教师评分栏或老师原任务要求之前。如果无法可靠定位，返回 `无法安全定位任务填写位置，请用户确认插入位置。`

段落式实验报告模板要优先识别并分区填充：

- `实验代码`：只追加代码内容，不移动后续原文标签。
- `实验结果与分析` / `运行结果截图`：插入真实运行截图和中文说明。
- `问题及思考`：填写思考内容；只有明确的占位句可被替换，标签本身必须保留。

## 插入内容规则

插入块必须使用：

- `【代码】`
- `【运行结果】`
- `【运行截图】`
- `【结果分析】`
- `【问题及思考】`
- `【截图缺失】`

代码必须来自当前 generate-code，运行结果必须来自真实 run-code，截图必须来自真实 `command_output_screenshot` 或 `browser_page_screenshot`。

## 导出前后校验

导出后必须确认：

- 原文关键片段仍存在。
- 封面和任务要求关键文本仍存在。
- 原文文本长度没有大幅减少。
- 新文包含 `【代码】`、`【运行截图】`、`【问题及思考】` 等填写标签或 `【截图缺失】`。
- 如果校验失败，阻止输出破坏格式的 DOCX。

## 适用场景

- 用户上传老师提供的实验任务书 DOCX，并要求在原文档中完成填写。
- 用户上传报告模板，希望保留模板结构后追加代码、运行结果、分析和截图。
- Python、SQL、前端基础实验等需要代码、真实运行结果和报告整理的任务。
- 需要沉淀 agent_trace、e2e-test-result、failure cases 的正式样本。

## 不适用场景

- 用户只需要一份全新排版的报告，不要求保留原 DOCX 格式。
- 原文件不是可安全解析或可安全 patch 的 DOCX。
- 任务要求自动提交学校系统、伪造截图、伪造运行结果或其他不合规行为。
- 插入位置无法可靠判断，且用户未确认插入点。

## 输入材料

- 原始任务书 DOCX。
- 报告模板。
- 数据文件，例如 CSV、XLSX、JSON、TXT。
- 截图或图片材料。
- 已有代码文件。
- 参考资料。
- 用户补充要求。

## 阶段 1：文件接收与角色识别

步骤：

- `infer_file_role`
- `select_task_book`
- `detect_unsupported_files`

输出：

- `task_book`
- `report_template`
- `dataset`
- `screenshot`
- `source_code`
- `reference`

规则：

- 多文件场景不能默认盲目解析第一个文件。
- 默认选择推荐角色为 `task_book` 且支持解析的文件。
- 数据文件、截图、代码文件不能自动进入任务书解析 workflow。
- 如果用户选择的文件看起来不像任务书，应给出 warning。

## 阶段 2：文档解析 document-ingestion

步骤：

- `detect_file_type`
- `extract_raw_text`
- `fallback_extract_with_word_extractor`
- `normalize_text`
- `call_moonshot_structure`
- `normalize_structured_task`
- `fallback_structured_task`
- `save_task_input`

要求：

- DOCX 优先用标准 DOCX 解析；遇到非标准 ZIP 结构时，允许 fallback 到 `word-extractor`。
- DOC 使用 `word-extractor`。
- TXT/MD 直接读取文本。
- PDF 和图片第一版只返回中文暂不支持，不伪造 OCR 结果。
- Moonshot 结构化失败时，应进入规则 fallback，而不是让整个解析流程直接失败。
- 保存 raw text、normalized text、structured task、parser version 和 warnings。

## 阶段 3：任务分析 analyze

步骤：

- 读取 document-ingestion 结果。
- 识别任务类型。
- 识别截图要求。
- 识别代码要求。
- 识别报告章节。
- 识别交付要求。

读取优先级：

1. `task_inputs.raw_payload.documentIngestion.structuredTask`
2. `task_inputs.raw_payload.documentIngestion.normalizedText`
3. `task_inputs.task_book_text`
4. `task_files.parsed_text`
5. `task_files.metadata.text_excerpt`
6. 用户手动输入 requirement

## 阶段 4：代码生成 generate-code

要求：

- 代码必须能运行。
- 默认不使用 `input()`，除非任务明确要求交互输入。
- 优先使用任务书数据、上传数据或内置示例数据。
- 必须输出文件名。
- 必须输出运行命令。
- 不能写死虚假的运行结果。

## 阶段 5：真实运行 run-code

要求：

- 运行真实代码。
- 保存 stdout。
- 保存 stderr。
- 保存 exitCode。
- 保存 durationMs。
- 如果失败，允许 debug 一次。
- 不允许伪造运行结果。
- 报告中不能把失败结果写成成功。

## 阶段 6：真实运行截图 screenshot

要求：

- 如果 `screenshotRequired = true`，必须尝试生成截图。
- `command_output_screenshot` 必须基于真实 stdout/stderr、命令、exitCode、durationMs 和生成时间。
- `browser_page_screenshot` 必须基于真实浏览器渲染页面。
- 如果没有截图，必须标记 `【截图缺失】`。
- 不允许 AI 生成假截图。
- 不允许把纯文字描述冒充真实截图。

## 阶段 7：报告内容生成 generate-report

要求：

- 报告必须引用真实运行结果。
- 不能写“运行成功”，除非 `run-code` 确实成功。
- 如果截图缺失，报告必须说明。
- 分析内容必须和代码、stdout、stderr 对应。
- 报告内容是可复核草稿，不应承诺成绩或提交结果。

## 阶段 8：原 DOCX 填充 template-preserving-docx-fill

要求：

- 不重写整份 DOCX。
- 不修改封面。
- 不修改老师任务要求。
- 不删除原段落。
- 只在任务下方插入：
  - `【代码】`
  - `【运行结果】`
  - `【结果分析】`
  - `【运行截图】`
  - `【问题及思考】`
  - `【截图缺失】`
- 如果找不到插入点，必须请求用户确认。
- 必须尽量保留 `styles.xml`、`numbering.xml`、headers、footers、media、分页和表格结构。

## 阶段 9：导出验收

检查：

- 原文关键内容仍存在。
- 封面仍存在。
- 任务要求仍存在。
- 新增内容包含 `【代码】`、`【运行截图】`、`【问题及思考】` 等填写标签。
- 运行结果来自真实 stdout/stderr。
- 截图要求已处理。
- 文件可打开。
- 导出日志记录 export mode、warnings 和验收结果。

## 阶段 10：文档沉淀

输出：

- `agent_trace`
- `e2e-test-result`
- `workflow warnings`
- `failure cases`

沉淀要求：

- 记录任务书来源、文件角色选择、解析器、AI 结构化来源、fallback 是否触发。
- 记录生成代码、运行命令、stdout/stderr、exitCode、debug 是否触发。
- 记录截图是否要求、是否生成、是否缺失。
- 记录 DOCX 是否走 template-preserving patch 模式。
- 记录无法自动化、需要用户确认的步骤。
