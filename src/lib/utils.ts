import { clsx, type ClassValue } from "clsx";

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
  const rawMessage = toErrorMessage(error);
  const message = rawMessage.toLowerCase();

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
    return "AI 返回格式异常，请重新生成一次。";
  }

  if (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("超时") ||
    message.includes("死循环")
  ) {
    return "代码运行超时，可能存在死循环或任务过长。";
  }

  if (message.includes("暂不支持 python") || message.includes("python 运行，请复制代码")) {
    return rawMessage;
  }

  if (
    message.includes("python") ||
    message.includes("exit code") ||
    message.includes("spawn") ||
    message.includes("运行失败")
  ) {
    return "代码运行失败，请查看错误信息。";
  }

  return rawMessage === "Unknown error" ? fallbackMessage : rawMessage || fallbackMessage;
}

export function getErrorStatus(error: unknown, fallbackStatus = 500) {
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
  const payload = await readJsonSafely<{ error?: string; message?: string }>(
    response.clone(),
  );

  if (payload?.error) {
    return payload.error;
  }

  if (payload?.message) {
    return payload.message;
  }

  try {
    const text = (await response.text()).trim();
    return text || fallbackMessage;
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
