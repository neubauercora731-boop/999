import { NextResponse } from "next/server";

import {
  createAgentWorkflowSkeleton,
  runAgentWorkflowOrchestrated,
  type RunAgentWorkflowMode,
} from "@/lib/agent/workflow-orchestrator";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTaskDetail } from "@/lib/tasks/repository";
import { getErrorStatus, toErrorMessage } from "@/lib/utils";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function collectTaskText(taskDetail: Awaited<ReturnType<typeof getTaskDetail>>) {
  if (!taskDetail) return "";
  return [
    taskDetail.task.title,
    taskDetail.task.description,
    taskDetail.input?.task_book_text,
    taskDetail.input?.requirement_text,
    taskDetail.input?.student_notes,
  ]
    .filter(Boolean)
    .join("\n");
}

function collectFileRoles(taskDetail: NonNullable<Awaited<ReturnType<typeof getTaskDetail>>>) {
  return taskDetail.files.map((file) => {
    const metadata = file.metadata ?? {};
    return String(metadata.file_role ?? metadata.inferred_file_role ?? file.file_type);
  });
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      mode?: RunAgentWorkflowMode;
      dryRun?: boolean;
      allowDebugOnce?: boolean;
      allowBrowserScreenshot?: boolean;
      allowDocxExport?: boolean;
      forceRerun?: boolean;
    };
    const mode = body.mode ?? "full";
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "请先登录后再运行 Agent workflow。", code: "AUTH_REQUIRED" },
        { status: 401 },
      );
    }

    const taskDetail = await getTaskDetail(supabase, user.id, id);
    if (!taskDetail) {
      return NextResponse.json(
        {
          error: "找不到该任务，或你没有权限访问它。",
          code: "TASK_NOT_FOUND",
        },
        { status: 404 },
      );
    }

    const commonInput = {
      taskId: id,
      mode,
      allowDebugOnce: body.allowDebugOnce ?? true,
      allowBrowserScreenshot: body.allowBrowserScreenshot ?? false,
      allowDocxExport: body.allowDocxExport ?? true,
      forceRerun: body.forceRerun ?? false,
      taskText: collectTaskText(taskDetail),
      fileRoles: collectFileRoles(taskDetail),
      parsedRequirements: taskDetail.task.parsed_requirement_json,
    };

    if (body.dryRun === false) {
      const result = await runAgentWorkflowOrchestrated(supabase, {
        ...commonInput,
        userId: user.id,
        dryRun: false,
      });
      return NextResponse.json({ ...result, dryRun: false });
    }

    return NextResponse.json({
      ...createAgentWorkflowSkeleton(commonInput),
      dryRun: true,
      message:
        "Agent workflow dry run has been created. Send { dryRun: false } to execute the workflow.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: toErrorMessage(error) || "Agent workflow 运行失败，请稍后重试。",
        code: "AGENT_RUN_FAILED",
      },
      { status: getErrorStatus(error, 500) },
    );
  }
}
