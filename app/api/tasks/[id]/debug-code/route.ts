import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { debugTaskPythonCode } from "@/lib/tasks/task-runner";
import { getErrorStatus, toErrorMessage } from "@/lib/utils";
import type { RunErrorType } from "@/lib/agent/types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
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

    const body = (await request.json().catch(() => ({}))) as {
      code?: string;
      stdout?: string;
      stderr?: string;
      errorType?: RunErrorType;
    };
    const debugResult = await debugTaskPythonCode(supabase, user.id, id, body);

    return NextResponse.json({ debugResult });
  } catch (error) {
    return NextResponse.json(
      { error: toErrorMessage(error) || "代码自动修复失败，请查看错误信息或手动调整。" },
      { status: getErrorStatus(error, 400) },
    );
  }
}
