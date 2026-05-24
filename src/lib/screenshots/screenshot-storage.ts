import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  GeneratedScreenshotImage,
  ScreenshotEvidence,
  ScreenshotEvidenceSource,
  ScreenshotEvidenceType,
} from "./types";

function sanitizeFileToken(value: string) {
  return value
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

export async function uploadScreenshotEvidence(
  supabase: SupabaseClient,
  params: {
    userId: string;
    taskId: string;
    runId: string;
    image: GeneratedScreenshotImage;
    requiredByTask: boolean;
    createdAt: string;
    type?: ScreenshotEvidenceType;
    source?: ScreenshotEvidenceSource;
    idPrefix?: string;
    description?: string;
    browser?: ScreenshotEvidence["browser"];
  },
): Promise<ScreenshotEvidence> {
  const type = params.type ?? "command_output_screenshot";
  const source = params.source ?? "real_run_code_result";
  const idPrefix =
    params.idPrefix ?? (type === "browser_page_screenshot" ? "browser-page" : "run-output");
  const id = `${sanitizeFileToken(idPrefix)}-${sanitizeFileToken(params.runId)}`;
  const fileName = `${id}.png`;
  const storagePath = `${params.userId}/${params.taskId}/screenshots/${Date.now()}-${fileName}`;

  const { error } = await supabase.storage
    .from("task-files")
    .upload(storagePath, new Uint8Array(params.image.buffer), {
      contentType: "image/png",
      upsert: true,
    });

  if (error) {
    throw new Error(error.message);
  }

  return {
    id,
    type,
    source,
    path: storagePath,
    storagePath,
    contentType: "image/png",
    fileName,
    description: params.description,
    createdAt: params.createdAt,
    relatedRunId: params.runId,
    requiredByTask: params.requiredByTask,
    isRealScreenshot: true,
    isAiGenerated: false,
    missing: false,
    width: params.image.width,
    height: params.image.height,
    label: params.image.label,
    runtimeMs: params.image.runtimeMs,
    pageUrl: params.image.pageUrl,
    consoleMessages: params.image.consoleMessages,
    pageErrors: params.image.pageErrors,
    browser: params.browser,
    warnings: params.image.warnings,
  };
}
