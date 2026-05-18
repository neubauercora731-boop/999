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
