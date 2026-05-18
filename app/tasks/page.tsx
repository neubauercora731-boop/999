import Link from "next/link";

import {
  AppFrame,
  AppSection,
  AppShell,
  AppToolbar,
  Badge,
  ButtonLink,
  Card,
  CardDescription,
  CardTitle,
  EmptyState,
  HeroPanel,
  SectionHeader,
} from "@/components/ui";
import { requireUser } from "@/lib/auth";
import type { TaskRecord } from "@/lib/tasks/contracts";
import {
  getTaskCurrentStepLabel,
  getTaskStatusLabel,
  getTaskStatusTone,
  TASK_STATUS,
} from "@/lib/tasks/task-status";
import { listTasks } from "@/lib/tasks/repository";
import { formatDateTime, toErrorMessage } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const { supabase, user } = await requireUser();
  let tasks: TaskRecord[] = [];
  let loadError: string | null = null;

  try {
    tasks = await listTasks(supabase, user.id);
  } catch (error) {
    loadError = toErrorMessage(error);
  }

  if (loadError) {
    return (
      <AppShell>
        <AppFrame className="py-8 sm:py-10">
          <AppSection className="space-y-6 pt-0">
            <SectionHeader
              eyebrow="Tasks"
              title="我的任务"
              description="任务列表暂时无法加载。"
              action={<ButtonLink href="/tasks/new">新建任务</ButtonLink>}
            />
            <Card>
              <CardTitle>加载失败</CardTitle>
              <CardDescription className="mt-2">{loadError}</CardDescription>
            </Card>
          </AppSection>
        </AppFrame>
      </AppShell>
    );
  }

  const exported = tasks.filter((task) => task.status === TASK_STATUS.EXPORTED).length;
  const generated = tasks.filter((task) => task.status === TASK_STATUS.GENERATED).length;
  const needsConfirm = tasks.filter((task) => task.status === TASK_STATUS.ANALYZED).length;

  return (
    <AppShell>
      <AppFrame className="py-8 sm:py-10">
        <AppSection className="space-y-6 pt-0">
          <HeroPanel className="animate-rise">
            <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
              <div className="space-y-5">
                <div className="flex flex-wrap gap-2">
                  <Badge tone="primary">Workspace</Badge>
                  <Badge tone="accent">P0 Python 闭环</Badge>
                </div>
                <div className="space-y-3">
                  <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[color:var(--accent)]">
                    My Tasks
                  </p>
                  <h1 className="font-display text-5xl leading-[0.96] text-[color:var(--foreground)] sm:text-6xl">
                    从 uploaded 到 exported，
                    <span className="block text-[color:var(--primary)]">每一步都可继续处理。</span>
                  </h1>
                  <p className="max-w-2xl text-sm leading-8 text-[color:var(--muted)] sm:text-base">
                    任务状态现在围绕 P0 闭环展示：uploaded / analyzed / confirmed / generated / exported / failed。
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <ButtonLink href="/tasks/new" size="lg">
                    新建任务
                  </ButtonLink>
                  <ButtonLink href="/" size="lg" tone="secondary">
                    返回首页
                  </ButtonLink>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <Card className="bg-white/75">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">
                    Total
                  </p>
                  <p className="mt-2 text-4xl font-semibold tracking-[-0.05em]">{tasks.length}</p>
                </Card>
                <Card className="bg-white/75">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">
                    Generated
                  </p>
                  <p className="mt-2 text-4xl font-semibold tracking-[-0.05em]">{generated}</p>
                </Card>
                <Card className="bg-white/75">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">
                    Exported
                  </p>
                  <p className="mt-2 text-4xl font-semibold tracking-[-0.05em]">{exported}</p>
                </Card>
              </div>
            </div>
          </HeroPanel>
        </AppSection>

        <AppSection className="space-y-6 pt-0">
          <AppToolbar>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--accent)]">
                Current Account
              </p>
              <p className="mt-1 text-base font-semibold">{user.email}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="warning">待确认 {needsConfirm}</Badge>
              <Badge tone="success">已导出 {exported}</Badge>
            </div>
          </AppToolbar>
        </AppSection>

        <AppSection className="pt-0">
          {tasks.length === 0 ? (
            <EmptyState
              title="还没有任务"
              description="上传一份 Python 实验任务书，系统会先解析，再由你确认进入工作台。"
              actionLabel="新建任务"
              actionHref="/tasks/new"
            />
          ) : (
            <div className="grid gap-5 xl:grid-cols-2">
              {tasks.map((task) => (
                <Card key={task.id} className="flex h-full flex-col gap-5">
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={getTaskStatusTone(task.status)}>
                      {getTaskStatusLabel(task.status)}
                    </Badge>
                    <Badge tone="neutral">
                      {getTaskCurrentStepLabel(task.current_step)}
                    </Badge>
                  </div>
                  <div>
                    <CardTitle className="text-2xl">{task.title}</CardTitle>
                    <CardDescription className="mt-2">
                      {task.experiment_name || task.course_name || "等待解析实验信息"}
                    </CardDescription>
                  </div>
                  <p className="line-clamp-3 text-sm leading-7 text-[color:var(--muted)]">
                    {task.description || "暂无任务摘要"}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[1rem] border border-[color:var(--border)] bg-white/65 px-4 py-3 text-sm">
                      创建：{formatDateTime(task.created_at)}
                    </div>
                    <div className="rounded-[1rem] border border-[color:var(--border)] bg-white/65 px-4 py-3 text-sm">
                      更新：{formatDateTime(task.updated_at)}
                    </div>
                  </div>
                  <div className="mt-auto flex flex-wrap gap-3">
                    <Link
                      href={`/tasks/${task.id}/analysis`}
                      className="inline-flex items-center justify-center rounded-full border border-[color:var(--border-strong)] bg-white/75 px-5 py-2.5 text-sm font-medium transition hover:bg-white"
                    >
                      解析确认
                    </Link>
                    <Link
                      href={`/tasks/${task.id}`}
                      className="inline-flex items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--primary),var(--primary-deep))] px-5 py-2.5 text-sm font-medium text-white transition"
                    >
                      进入工作台
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </AppSection>
      </AppFrame>
    </AppShell>
  );
}
