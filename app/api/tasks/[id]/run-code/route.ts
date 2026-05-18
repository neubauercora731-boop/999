import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { runTaskPythonCode } from "@/lib/tasks/task-runner";
import { getErrorStatus, toErrorMessage } from "@/lib/utils";

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
      return NextResponse.json({ error: "请先登录后再运行代码。" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const result = await runTaskPythonCode(
      supabase,
      user.id,
      id,
      typeof body.code === "string" ? body.code : undefined,
    );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: toErrorMessage(error) || "运行 Python 代码失败。" },
      { status: getErrorStatus(error, 400) },
    );
  }
}
