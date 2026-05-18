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
              description="请返回任务列表或稍后重试。"
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
                  <Badge tone="accent">Python P0 Workbench</Badge>
                </div>
                <div className="space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--accent)]">
                    Task Workbench
                  </p>
                  <h1 className="font-display text-5xl leading-[0.96] text-[color:var(--foreground)] sm:text-6xl">
                    {detail.task.title}
                  </h1>
                  <p className="max-w-2xl text-sm leading-8 text-[color:var(--muted)] sm:text-base">
                    生成代码、运行代码、生成报告草稿是三个独立按钮。系统不会自动提交学校系统，也不会伪造截图。
                  </p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Card className="bg-white/74">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    Files
                  </p>
                  <p className="mt-2 text-4xl font-semibold tracking-[-0.05em]">
                    {detail.files.length}
                  </p>
                </Card>
                <Card className="bg-white/74">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    Tasks
                  </p>
                  <p className="mt-2 text-4xl font-semibold tracking-[-0.05em]">
                    {analysis?.coding_tasks.length ?? 0}
                  </p>
                </Card>
                <Card className="bg-white/74">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    Output
                  </p>
                  <p className="mt-2 text-base font-semibold">
                    {report ? "草稿已保存" : "待生成"}
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
                工作台需要用户确认后的 analysis_json 才能生成 Python 代码。
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
            />
          )}
        </AppSection>
      </AppFrame>
    </AppShell>
  );
}
