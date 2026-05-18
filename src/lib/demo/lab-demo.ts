export const demoTaskRequirement =
  "请完成一个 Python 冒泡排序实验报告，包括实验目的、实验代码、运行结果、结果分析和实验总结。";

export const demoAnalysisSteps = [
  "明确实验目标：理解冒泡排序的相邻元素比较和交换过程。",
  "拆解代码任务：实现排序函数、准备测试数据、输出排序前后结果。",
  "验证运行结果：确认列表按升序排列，并保留控制台输出作为报告证据。",
  "整理报告结构：实验目的、实验原理、代码实现、运行结果、结果分析和总结。",
];

export const demoPythonCode = `def bubble_sort(values):
    arr = values[:]
    n = len(arr)
    for i in range(n - 1):
        swapped = False
        for j in range(n - 1 - i):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
                swapped = True
        if not swapped:
            break
    return arr


sample = [64, 34, 25, 12, 22, 11, 90]
result = bubble_sort(sample)

print("排序前:", sample)
print("排序后:", result)
print("验证结果:", result == sorted(sample))`;

export const demoRunResult = [
  "排序前: [64, 34, 25, 12, 22, 11, 90]",
  "排序后: [11, 12, 22, 25, 34, 64, 90]",
  "验证结果: True",
].join("\n");

export const demoReport = `# Python 冒泡排序实验报告

## 实验目的
理解冒泡排序的基本思想，掌握使用 Python 实现基础排序算法的方法，并通过运行结果验证程序正确性。

## 实验原理
冒泡排序通过多轮比较相邻元素，将较大的元素逐步交换到序列后部。若某一轮没有发生交换，说明序列已经有序，可以提前结束。

## 实验代码
\`\`\`python
${demoPythonCode}
\`\`\`

## 运行结果
\`\`\`text
${demoRunResult}
\`\`\`

## 结果分析
输出结果显示，原始列表已经被排序为升序列表，且验证结果为 True，说明程序输出与 Python 内置排序结果一致。

## 实验总结
本实验完成了冒泡排序算法的设计、编码和运行验证。通过加入 swapped 标记，程序可以在序列提前有序时减少不必要的比较。`;
