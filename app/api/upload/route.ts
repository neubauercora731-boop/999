import { NextResponse } from "next/server";

import {
  inferFileRole,
  isParseSupported,
  type FileRole,
} from "@/lib/agent/document-ingestion/file-role";
import { buildCsvDatasetPreview, isCsvFile } from "@/lib/datasets/csv";
import { createFileChecksum, extractTextExcerpt } from "@/lib/files";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { taskFileTypeSchema } from "@/lib/tasks/contracts";
import {
  appendTaskInputText,
  createTaskFile,
  getTaskById,
} from "@/lib/tasks/repository";
import { getErrorStatus, sanitizeFileName, toErrorMessage } from "@/lib/utils";

export const runtime = "nodejs";

function resolveUploadFileRole(input: {
  fileType: string;
  fileName: string;
  mimeType: string;
  inferredRole: ReturnType<typeof inferFileRole>;
  csvDataset: unknown;
}): {
  fileRole: FileRole;
  confidence: number;
  reason: string;
  source: string;
} {
  if (input.fileType === "data" || input.csvDataset) {
    return {
      fileRole: "dataset",
      confidence: 0.98,
      reason:
        input.fileType === "data"
          ? "用户上传到数据文件栏"
          : "CSV 文件按数据集处理",
      source: input.fileType === "data" ? "user_selected" : "filename_rule",
    };
  }

  if (
    input.fileType === "task_book" &&
    isParseSupported(input.fileName, input.mimeType)
  ) {
    return {
      fileRole: "task_book",
      confidence: Math.max(input.inferredRole.confidence, 0.97),
      reason: "用户上传到任务书文件栏，且文件支持文本解析",
      source: "user_selected",
    };
  }

  if (
    input.fileType === "template" &&
    isParseSupported(input.fileName, input.mimeType)
  ) {
    return {
      fileRole: "report_template",
      confidence: Math.max(input.inferredRole.confidence, 0.94),
      reason: "用户上传到报告模板栏，且文件支持文本解析",
      source: "user_selected",
    };
  }

  if (input.fileType === "code") {
    return {
      fileRole: "source_code",
      confidence: Math.max(input.inferredRole.confidence, 0.94),
      reason: "用户上传到代码文件栏",
      source: "user_selected",
    };
  }

  if (input.fileType === "screenshot") {
    return {
      fileRole: "screenshot",
      confidence: Math.max(input.inferredRole.confidence, 0.94),
      reason: "用户上传到截图栏",
      source: "user_selected",
    };
  }

  return {
    fileRole: input.inferredRole.role,
    confidence: input.inferredRole.confidence,
    reason: input.inferredRole.reason,
    source: "filename_rule",
  };
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const adminSupabase = createSupabaseAdminClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const taskId = formData.get("taskId");
    const fileTypeValue = formData.get("fileType");
    const file = formData.get("file");

    if (typeof taskId !== "string" || !taskId) {
      return NextResponse.json({ error: "Missing taskId" }, { status: 400 });
    }

    if (typeof fileTypeValue !== "string" || !fileTypeValue) {
      return NextResponse.json({ error: "Missing fileType" }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const fileType = taskFileTypeSchema.parse(fileTypeValue);
    const task = await getTaskById(supabase, user.id, taskId);

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const checksum = createFileChecksum(bytes);
    const extractedText = await extractTextExcerpt(file.name, file.type, bytes);
    const textExcerpt = extractedText.text;
    const inferredRole = inferFileRole(file.name, file.type);
    const csvDataset = textExcerpt && isCsvFile(file.name, file.type)
      ? buildCsvDatasetPreview(file.name, textExcerpt)
      : null;
    const roleResolution = resolveUploadFileRole({
      fileType,
      fileName: file.name,
      mimeType: file.type,
      inferredRole,
      csvDataset,
    });
    const fileRole = roleResolution.fileRole;
    const objectPath = `${user.id}/${taskId}/${Date.now()}-${sanitizeFileName(file.name)}`;

    // Storage writes run through the server-side admin client after we have
    // already authenticated the user and verified task ownership.
    const { error: uploadError } = await adminSupabase.storage
      .from("task-files")
      .upload(objectPath, bytes, {
        contentType: file.type || undefined,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    let fileRecord;

    try {
      fileRecord = await createTaskFile(supabase, {
        taskId,
        userId: user.id,
        fileType,
        storageBucket: "task-files",
        storagePath: objectPath,
        originalFilename: file.name,
        mimeType: file.type || null,
        fileSize: file.size,
        checksum,
        metadata: {
          inferred_file_role: inferredRole.role,
          file_role: fileRole,
          role_confidence: roleResolution.confidence,
          role_reason: roleResolution.reason,
          role_source: roleResolution.source,
          ...(csvDataset ? { dataset: { kind: "csv", ...csvDataset } } : {}),
          extraction_method: extractedText.method,
          parsed_text: textExcerpt,
          ocr_status:
            extractedText.method === "unavailable"
              ? "PDF/PNG/JPG OCR 后续支持；当前文件仅保存原件。"
              : "parsed",
          ...(textExcerpt ? { text_excerpt: textExcerpt } : {}),
        },
      });

      if (textExcerpt && fileType === "task_book" && fileRole === "task_book") {
        await appendTaskInputText(supabase, {
          taskId,
          userId: user.id,
          column: "task_book_text",
          content: textExcerpt,
        });
      }

      if (textExcerpt && fileType === "template") {
        await appendTaskInputText(supabase, {
          taskId,
          userId: user.id,
          column: "template_instructions",
          content: textExcerpt,
        });
      }
    } catch (error) {
      await adminSupabase.storage.from("task-files").remove([objectPath]);
      throw error;
    }

    return NextResponse.json({
      file: fileRecord,
      textExcerpt,
    });
  } catch (error) {
    return NextResponse.json(
      { error: toErrorMessage(error) },
      { status: getErrorStatus(error, 500) },
    );
  }
}
