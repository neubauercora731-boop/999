import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  runTaskFrontendBrowserScreenshot,
  runTaskPythonCode,
} from "@/lib/tasks/task-runner";
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
    const result =
      body.runMode === "frontend_browser"
        ? await runTaskFrontendBrowserScreenshot(supabase, user.id, id, {
            files: Array.isArray(body.frontendFiles) ? body.frontendFiles : [],
            entryFile: typeof body.entryFile === "string" ? body.entryFile : "index.html",
            viewport:
              body.viewport && typeof body.viewport === "object"
                ? {
                    width:
                      typeof body.viewport.width === "number"
                        ? body.viewport.width
                        : undefined,
                    height:
                      typeof body.viewport.height === "number"
                        ? body.viewport.height
                        : undefined,
                  }
                : undefined,
            fullPage: typeof body.fullPage === "boolean" ? body.fullPage : true,
            actions: Array.isArray(body.actions) ? body.actions : undefined,
          })
        : await runTaskPythonCode(
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
