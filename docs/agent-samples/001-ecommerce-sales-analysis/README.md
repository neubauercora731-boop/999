# 001 Ecommerce Sales Analysis

## Sample Name

电商销售数据综合分析（8 大方法实战）

## Sample Type

`python_file_io_lab`

候选扩展类型：`python_data_analysis_csv_lab`

## Why This Sample Is Valuable

这个样本覆盖了实验报告自动化助手中非常典型的一类任务：用户提供任务书和 CSV 数据，系统需要理解分析要求、生成 Python 代码、真实运行、保存 stdout/stderr、生成图表截图，并把运行结果转化为实验报告。

它特别适合用来验证网站的这些能力：

- CSV 编码识别。
- 数据质量检查。
- Python 数据分析代码生成。
- 真实运行与失败修复。
- 图表产物保存。
- 报告基于真实结果生成。
- agent_trace 和 workflow_pattern 沉淀。

## Extracted Workflow Pattern

`python_data_analysis_csv_lab`

## Completeness

当前样本基本完整。

已包含：

- 原始任务摘要。
- 脱敏任务理解。
- 执行计划。
- 生成代码。
- 真实运行记录。
- 首次失败与一次 debug。
- stdout/stderr。
- 图表截图和代码截图。
- 最终报告。
- agent_trace。
- workflow pattern 候选。
- 自动化分析。
- 质量评分。

## Missing Or Optional Materials

- 未生成学校模板 DOCX。
- 未复制原始 `.doc` 和旧 `.docx`，因为旧成果含个人信息。
- 当前环境未安装 `seaborn` 和 `statsmodels`，代码使用 fallback 完成真实运行。

## Key Files

- `generated-code/main.py`
- `run-result.md`
- `final-report.md`
- `agent-trace.json`
- `workflow-pattern-candidate.json`
- `outputs/screenshot-code-implementation.png`
- `outputs/figure-01-data-quality.png`
- `outputs/figure-02-descriptive-distribution.png`
- `outputs/figure-03-category-structure.png`
- `outputs/figure-04-province-channel-comparison.png`
- `outputs/figure-05-regression-and-monthly-trend.png`
- `outputs/figure-06-time-series-decomposition.png`
