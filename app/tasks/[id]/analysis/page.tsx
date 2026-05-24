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
import {
  getTaskCurrentStepLabel,
  getTaskStatusLabel,
  getTaskStatusTone,
} from "@/lib/tasks/task-status";
import { toErrorMessage } from "@/lib/utils";
import {
  inferFileRole,
  isParseSupported,
  type FileRole,
} from "@/lib/agent/document-ingestion/file-role";

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
                    查看工作台
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
  const rawFiles = taskDetail.files.map((file) => {
    const ingestion =
      file.metadata && typeof file.metadata.document_ingestion === "object"
        ? (file.metadata.document_ingestion as Record<string, unknown>)
        : null;
    const inferredRole = inferFileRole(file.original_filename, file.mime_type);
    const metadataRole =
      typeof file.metadata?.file_role === "string"
        ? file.metadata.file_role
        : typeof file.metadata?.inferred_file_role === "string"
          ? file.metadata.inferred_file_role
          : null;
    const role = (metadataRole ?? inferredRole.role) as FileRole;

    return {
      id: file.id,
      fileType: file.file_type,
      fileName: file.original_filename,
      mimeType: file.mime_type,
      fileSize: file.file_size,
      hasParsedText: Boolean(file.parsed_text || file.metadata?.text_excerpt),
      role,
      roleConfidence:
        typeof file.metadata?.role_confidence === "number"
          ? file.metadata.role_confidence
          : inferredRole.confidence,
      roleReason:
        typeof file.metadata?.role_reason === "string"
          ? file.metadata.role_reason
          : inferredRole.reason,
      parseSupported: isParseSupported(file.original_filename, file.mime_type),
      structuredTask:
        ingestion && typeof ingestion.structured_task === "object"
          ? (ingestion.structured_task as Record<string, unknown>)
          : null,
      normalizedTextPreview:
        typeof ingestion?.normalized_text === "string"
          ? ingestion.normalized_text.slice(0, 1200)
          : typeof file.parsed_text === "string"
            ? file.parsed_text.slice(0, 1200)
            : null,
      warnings: Array.isArray(ingestion?.warnings)
        ? ingestion.warnings.filter((item): item is string => typeof item === "string")
        : [],
    };
  });
  const parseableDocumentFiles = rawFiles.filter(
    (file) =>
      file.parseSupported &&
      file.role !== "dataset" &&
      file.role !== "screenshot" &&
      file.role !== "source_code",
  );
  const files = rawFiles.map((file) => {
    if (
      parseableDocumentFiles.length === 1 &&
      parseableDocumentFiles[0].id === file.id &&
      (file.role === "reference" || file.role === "unknown")
    ) {
      return {
        ...file,
        role: "task_book" as FileRole,
        roleConfidence: Math.max(file.roleConfidence, 0.72),
        roleReason: "当前任务只有这一份可解析文档，系统默认将它作为任务书候选。",
      };
    }

    return file;
  });

  return (
    <AppShell>
      <AppFrame className="py-8 sm:py-10">
        <AppSection className="space-y-6 pt-0">
          <SectionHeader
            eyebrow="Analysis"
            title="文件角色与任务书解析"
            description="先确认上传材料的角色，再选择真正的任务书解析。CSV/Excel 会作为数据集进入后续代码和运行上下文，不会被当作任务书。"
            action={
              <div className="flex flex-wrap gap-3">
                <ButtonLink href="/tasks" tone="ghost">
                  返回任务列表
                </ButtonLink>
                <ButtonLink href={`/tasks/${id}`} tone="secondary">
                  查看工作台
                </ButtonLink>
              </div>
            }
          />
        </AppSection>

        <AppSection className="pt-0">
          <div className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
            <Card className="space-y-5 bg-white/82">
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
                  {taskDetail.task.course_name || "课程名称会在任务书解析后补齐"}
                </CardDescription>
              </div>

              <div className="grid gap-3">
                <div className="rounded-lg border border-[color:var(--border)] bg-white/68 px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                    文件数量
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-[color:var(--foreground)]">
                    {taskDetail.files.length}
                  </p>
                </div>
                <div className="rounded-lg border border-[color:var(--border)] bg-white/68 px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                    运行次数
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-[color:var(--foreground)]">
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
              files={files}
            />
          </div>
        </AppSection>
      </AppFrame>
    </AppShell>
  );
}
