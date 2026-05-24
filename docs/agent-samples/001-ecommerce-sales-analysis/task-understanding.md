# Task Understanding

## What The Task Requires

本任务要求对电商销售 CSV 数据进行完整的数据分析实验，覆盖数据读取、清洗、统计、分组、结构、分布、对比、线性回归、时间序列趋势与预测，并形成包含代码、运行结果、图表截图和分析文字的实验报告。

## Explicit Requirements

- 使用 Python 3.x。
- 读取 `online_sales.csv`。
- 使用 `pandas`、`matplotlib`、`seaborn`、`statsmodels`。
- 检查数据完整性并转换日期。
- 对单价、销量、销售额进行描述性统计。
- 按品类、渠道、省份分组统计。
- 计算结构占比并绘制饼图。
- 绘制箱线图、柱状图、折线图、散点图等。
- 用销量预测销售额，输出简单线性回归方程。
- 按月份构建销售额时间序列并预测未来走势。
- 结果用截图展示，并配文字说明。
- 写出问题及思考。

## Implicit Requirements

- 需要先识别 CSV 编码，否则中文字段可能乱码。
- 报告结论必须来自真实运行结果。
- 图表截图必须由代码生成，不能伪造。
- 线性回归结果需要结合业务背景解释，不能只看公式。
- 时间序列只有 4 个月，预测和分解只能作为教学演示，不能过度解释。
- 旧成果只能参考结构，不能直接复制。
- 样本库记录要脱敏，不保存姓名、学号等个人信息。

## Missing Information

- 没有指定最终报告是否必须保持学校 Word 模板。
- 没有指定 Python 小版本。
- 没有指定图表中文字必须中文还是英文。
- 没有指定是否必须导出新的 DOCX。
- 没有提供更长时间跨度的数据，时间序列分析样本量不足。

## Assumptions

- 本次样本库以 Markdown、JSON、Python 代码、CSV 和 PNG 图表作为长期复用资料。
- 原始 CSV 文件体积小且不含明显个人隐私，可复制进 `original-files/` 方便复跑。
- 原始 `.doc` 和旧 `.docx` 只记录文件路径和摘要，不复制进仓库。
- 本机缺少 `seaborn` 和 `statsmodels` 时，不安装新依赖，而是在代码中保留优先使用逻辑，并用 `matplotlib` / `numpy` fallback 完成真实运行。

## Task Type

`python_file_io_lab`

补充说明：它也是一个数据分析与可视化实验，可沉淀为 `python_data_analysis_csv_lab` workflow pattern。
