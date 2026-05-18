import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { confirmTaskAnalysis } from "@/lib/tasks/task-runner";
import { parsedRequirementSchema } from "@/lib/validators/parsed-requirement";
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
      return NextResponse.json({ error: "请先登录后再确认解析结果。" }, { status: 401 });
    }

    const body = await request.json();
    const analysis = parsedRequirementSchema.parse(body.analysis);
    const confirmed = await confirmTaskAnalysis(supabase, user.id, id, analysis);
    return NextResponse.json({ analysis: confirmed });
  } catch (error) {
    return NextResponse.json(
      { error: toErrorMessage(error) || "确认解析结果失败。" },
      { status: getErrorStatus(error, 400) },
    );
  }
}
