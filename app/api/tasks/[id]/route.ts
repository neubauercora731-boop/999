import { NextResponse } from "next/server";

import {
  getLatestConsistency,
  getLatestOutline,
  getLatestParsedRequirement,
  getLatestReportMarkdown,
} from "@/lib/tasks/context";
import { getTaskDetail } from "@/lib/tasks/repository";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toErrorMessage } from "@/lib/utils";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const taskDetail = await getTaskDetail(supabase, user.id, id);

    if (!taskDetail) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({
      task: taskDetail.task,
      input: taskDetail.input,
      files: taskDetail.files,
      runs: taskDetail.runs,
      steps: taskDetail.steps,
      outputs: taskDetail.outputs,
      derived: {
        parsedRequirement: getLatestParsedRequirement(taskDetail),
        outline: getLatestOutline(taskDetail),
        reportMarkdown: getLatestReportMarkdown(taskDetail),
        consistency: getLatestConsistency(taskDetail),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: toErrorMessage(error) },
      { status: 500 },
    );
  }
}
