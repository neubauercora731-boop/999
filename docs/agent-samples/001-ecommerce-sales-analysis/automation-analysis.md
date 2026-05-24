# Automation Analysis

## A. 可以由程序自动化的步骤

- 创建样本目录结构。
- 复制不含隐私的小型 CSV 数据文件。
- 读取 CSV 并尝试多种常见编码。
- 检查缺失值、重复值、字段类型和金额一致性。
- 运行 Python 代码。
- 捕获 stdout、stderr 和退出码。
- 保存统计表 CSV。
- 生成 PNG 图表和代码截图。
- 保存 `agent-trace.json`、`workflow-pattern-candidate.json`、`quality-score.md`。
- 将报告导出为 Markdown，未来可继续导出 DOCX。

## B. 需要 AI 大模型辅助的步骤

- 从原始 `.doc` 中理解实验目标和评分重点。
- 识别旧成果中可参考内容与问题。
- 补全隐含要求，例如编码识别、样本量限制、隐私脱敏。
- 生成完整分析代码。
- 根据运行错误设计修复方案。
- 解释回归结果和业务原因。
- 生成实验报告的实施过程、结果分析、问题及思考。
- 提炼可复用 workflow pattern。
- 给出质量评分和网站改进建议。

## C. 需要用户确认的步骤

- 是否必须保留学校 Word 模板并导出 DOCX。
- 是否允许安装 `seaborn` 和 `statsmodels`。
- 是否允许复制原始 `.doc` 和旧 `.docx` 进入样本库。
- 是否需要将图表中文字全部改为中文。
- 是否需要把报告截图插入最终 DOCX。
- 是否需要严格填写学生姓名、学号、班级等模板字段。

## Website Module Mapping

| Website Module | 对应本样本步骤 |
|---|---|
| `analyze` | 读取任务书，提取实验名称、数据文件、分析方法、报告要求 |
| `plan` | 生成执行计划，判断编码、依赖、图表和报告结构 |
| `generate-code` | 生成 `main.py` |
| `run-code` | 运行 Python，捕获 stdout/stderr，保存图表 |
| `debug-code` | 缺少依赖时 fallback 或提示安装；最多修复一次 |
| `generate-report` | 基于真实运行结果生成实验报告 |
| `evaluate` | 检查任务覆盖度、代码可运行性、图表真实性和报告完整度 |
| `save-report` | 保存 Markdown 报告、运行记录和 trace |
| `export-docx` | 未来将 Markdown 报告和截图排版进 DOCX |
