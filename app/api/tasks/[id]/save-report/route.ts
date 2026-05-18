import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { saveReportDraft } from "@/lib/tasks/task-runner";
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
      return NextResponse.json({ error: "请先登录后再保存报告草稿。" }, { status: 401 });
    }

    const body = await request.json();
    if (typeof body.markdown !== "string" || !body.markdown.trim()) {
      return NextResponse.json({ error: "报告草稿不能为空。" }, { status: 400 });
    }

    const reportMarkdown = await saveReportDraft(supabase, user.id, id, body.markdown);
    return NextResponse.json({ reportMarkdown });
  } catch (error) {
    return NextResponse.json(
      { error: toErrorMessage(error) || "保存报告草稿失败。" },
      { status: getErrorStatus(error, 400) },
    );
  }
}
