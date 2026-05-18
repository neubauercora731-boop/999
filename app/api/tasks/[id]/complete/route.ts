import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { completeTaskFlow } from "@/lib/tasks/task-runner";
import { getErrorStatus, toErrorMessage } from "@/lib/utils";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const payload = (await request.json().catch(() => ({}))) as {
      confirmationNotes?: string;
    };
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "请先登录后再生成完整报告。" },
        { status: 401 },
      );
    }

    const result = await completeTaskFlow(
      supabase,
      user.id,
      id,
      payload.confirmationNotes,
    );

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: toErrorMessage(error) || "生成完整报告失败，请稍后重试。" },
      { status: getErrorStatus(error, 400) },
    );
  }
}
