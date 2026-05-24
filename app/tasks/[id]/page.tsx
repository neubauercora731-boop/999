import { notFound } from "next/navigation";

import {
  AppFrame,
  AppSection,
  AppShell,
  Badge,
  ButtonLink,
  Card,
  CardDescription,
  CardTitle,
  HeroPanel,
  SectionHeader,
  StepIndicator,
} from "@/components/ui";
import { requireUser } from "@/lib/auth";
import type { ParsedRequirement } from "@/lib/ai/types";
import { inspectScreenshotRequirement } from "@/lib/reports/screenshot-requirements";
import { getLatestParsedRequirement, getLatestReportMarkdown } from "@/lib/tasks/context";
import { getTaskDetail } from "@/lib/tasks/repository";
import {
  getTaskFlowStepIndex,
  getTaskStatusLabel,
  getTaskStatusTone,
} from "@/lib/tasks/task-status";
import { toErrorMessage } from "@/lib/utils";

import { Workbench } from "./workbench";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

function latestJsonValue<T>(
  outputs: Array<{ report_json: Record<string, unknown> | null }>,
  key: string,
) {
  for (const output of outputs) {
    const value = output.report_json?.[key];
    if (typeof value === "string") return value as T;
  }
  return "" as T;
}

export default async function TaskWorkbenchPage({ params }: PageProps) {
  const { id } = await params;
  const { supabase, user } = await requireUser();

  let detail;
  try {
    detail = await getTaskDetail(supabase, user.id, id);
  } catch (error) {
    return (
      <AppShell>
        <AppFrame className="py-8 sm:py-10">
          <AppSection className="space-y-6 pt-0">
            <SectionHeader
              eyebrow="Workbench"
              title="任务工作台加载失败"
              description="请返回任务列表，或稍后重试。"
              action={<ButtonLink href="/tasks">返回任务列表</ButtonLink>}
            />
            <Card>
              <CardTitle>错误信息</CardTitle>
              <CardDescription className="mt-2">{toErrorMessage(error)}</CardDescription>
            </Card>
          </AppSection>
        </AppFrame>
      </AppShell>
    );
  }

  if (!detail) notFound();

  const analysis = getLatestParsedRequirement(detail) as ParsedRequirement | null;
  const report = getLatestReportMarkdown(detail) || latestJsonValue<string>(detail.outputs, "report_draft");
  const code = latestJsonValue<string>(detail.outputs, "generated_code");
  const stdout = latestJsonValue<string>(detail.outputs, "stdout");
  const stderr = latestJsonValue<string>(detail.outputs, "stderr");
  const screenshotInspection = inspectScreenshotRequirement(detail);
  const flowStep = getTaskFlowStepIndex(detail.task.status);
  const taskInputSummary =
    detail.input?.requirement_text ||
    detail.input?.task_book_text ||
    detail.input?.student_notes ||
    detail.task.description ||
    "";

  return (
    <AppShell>
      <AppFrame className="py-8 sm:py-10">
        <AppSection className="space-y-6 pt-0">
          <HeroPanel className="animate-rise">
            <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
              <div className="space-y-5">
                <div className="flex flex-wrap gap-2">
                  <Badge tone={getTaskStatusTone(detail.task.status)}>
                    {getTaskStatusLabel(detail.task.status)}
                  </Badge>
                  <Badge tone="primary">Agent 工作台</Badge>
                  <Badge tone="success">真实运行证据</Badge>
                </div>
                <div className="space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--accent)]">
                    Task Workbench
                  </p>
                  <h1 className="font-display text-4xl font-semibold leading-tight text-[color:var(--foreground)] sm:text-5xl">
                    {detail.task.title}
                  </h1>
                  <p className="max-w-2xl text-sm leading-8 text-[color:var(--muted)] sm:text-base">
                    在这里完成代码生成、真实运行、截图证据、Trace、质量检查和 DOCX
                    原模板导出。系统不会伪造运行结果或截图。
                  </p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Card className="bg-white/78">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                    Files
                  </p>
                  <p className="mt-2 text-4xl font-semibold">{detail.files.length}</p>
                </Card>
                <Card className="bg-white/78">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                    Tasks
                  </p>
                  <p className="mt-2 text-4xl font-semibold">
                    {analysis?.coding_tasks.length ?? 0}
                  </p>
                </Card>
                <Card className="bg-white/78">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                    Report
                  </p>
                  <p className="mt-2 text-base font-semibold">
                    {report ? "草稿已保存" : "等待生成"}
                  </p>
                </Card>
              </div>
            </div>
          </HeroPanel>

          <StepIndicator
            steps={["上传", "解析", "确认", "生成/运行", "报告", "导出"]}
            activeStep={Math.min(flowStep, 5)}
            completedSteps={Math.min(flowStep, 5)}
          />
        </AppSection>

        <AppSection className="pt-0">
          {!analysis ? (
            <Card className="space-y-4">
              <CardTitle>请先完成结构化解析</CardTitle>
              <CardDescription>
                工作台需要已确认的 analysis_json，才能继续生成代码、运行和导出。
              </CardDescription>
              <ButtonLink href={`/tasks/${id}/analysis`}>进入解析确认页</ButtonLink>
            </Card>
          ) : (
            <Workbench
              taskId={id}
              analysis={analysis}
              initialCode={code}
              initialStdout={stdout}
              initialStderr={stderr}
              initialReport={report}
              taskInputSummary={taskInputSummary}
              initialScreenshotRequired={screenshotInspection.screenshotRequired}
              initialScreenshotMissing={screenshotInspection.screenshotMissing}
              initialScreenshotEvidenceCount={screenshotInspection.evidenceFileNames.length}
            />
          )}
        </AppSection>
      </AppFrame>
    </AppShell>
  );
}
