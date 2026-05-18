import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generatePythonCode } from "@/lib/tasks/task-runner";
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
      return NextResponse.json({ error: "请先登录后再生成代码。" }, { status: 401 });
    }

    const code = await generatePythonCode(supabase, user.id, id);
    return NextResponse.json({ code });
  } catch (error) {
    return NextResponse.json(
      { error: toErrorMessage(error) || "生成 Python 代码失败。" },
      { status: getErrorStatus(error, 400) },
    );
  }
}
