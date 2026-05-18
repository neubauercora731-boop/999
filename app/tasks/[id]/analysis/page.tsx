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
  SectionHeader,
} from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getLatestParsedRequirement } from "@/lib/tasks/context";
import { getTaskDetail } from "@/lib/tasks/repository";
import { getTaskCurrentStepLabel, getTaskStatusLabel, getTaskStatusTone } from "@/lib/tasks/task-status";
import { toErrorMessage } from "@/lib/utils";

import { AnalysisPanel } from "./analysis-panel";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function AnalysisPage({ params }: PageProps) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  let taskDetail = null;

  try {
    taskDetail = await getTaskDetail(supabase, user.id, id);
  } catch (error) {
    return (
      <AppShell>
        <AppFrame className="py-8 sm:py-10">
          <AppSection className="space-y-6 pt-0">
            <SectionHeader
              eyebrow="Analysis"
              title="分析确认"
              description="分析页暂时无法加载，请先回到任务列表或稍后重试。"
              action={
                <div className="flex flex-wrap gap-3">
                  <ButtonLink href="/tasks" tone="ghost">
                    返回任务列表
                  </ButtonLink>
                  <ButtonLink href={`/tasks/${id}`} tone="secondary">
                    查看任务详情
                  </ButtonLink>
                </div>
              }
            />
            <Card className="space-y-3">
              <CardTitle>加载失败</CardTitle>
              <CardDescription>{toErrorMessage(error)}</CardDescription>
            </Card>
          </AppSection>
        </AppFrame>
      </AppShell>
    );
  }

  if (!taskDetail) {
    notFound();
  }

  const parsedRequirement = getLatestParsedRequirement(taskDetail);
  return (
    <AppShell>
      <AppFrame className="py-8 sm:py-10">
        <AppSection className="space-y-6 pt-0">
          <SectionHeader
            eyebrow="Analysis"
            title="分析确认"
            description="系统会先自动整理你上传的材料，再把“是否能直接生成报告”这件事清楚地展示给你。"
            action={
              <div className="flex flex-wrap gap-3">
                <ButtonLink href="/tasks" tone="ghost">
                  返回任务列表
                </ButtonLink>
                <ButtonLink href={`/tasks/${id}`} tone="secondary">
                  查看任务详情
                </ButtonLink>
              </div>
            }
          />
        </AppSection>

        <AppSection className="pt-0">
          <div className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
            <Card className="space-y-5 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(255,247,239,0.86))]">
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Badge tone={getTaskStatusTone(taskDetail.task.status)}>
                    {getTaskStatusLabel(taskDetail.task.status)}
                  </Badge>
                  <Badge tone="neutral">
                    {getTaskCurrentStepLabel(taskDetail.task.current_step)}
                  </Badge>
                </div>
                <CardTitle className="text-2xl">{taskDetail.task.title}</CardTitle>
                <CardDescription>
                  {taskDetail.task.course_name || "课程名称将在自动分析后补齐"}
                </CardDescription>
              </div>

              <div className="grid gap-3">
                <div className="rounded-[1.15rem] border border-[color:var(--border)] bg-white/68 px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    文件数量
                  </p>
                  <p className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[color:var(--foreground)]">
                    {taskDetail.files.length}
                  </p>
                </div>
                <div className="rounded-[1.15rem] border border-[color:var(--border)] bg-white/68 px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    运行次数
                  </p>
                  <p className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[color:var(--foreground)]">
                    {taskDetail.runs.length}
                  </p>
                </div>
              </div>

              <p className="text-sm leading-7 text-[color:var(--muted)]">
                {taskDetail.task.description || "当前还没有任务摘要。"}
              </p>
            </Card>

            <AnalysisPanel
              taskId={taskDetail.task.id}
              initialParsedRequirement={parsedRequirement}
              initialAnalysisStatus={taskDetail.task.analysis_status}
              fileCount={taskDetail.files.length}
            />
          </div>
        </AppSection>
      </AppFrame>
    </AppShell>
  );
}
