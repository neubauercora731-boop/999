import { NextResponse } from "next/server";

import {
  extractScreenshotsFromReportJson,
  mergeScreenshotEvidence,
} from "@/lib/screenshots/evidence";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTaskDetail } from "@/lib/tasks/repository";
import { getErrorStatus, toErrorMessage } from "@/lib/utils";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function getRunId(value: unknown) {
  return value && typeof value === "object"
    ? String((value as Record<string, unknown>).runId ?? "")
    : "";
}

function collectScreenshotArtifacts(
  taskDetail: NonNullable<Awaited<ReturnType<typeof getTaskDetail>>>,
) {
  return mergeScreenshotEvidence(
    ...taskDetail.outputs.map((output) => extractScreenshotsFromReportJson(output.report_json)),
  ).map((screenshot) => ({
    kind: screenshot.kind,
    storagePath: screenshot.storagePath,
    signedUrl: screenshot.signedUrl,
    metadata: {
      ...screenshot.metadata,
      kind: screenshot.kind,
      status: screenshot.status,
      source: screenshot.source,
      fileName: screenshot.fileName,
      createdAt: screenshot.createdAt,
      missingReason: screenshot.missingReason,
      localPath: screenshot.localPath,
    },
  }));
}

function mergeTraceArtifacts(current: unknown, screenshots: ReturnType<typeof collectScreenshotArtifacts>) {
  const existing = Array.isArray(current) ? current : [];
  const seen = new Set(
    existing.map((item) => {
      const record = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      return `${record.kind ?? ""}:${record.storagePath ?? ""}`;
    }),
  );
  return [
    ...existing,
    ...screenshots.filter((screenshot) => {
      const key = `${screenshot.kind}:${screenshot.storagePath ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  ];
}

function enhanceTraceWithScreenshots(trace: unknown[], screenshots: ReturnType<typeof collectScreenshotArtifacts>) {
  if (screenshots.length === 0) return trace;
  return trace.map((step) => {
    const record = step && typeof step === "object" ? (step as Record<string, unknown>) : {};
    if (record.step !== "generate-screenshot" && record.step !== "run-code") return step;
    const artifacts = mergeTraceArtifacts(record.artifacts, screenshots);
    if (record.step === "generate-screenshot" && record.status === "skipped") {
      return {
        ...record,
        status: "success",
        outputSummary: "截图已在 run-code 阶段生成，并已归档为截图证据。",
        artifacts,
      };
    }
    return { ...record, artifacts };
  });
}

function collectSavedTrace(
  taskDetail: NonNullable<Awaited<ReturnType<typeof getTaskDetail>>>,
  requestedRunId?: string | null,
) {
  for (const output of taskDetail.outputs) {
    const reportJson = output.report_json ?? {};
    const latestRun = reportJson.latest_agent_run ?? reportJson.latestAgentRun;
    const trace = reportJson.agent_trace ?? reportJson.agentTrace;
    const runId = getRunId(latestRun);
    const screenshotArtifacts = collectScreenshotArtifacts(taskDetail);

    if (requestedRunId && runId !== requestedRunId) continue;
    if (Array.isArray(trace)) {
      const steps = enhanceTraceWithScreenshots(trace, screenshotArtifacts);
      return {
        taskId: taskDetail.task.id,
        runId: runId || output.task_run_id,
        status:
          latestRun && typeof latestRun === "object"
            ? (latestRun as Record<string, unknown>).status
            : "partial",
        workflowType:
          latestRun && typeof latestRun === "object"
            ? (latestRun as Record<string, unknown>).workflowType
            : "unknown",
        steps,
        quality: reportJson.quality ?? null,
        artifacts: mergeTraceArtifacts(reportJson.artifacts, screenshotArtifacts),
        errors: reportJson.errors ?? [],
        warnings: reportJson.warnings ?? [],
        updatedAt: output.created_at,
      };
    }
  }

  return null;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const runId = new URL(request.url).searchParams.get("runId");
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "请先登录后再查看 Agent Trace。", code: "AUTH_REQUIRED" },
        { status: 401 },
      );
    }

    const taskDetail = await getTaskDetail(supabase, user.id, id);
    if (!taskDetail) {
      return NextResponse.json(
        {
          error: "找不到该任务，或你没有权限访问它。",
          code: "TASK_NOT_FOUND",
        },
        { status: 404 },
      );
    }

    const saved = collectSavedTrace(taskDetail, runId);
    return NextResponse.json(
      saved ?? {
        taskId: id,
        runId,
        status: "partial",
        workflowType: "unknown",
        steps: [],
        quality: null,
        artifacts: [],
        errors: [],
        warnings: ["No persisted agent trace was found for this task."],
        updatedAt: null,
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: toErrorMessage(error) || "读取 Agent Trace 失败，请稍后重试。",
        code: "AGENT_TRACE_FAILED",
      },
      { status: getErrorStatus(error, 500) },
    );
  }
}
