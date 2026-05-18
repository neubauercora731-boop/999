import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { analyzeTask } from "@/lib/tasks/task-runner";
import { getErrorStatus, toErrorMessage } from "@/lib/utils";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "请先登录后再执行分析。" }, { status: 401 });
    }

    const parsedRequirement = await analyzeTask(supabase, user.id, id);
    return NextResponse.json({ parsedRequirement });
  } catch (error) {
    return NextResponse.json(
      { error: toErrorMessage(error) || "任务分析失败，请稍后重试。" },
      { status: getErrorStatus(error, 400) },
    );
  }
}
