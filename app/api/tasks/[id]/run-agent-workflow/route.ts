import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { runAgentWorkflow } from "@/lib/tasks/task-runner";
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
      return NextResponse.json(
        { error: "请先登录，登录后可以保存和查看历史任务。" },
        { status: 401 },
      );
    }

    const result = await runAgentWorkflow(supabase, user.id, id);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: toErrorMessage(error) || "系统出现未知错误，请稍后重试。" },
      { status: getErrorStatus(error, 400) },
    );
  }
}
