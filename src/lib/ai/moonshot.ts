import OpenAI from "openai";
import type {
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletionToolChoiceOption,
} from "openai/resources/chat/completions/completions";
import type { ZodType } from "zod";

import {
  consistencyCheckerPrompt,
  outlineGeneratorPrompt,
  reportGeneratorPrompt,
  requirementParserPrompt,
} from "@/lib/ai/prompts";
import type {
  BuiltTaskContext,
  ConsistencyCheckResult,
  MoonshotBaseCallOptions,
  MoonshotJsonResult,
  MoonshotTextResult,
  OutlineDocument,
  ParsedRequirement,
} from "@/lib/ai/types";
import { consistencyCheckSchema, outlineSchema } from "@/lib/ai/types";
import { getMoonshotEnv } from "@/lib/env";
import { parsedRequirementSchema } from "@/lib/validators/parsed-requirement";

const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_AI_BASE_URL = "https://api.moonshot.ai/v1";
const DEFAULT_CN_BASE_URL = "https://api.moonshot.cn/v1";
const MAX_ATTEMPTS_PER_BASE_URL = 2;

const clientCache = new Map<string, OpenAI>();

function createTimeoutController(timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(
      new DOMException("Moonshot request timed out", "AbortError"),
    );
  }, timeoutMs);

  return {
    controller,
    clear() {
      clearTimeout(timeout);
    },
  };
}

function logMoonshotEvent(
  status: "success" | "failure",
  elapsedMs: number,
  options: MoonshotBaseCallOptions,
  details?: Record<string, unknown>,
) {
  console[status === "success" ? "info" : "error"]("moonshot_call", {
    task_id: options.metadata?.taskId ?? null,
    step_name: options.metadata?.stepName ?? null,
    model_name: options.metadata?.modelName ?? getMoonshotEnv().model,
    elapsed_ms: elapsedMs,
    success: status === "success",
    ...details,
  });
}

function getMessages(options: MoonshotBaseCallOptions): ChatCompletionMessageParam[] {
  return [
    {
      role: "system",
      content: options.systemPrompt,
    },
    {
      role: "user",
      content: options.userPrompt,
    },
  ];
}

function normalizeContent(
  content:
    | string
    | Array<{
        type?: string;
        text?: string;
      }>
    | null
    | undefined,
) {
  if (!content) {
    return "";
  }

  if (typeof content === "string") {
    return content;
  }

  return content
    .map((item) => ("text" in item ? item.text ?? "" : ""))
    .join("\n")
    .trim();
}

function getApiErrorStatus(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
  ) {
    return error.status;
  }

  return null;
}

function getApiErrorCode(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }

  return null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getApiErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return null;
}

function usesInternationalBaseUrl(baseURL: string) {
  return baseURL.trim().toLowerCase() === DEFAULT_AI_BASE_URL;
}

function shouldRetryWithCnBaseUrl(baseURL: string, error: unknown) {
  return usesInternationalBaseUrl(baseURL) && getApiErrorStatus(error) === 401;
}

function shouldRetryOnTransientError(error: unknown) {
  const status = getApiErrorStatus(error);
  const message = getApiErrorMessage(error)?.toLowerCase() ?? "";

  if (status === 429) {
    return true;
  }

  if (message.includes("overloaded") || message.includes("request was aborted")) {
    return true;
  }

  return error instanceof DOMException && error.name === "AbortError";
}

function getBaseUrlsToTry(preferredBaseUrl: string) {
  if (usesInternationalBaseUrl(preferredBaseUrl)) {
    return [preferredBaseUrl, DEFAULT_CN_BASE_URL];
  }

  return [preferredBaseUrl];
}

function toMoonshotErrorMessage(error: unknown) {
  if (
    (error instanceof DOMException && error.name === "AbortError") ||
    getApiErrorMessage(error)?.includes("Request was aborted")
  ) {
    return "Moonshot 请求超时，请稍后重试。";
  }

  const status = getApiErrorStatus(error);
  const rawMessage = getApiErrorMessage(error);

  if (status === 401) {
    return "Moonshot 认证失败，请检查 MOONSHOT_API_KEY 与 MOONSHOT_BASE_URL 是否匹配。";
  }

  if (status === 429) {
    return "Moonshot 请求过于频繁，请稍后重试。";
  }

  if (status === 400) {
    return rawMessage
      ? `Moonshot 请求参数无效：${rawMessage}`
      : "Moonshot 请求参数无效，请检查模型名和请求格式。";
  }

  return rawMessage ?? "Moonshot 请求失败，请稍后重试。";
}

function buildRequestPayload(
  model: string,
  baseURL: string,
  options: MoonshotBaseCallOptions & {
    jsonMode?: boolean;
  },
): ChatCompletionCreateParamsNonStreaming {
  const payload: ChatCompletionCreateParamsNonStreaming = {
    model,
    messages: getMessages(options),
    response_format: options.jsonMode ? { type: "json_object" } : undefined,
    tools: options.tools as ChatCompletionTool[] | undefined,
    tool_choice: options.toolChoice as ChatCompletionToolChoiceOption | undefined,
  };

  // China-region kimi-k2.5 rejects temperature overrides. Only send it when
  // the caller explicitly requests a value, and keep the default request clean.
  if (typeof options.temperature === "number") {
    payload.temperature = options.temperature;
  }

  if (typeof options.maxTokens === "number") {
    payload.max_tokens = options.maxTokens;
  }

  if (baseURL === DEFAULT_CN_BASE_URL && payload.temperature === 0) {
    delete payload.temperature;
  }

  return payload;
}

export function createMoonshotClient(baseURL?: string) {
  const env = getMoonshotEnv();
  const resolvedBaseUrl = baseURL ?? env.baseUrl;

  const cached = clientCache.get(resolvedBaseUrl);
  if (cached) {
    return cached;
  }

  const client = new OpenAI({
    apiKey: env.apiKey,
    baseURL: resolvedBaseUrl,
  });

  clientCache.set(resolvedBaseUrl, client);
  return client;
}

async function requestMoonshot(
  options: MoonshotBaseCallOptions & {
    jsonMode?: boolean;
  },
) {
  const env = getMoonshotEnv();
  const startedAt = Date.now();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const baseUrls = getBaseUrlsToTry(env.baseUrl);

  let lastError: unknown = null;

  for (const [index, baseURL] of baseUrls.entries()) {
    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_BASE_URL; attempt += 1) {
      const client = createMoonshotClient(baseURL);
      const { controller, clear } = createTimeoutController(timeoutMs);

      try {
        const response = await client.chat.completions.create(
          buildRequestPayload(env.model, baseURL, options),
          {
            signal: controller.signal,
          },
        );

        const elapsedMs = Date.now() - startedAt;
        const content = normalizeContent(response.choices[0]?.message?.content);

        logMoonshotEvent("success", elapsedMs, {
          ...options,
          metadata: {
            ...options.metadata,
            modelName: env.model,
          },
        }, {
          base_url: baseURL,
          attempted_base_urls: baseUrls,
          base_url_attempt: attempt + 1,
          fallback_count: index,
        });

        return {
          content,
          raw: response,
          usage: {
            promptTokens: response.usage?.prompt_tokens ?? null,
            completionTokens: response.usage?.completion_tokens ?? null,
            totalTokens: response.usage?.total_tokens ?? null,
          },
        };
      } catch (error) {
        lastError = error;

        if (shouldRetryWithCnBaseUrl(baseURL, error) && index < baseUrls.length - 1) {
          clear();
          break;
        }

        const shouldRetry =
          attempt < MAX_ATTEMPTS_PER_BASE_URL - 1 &&
          shouldRetryOnTransientError(error);

        if (shouldRetry) {
          clear();
          await sleep(1_500 * (attempt + 1));
          continue;
        }

        const elapsedMs = Date.now() - startedAt;

        logMoonshotEvent("failure", elapsedMs, options, {
          base_url: baseURL,
          attempted_base_urls: baseUrls.slice(0, index + 1),
          base_url_attempt: attempt + 1,
          error_message: error instanceof Error ? error.message : "unknown_error",
          error_status: getApiErrorStatus(error),
          error_code: getApiErrorCode(error),
        });

        throw new Error(toMoonshotErrorMessage(error));
      } finally {
        clear();
      }
    }
  }

  throw new Error(toMoonshotErrorMessage(lastError));
}

export async function callMoonshotText(
  options: MoonshotBaseCallOptions,
): Promise<MoonshotTextResult> {
  return requestMoonshot(options);
}

export async function callMoonshotJson<T>(
  options: MoonshotBaseCallOptions & {
    schema: ZodType<T>;
  },
): Promise<MoonshotJsonResult<T>> {
  const result = await requestMoonshot({
    ...options,
    jsonMode: true,
  });

  try {
    const parsed = options.schema.parse(JSON.parse(result.content));

    return {
      ...result,
      parsed,
    };
  } catch (error) {
    console.error("moonshot_json_parse_failed", {
      task_id: options.metadata?.taskId ?? null,
      step_name: options.metadata?.stepName ?? null,
      message: error instanceof Error ? error.message : "unknown_error",
    });

    throw new Error("AI 返回的 JSON 结构无效，请重试。");
  }
}

export async function parseRequirement(context: BuiltTaskContext) {
  const prompt = requirementParserPrompt(context);

  return callMoonshotJson<ParsedRequirement>({
    ...prompt,
    maxTokens: 4_096,
    schema: parsedRequirementSchema,
    timeoutMs: 180_000,
    metadata: {
      taskId: context.taskId,
      stepName: "parse_requirement",
    },
  });
}

export async function generateOutline(
  context: BuiltTaskContext,
  requirement: ParsedRequirement,
) {
  const prompt = outlineGeneratorPrompt(context, requirement);

  return callMoonshotJson<OutlineDocument>({
    ...prompt,
    maxTokens: 4_096,
    schema: outlineSchema,
    timeoutMs: 180_000,
    metadata: {
      taskId: context.taskId,
      stepName: "generate_outline",
    },
  });
}

export async function generateReport(
  context: BuiltTaskContext,
  requirement: ParsedRequirement,
  outline: OutlineDocument,
) {
  const prompt = reportGeneratorPrompt(context, requirement, outline);

  return callMoonshotText({
    ...prompt,
    maxTokens: 8_192,
    timeoutMs: 240_000,
    metadata: {
      taskId: context.taskId,
      stepName: "generate_report",
    },
  });
}

export async function runConsistencyCheck(
  context: BuiltTaskContext,
  requirement: ParsedRequirement,
  outline: OutlineDocument,
  reportMarkdown: string,
) {
  const prompt = consistencyCheckerPrompt(requirement, outline, reportMarkdown);

  return callMoonshotJson<ConsistencyCheckResult>({
    ...prompt,
    maxTokens: 4_096,
    schema: consistencyCheckSchema,
    timeoutMs: 180_000,
    metadata: {
      taskId: context.taskId,
      stepName: "consistency_check",
    },
  });
}
