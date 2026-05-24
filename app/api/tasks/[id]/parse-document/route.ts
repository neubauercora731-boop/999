import { NextResponse } from "next/server";
import { z } from "zod";

import {
  DocumentIngestionError,
  type DocumentIngestionErrorCode,
} from "@/lib/agent/document-ingestion/types";
import { runDocumentIngestionWorkflow } from "@/lib/agent/document-ingestion/document-workflow";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toErrorMessage } from "@/lib/utils";

export const runtime = "nodejs";

const requestSchema = z.object({
  fileId: z.string().uuid(),
});

function errorResponse(
  errorCode: DocumentIngestionErrorCode,
  message: string,
  status: number,
) {
  return NextResponse.json(
    {
      success: false,
      errorCode,
      message,
    },
    { status },
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          errorCode: "UNAUTHORIZED",
          message: "请先登录后再解析文档。",
        },
        { status: 401 },
      );
    }

    const body = requestSchema.parse(await request.json());
    const result = await runDocumentIngestionWorkflow(supabase, {
      taskId: id,
      userId: user.id,
      fileId: body.fileId,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof DocumentIngestionError) {
      return errorResponse(error.code, error.message, error.status);
    }

    if (error instanceof z.ZodError) {
      return errorResponse(
        "FILE_NOT_FOUND",
        "请求参数不完整，请选择要解析的文件。",
        400,
      );
    }

    return errorResponse(
      "EXTRACT_TEXT_FAILED",
      toErrorMessage(error) || "解析文档失败，请稍后重试。",
      500,
    );
  }
}
