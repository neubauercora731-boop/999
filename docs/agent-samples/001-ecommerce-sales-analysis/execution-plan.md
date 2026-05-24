# Execution Plan

| Step | Why | Input | Output | Type |
|---|---|---|---|---|
| 解析原始材料 | 明确实验目标、数据文件和报告要求 | `.doc`、CSV、旧 `.docx` | 任务摘要、显性/隐性要求 | AI 大模型辅助 |
| 检查旧成果 | 找出可借鉴结构和不能复用的问题 | 旧 `.docx` 文本 | 参考点和问题清单 | AI 大模型辅助 |
| 准备样本目录 | 保证产物可长期复用 | 项目 `docs/agent-samples/` | 样本文件夹结构 | 程序自动化 |
| 生成分析代码 | 完成 8 类分析方法 | 任务要求、CSV 字段 | `generated-code/main.py` | AI 大模型辅助 |
| 运行代码 | 获取真实 stdout/stderr 和图表 | Python 代码、CSV | stdout、stderr、PNG、CSV 表 | 程序自动化 |
| Debug 一次 | 处理运行失败并记录修复 | stderr | 修复后代码和重新运行结果 | AI 大模型辅助 + 程序自动化 |
| 生成最终报告 | 把真实输出转成实验报告 | 代码、stdout、图表 | `final-report.md` | AI 大模型辅助 |
| 生成 agent trace | 记录完整执行过程 | 全部过程信息 | `agent-trace.json` | 程序自动化 + AI 大模型辅助 |
| 提炼 workflow pattern | 为网站后续自动化沉淀流程 | 本样本流程 | `workflow-pattern-candidate.json` | AI 大模型辅助 |
| 质量评分 | 判断样本是否可进入样本库 | 交付物和运行记录 | `quality-score.md` | AI 大模型辅助 |

## User Confirmation Points

- 是否需要最终生成学校模板 DOCX。
- 是否允许安装 `seaborn` 和 `statsmodels` 以完全匹配原始环境要求。
- 是否允许复制原始 `.doc` 和旧 `.docx` 进入样本库。
- 是否需要按学校格式插入截图并排版。
