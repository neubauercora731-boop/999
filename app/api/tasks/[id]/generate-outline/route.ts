import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateTaskOutline } from "@/lib/tasks/task-runner";
import { getErrorStatus, toErrorMessage } from "@/lib/utils";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const payload = (await _request.json().catch(() => ({}))) as {
      confirmationNotes?: string;
    };
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "请先登录后再生成大纲。" },
        { status: 401 },
      );
    }

    const outline = await generateTaskOutline(
      supabase,
      user.id,
      id,
      payload.confirmationNotes,
    );
    return NextResponse.json({ outline });
  } catch (error) {
    return NextResponse.json(
      { error: toErrorMessage(error) || "生成大纲失败，请稍后重试。" },
      { status: getErrorStatus(error, 400) },
    );
  }
}
