"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge, Button, Card, CardDescription, CardTitle, StepIndicator } from "@/components/ui";
import type { ParsedRequirement } from "@/lib/ai/types";
import {
  getFriendlyApiErrorMessage,
  readJsonSafely,
  toUserFriendlyErrorMessage,
} from "@/lib/utils";

interface AnalysisPanelProps {
  taskId: string;
  initialParsedRequirement: ParsedRequirement | null;
  initialAnalysisStatus: string;
  fileCount: number;
}

const inputClass =
  "w-full rounded-[1rem] border border-[color:var(--border)] bg-white/80 px-3 py-2 text-sm outline-none focus:border-[color:var(--border-strong)] focus:ring-4 focus:ring-[color:var(--ring)]";

function emptyAnalysis(): ParsedRequirement {
  return {
    experiment_title: "",
    course_name: "",
    purpose: "",
    required_sections: [],
    coding_tasks: [],
    materials_needed: [],
    missing_info: [],
    risk_notes: [],
  };
}

function LinesEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-semibold">{label}</span>
      <textarea
        className={`${inputClass} min-h-24 resize-y`}
        value={value.join("\n")}
        onChange={(event) =>
          onChange(
            event.target.value
              .split("\n")
              .map((item) => item.trim())
              .filter(Boolean),
          )
        }
      />
    </label>
  );
}

export function AnalysisPanel({
  taskId,
  initialParsedRequirement,
  initialAnalysisStatus,
  fileCount,
}: AnalysisPanelProps) {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<ParsedRequirement>(
    initialParsedRequirement ?? emptyAnalysis(),
  );
  const [analyzing, setAnalyzing] = useState(initialAnalysisStatus === "running");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialParsedRequirement) setAnalysis(initialParsedRequirement);
  }, [initialParsedRequirement]);

  async function runAnalyze() {
    setAnalyzing(true);
    setError(null);
    try {
      const response = await fetch(`/api/tasks/${taskId}/analyze`, { method: "POST" });
      const payload = await readJsonSafely<{
        parsedRequirement?: ParsedRequirement;
        error?: string;
      }>(response.clone());
      if (!response.ok || !payload?.parsedRequirement) {
        throw new Error(await getFriendlyApiErrorMessage(response, "结构化分析失败。"));
      }
      setAnalysis(payload.parsedRequirement);
      router.refresh();
    } catch (analyzeError) {
      setError(toUserFriendlyErrorMessage(analyzeError, "结构化分析失败。"));
    } finally {
      setAnalyzing(false);
    }
  }

  async function confirm() {
    setConfirming(true);
    setError(null);
    try {
      const response = await fetch(`/api/tasks/${taskId}/confirm-analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis }),
      });
      if (!response.ok) {
        throw new Error(await getFriendlyApiErrorMessage(response, "确认解析结果失败。"));
      }
      router.push(`/tasks/${taskId}`);
      router.refresh();
    } catch (confirmError) {
      setError(toUserFriendlyErrorMessage(confirmError, "确认解析结果失败。"));
    } finally {
      setConfirming(false);
    }
  }

  const hasAnalysis = Boolean(analysis.experiment_title || initialParsedRequirement);
  const missingCount = analysis.missing_info.length;

  return (
    <div className="space-y-6">
      <StepIndicator
        steps={["上传", "解析", "确认", "生成/运行", "导出"]}
        activeStep={hasAnalysis ? 2 : 1}
        completedSteps={hasAnalysis ? 2 : 1}
      />

      {missingCount > 0 ? (
        <div className="rounded-[1.25rem] border border-[color:var(--warning)]/30 bg-[color:var(--warning-soft)] px-5 py-4 text-sm leading-7 text-[color:var(--warning)]">
          AI 识别到 {missingCount} 项缺失信息，请补充材料或在下方修改后再确认。
        </div>
      ) : null}

      <Card className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>结构化任务 JSON</CardTitle>
            <CardDescription className="mt-2">
              上传材料 {fileCount} 个。用户确认后才会进入代码生成和运行工作台。
            </CardDescription>
          </div>
          <Badge tone={hasAnalysis ? "warning" : "neutral"}>
            {hasAnalysis ? "待用户确认" : "待分析"}
          </Badge>
        </div>

        {!hasAnalysis ? (
          <div className="space-y-4">
            <Button onClick={runAnalyze} disabled={analyzing}>
              {analyzing ? "分析中..." : "开始解析任务书"}
            </Button>
            {error ? (
              <div className="rounded-[1rem] border border-[color:var(--danger)]/30 bg-[color:var(--danger-soft)] px-4 py-3 text-sm text-[color:var(--danger)]">
                {error}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm font-semibold">实验名称</span>
              <input
                className={inputClass}
                value={analysis.experiment_title}
                onChange={(event) =>
                  setAnalysis((current) => ({
                    ...current,
                    experiment_title: event.target.value,
                  }))
                }
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold">课程名称</span>
              <input
                className={inputClass}
                value={analysis.course_name}
                onChange={(event) =>
                  setAnalysis((current) => ({ ...current, course_name: event.target.value }))
                }
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold">实验目的</span>
              <textarea
                className={`${inputClass} min-h-24 resize-y`}
                value={analysis.purpose}
                onChange={(event) =>
                  setAnalysis((current) => ({ ...current, purpose: event.target.value }))
                }
              />
            </label>

            <LinesEditor
              label="报告章节"
              value={analysis.required_sections}
              onChange={(required_sections) =>
                setAnalysis((current) => ({ ...current, required_sections }))
              }
            />
            <LinesEditor
              label="所需材料"
              value={analysis.materials_needed}
              onChange={(materials_needed) =>
                setAnalysis((current) => ({ ...current, materials_needed }))
              }
            />
            <LinesEditor
              label="缺失信息"
              value={analysis.missing_info}
              onChange={(missing_info) =>
                setAnalysis((current) => ({ ...current, missing_info }))
              }
            />
            <LinesEditor
              label="风险提示"
              value={analysis.risk_notes}
              onChange={(risk_notes) =>
                setAnalysis((current) => ({ ...current, risk_notes }))
              }
            />

            <div className="space-y-3">
              <p className="text-sm font-semibold">Python 任务</p>
              {analysis.coding_tasks.map((task, index) => (
                <div
                  key={`${task.task_name}-${index}`}
                  className="grid gap-3 rounded-[1.1rem] border border-[color:var(--border)] bg-white/62 p-4"
                >
                  <input
                    className={inputClass}
                    value={task.task_name}
                    onChange={(event) =>
                      setAnalysis((current) => ({
                        ...current,
                        coding_tasks: current.coding_tasks.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, task_name: event.target.value } : item,
                        ),
                      }))
                    }
                    placeholder="任务名称"
                  />
                  <textarea
                    className={`${inputClass} min-h-20 resize-y`}
                    value={task.description}
                    onChange={(event) =>
                      setAnalysis((current) => ({
                        ...current,
                        coding_tasks: current.coding_tasks.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, description: event.target.value } : item,
                        ),
                      }))
                    }
                    placeholder="任务描述"
                  />
                  <input
                    className={inputClass}
                    value={task.expected_output}
                    onChange={(event) =>
                      setAnalysis((current) => ({
                        ...current,
                        coding_tasks: current.coding_tasks.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, expected_output: event.target.value }
                            : item,
                        ),
                      }))
                    }
                    placeholder="预期输出"
                  />
                </div>
              ))}
            </div>

            <details className="rounded-[1rem] border border-[color:var(--border)] bg-white/62 p-4">
              <summary className="cursor-pointer text-sm font-semibold">查看 JSON</summary>
              <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap text-xs leading-6">
                {JSON.stringify(analysis, null, 2)}
              </pre>
            </details>

            {error ? (
              <div className="rounded-[1rem] border border-[color:var(--danger)]/30 bg-[color:var(--danger-soft)] px-4 py-3 text-sm text-[color:var(--danger)]">
                {error}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <Button onClick={confirm} disabled={confirming}>
                {confirming ? "保存确认中..." : "确认无误，进入生成"}
              </Button>
              <Button tone="secondary" onClick={runAnalyze} disabled={analyzing || confirming}>
                重新解析
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
