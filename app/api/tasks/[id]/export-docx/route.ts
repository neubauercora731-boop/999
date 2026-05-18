import { NextResponse } from "next/server";

import { exportReportToDocx, createDocxFileName } from "@/lib/reports/docx";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getLatestReportMarkdown } from "@/lib/tasks/context";
import {
  createTaskOutput,
  createTaskRun,
  finishTaskRun,
  getTaskDetail,
  updateTaskExecutionStatuses,
} from "@/lib/tasks/repository";
import { TASK_CURRENT_STEP, TASK_RUN_TYPE, TASK_STATUS } from "@/lib/tasks/task-status";
import { toErrorMessage } from "@/lib/utils";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const runtime = "nodejs";

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "请先登录后再导出报告。" }, { status: 401 });
    }

    const taskDetail = await getTaskDetail(supabase, user.id, id);

    if (!taskDetail) {
      return NextResponse.json({ error: "任务不存在。" }, { status: 404 });
    }

    const reportMarkdown = getLatestReportMarkdown(taskDetail);

    if (!reportMarkdown) {
      return NextResponse.json(
        { error: "请先生成正文后再导出 DOCX。" },
        { status: 400 },
      );
    }

    const buffer = await exportReportToDocx(reportMarkdown);
    const fileName = createDocxFileName(
      taskDetail.task.title,
      taskDetail.task.experiment_name,
    );
    const objectPath = `${user.id}/${id}/outputs/${Date.now()}-${fileName}`;
    const adminSupabase = createSupabaseAdminClient();
    const { error: uploadError } = await adminSupabase.storage
      .from("task-files")
      .upload(objectPath, new Uint8Array(buffer), {
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: true,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const run = await createTaskRun(supabase, {
      taskId: id,
      userId: user.id,
      runType: TASK_RUN_TYPE.EXPORT_DOCX,
      modelName: "docx-export",
      inputContext: { file_name: fileName },
    });

    await createTaskOutput(supabase, {
      taskRunId: run.id,
      taskId: id,
      userId: user.id,
      reportJson: { docx_url: objectPath, file_name: fileName },
      reportMarkdown,
      docxUrl: objectPath,
    });
    await updateTaskExecutionStatuses(supabase, id, {
      status: TASK_STATUS.EXPORTED,
      currentStep: TASK_CURRENT_STEP.EXPORTED,
      lastError: null,
    });
    await finishTaskRun(supabase, run.id, { status: "success" });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: toErrorMessage(error) || "DOCX 导出失败，请稍后重试。" },
      { status: 500 },
    );
  }
}
