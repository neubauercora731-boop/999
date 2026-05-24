import { clsx, type ClassValue } from "clsx";

import {
  AGENT_ERROR_CODE,
  AGENT_ERROR_MESSAGES,
  AgentWorkflowError,
} from "@/lib/agent/errors";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

type ErrorLikeWithStatus = {
  status?: unknown;
  statusCode?: unknown;
  name?: unknown;
  message?: unknown;
};

export function toErrorMessage(error: unknown) {
  if (error instanceof AgentWorkflowError) {
    return error.message || AGENT_ERROR_MESSAGES[error.code];
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown error";
}

export function toUserFriendlyErrorMessage(
  error: unknown,
  fallbackMessage = "操作失败，请稍后重试。",
) {
  if (error instanceof AgentWorkflowError) {
    return error.message || AGENT_ERROR_MESSAGES[error.code];
  }

  const rawMessage = toErrorMessage(error);
  const message = rawMessage.toLowerCase();

  if (
    message.includes("bytestring") ||
    message.includes("greater than 255") ||
    message.includes("cannot convert argument to a bytestring")
  ) {
    return "导出失败：下载文件名编码错误，系统已阻止错误响应。";
  }

  if (message in AGENT_ERROR_MESSAGES) {
    return AGENT_ERROR_MESSAGES[message as keyof typeof AGENT_ERROR_MESSAGES];
  }

  if (
    message.includes("unauthorized") ||
    message.includes("jwt") ||
    message.includes("auth session") ||
    message.includes("请先登录")
  ) {
    return "请先登录，登录后可以保存和查看历史任务。";
  }

  if (
    message.includes("failed to fetch") ||
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("econnreset") ||
    message.includes("enotfound")
  ) {
    return "请求失败，请检查网络后重试。";
  }

  if (
    message.includes("api key") ||
    message.includes("moonshot") ||
    message.includes("insufficient") ||
    message.includes("quota") ||
    message.includes("balance") ||
    message.includes("429") ||
    message.includes("401")
  ) {
    return "AI 生成失败，请检查 API Key、余额或网络状态。";
  }

  if (
    message.includes("json") ||
    message.includes("schema") ||
    message.includes("parse") ||
    message.includes("invalid format")
  ) {
    return AGENT_ERROR_MESSAGES[AGENT_ERROR_CODE.JSON_PARSE_FAILED];
  }

  if (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("超时") ||
    message.includes("死循环")
  ) {
    return AGENT_ERROR_MESSAGES[AGENT_ERROR_CODE.CODE_RUN_TIMEOUT];
  }

  if (
    message.includes("暂不支持真实 python") ||
    message.includes("env_not_supported") ||
    message.includes("后续接入 worker")
  ) {
    return AGENT_ERROR_MESSAGES[AGENT_ERROR_CODE.ENV_NOT_SUPPORTED];
  }

  if (
    message.includes("危险操作") ||
    message.includes("security_blocked") ||
    message.includes("阻止运行")
  ) {
    return AGENT_ERROR_MESSAGES[AGENT_ERROR_CODE.CODE_SECURITY_BLOCKED];
  }

  if (
    message.includes("python") ||
    message.includes("exit code") ||
    message.includes("spawn") ||
    message.includes("运行失败")
  ) {
    return AGENT_ERROR_MESSAGES[AGENT_ERROR_CODE.CODE_RUN_FAILED];
  }

  return rawMessage === "Unknown error" ? fallbackMessage : rawMessage || fallbackMessage;
}

export function getErrorStatus(error: unknown, fallbackStatus = 500) {
  if (error instanceof AgentWorkflowError) {
    return error.status;
  }

  if (error && typeof error === "object") {
    const candidate = error as ErrorLikeWithStatus;

    if (typeof candidate.status === "number") {
      return candidate.status;
    }

    if (typeof candidate.statusCode === "number") {
      return candidate.statusCode;
    }

    if (candidate.name === "ZodError") {
      return 400;
    }

    if (typeof candidate.message === "string") {
      const message = candidate.message.toLowerCase();

      if (
        message.includes("unauthorized") ||
        message.includes("invalid authentication") ||
        message.includes("jwt")
      ) {
        return 401;
      }

      if (
        message.includes("forbidden") ||
        message.includes("permission denied") ||
        message.includes("row-level security")
      ) {
        return 403;
      }

      if (message.includes("not found")) {
        return 404;
      }
    }
  }

  return fallbackStatus;
}

export async function readJsonSafely<T>(response: Response): Promise<T | null> {
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return null;
  }

  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function getApiErrorMessage(
  response: Response,
  fallbackMessage: string,
) {
  const payload = await readJsonSafely<{
    error?: string;
    message?: string;
    code?: string;
    quality?: { blockingIssues?: unknown; warnings?: unknown };
    warnings?: unknown;
  }>(
    response.clone(),
  );

  if (payload) {
    const summary =
      payload.message ||
      payload.error ||
      (payload.code === "QUALITY_GATE_FAILED"
        ? "质量检查未通过，暂不能导出。"
        : fallbackMessage);
    const blockingIssues = Array.isArray(payload.quality?.blockingIssues)
      ? payload.quality.blockingIssues
      : [];
    const warnings = Array.isArray(payload.warnings)
      ? payload.warnings
      : Array.isArray(payload.quality?.warnings)
        ? payload.quality.warnings
        : [];
    const details = [...blockingIssues, ...warnings]
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .slice(0, 5);

    return details.length ? `${summary}\n${details.map((item) => `- ${item}`).join("\n")}` : summary;
  }

  try {
    const text = (await response.text()).trim();
    if (!text) return fallbackMessage;
    try {
      const parsed = JSON.parse(text) as { error?: string; message?: string; code?: string };
      return parsed.message || parsed.error || parsed.code || fallbackMessage;
    } catch {
      return text.length > 300 ? `${text.slice(0, 300)}...` : text;
    }
  } catch {
    return fallbackMessage;
  }
}

export async function getFriendlyApiErrorMessage(
  response: Response,
  fallbackMessage: string,
) {
  return toUserFriendlyErrorMessage(
    await getApiErrorMessage(response, fallbackMessage),
    fallbackMessage,
  );
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").toLowerCase();
}

export function truncateText(value: string, maxLength = 1200) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...`;
}
