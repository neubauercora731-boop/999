export const AGENT_ERROR_CODE = {
  AI_CALL_FAILED: "AI_CALL_FAILED",
  JSON_PARSE_FAILED: "JSON_PARSE_FAILED",
  CODE_GENERATE_FAILED: "CODE_GENERATE_FAILED",
  CODE_RUN_FAILED: "CODE_RUN_FAILED",
  CODE_RUN_TIMEOUT: "CODE_RUN_TIMEOUT",
  CODE_SECURITY_BLOCKED: "CODE_SECURITY_BLOCKED",
  ENV_NOT_SUPPORTED: "ENV_NOT_SUPPORTED",
  DEBUG_FAILED: "DEBUG_FAILED",
  REPORT_GENERATE_FAILED: "REPORT_GENERATE_FAILED",
  SAVE_REPORT_FAILED: "SAVE_REPORT_FAILED",
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
} as const;

export type AgentErrorCode =
  (typeof AGENT_ERROR_CODE)[keyof typeof AGENT_ERROR_CODE];

export const AGENT_ERROR_MESSAGES: Record<AgentErrorCode, string> = {
  [AGENT_ERROR_CODE.AI_CALL_FAILED]:
    "AI 生成失败，请检查 API Key、余额或网络状态。",
  [AGENT_ERROR_CODE.JSON_PARSE_FAILED]:
    "AI 返回格式异常，系统已尝试使用模板兜底。",
  [AGENT_ERROR_CODE.CODE_GENERATE_FAILED]:
    "代码生成失败，请调整任务要求后重试。",
  [AGENT_ERROR_CODE.CODE_RUN_FAILED]:
    "代码运行失败，系统将尝试自动修复一次。",
  [AGENT_ERROR_CODE.CODE_RUN_TIMEOUT]:
    "代码运行超时，可能存在死循环或任务过长。",
  [AGENT_ERROR_CODE.CODE_SECURITY_BLOCKED]:
    "代码包含潜在危险操作，系统已阻止运行。",
  [AGENT_ERROR_CODE.ENV_NOT_SUPPORTED]:
    "当前线上环境暂不支持真实 Python 运行，请复制代码到本地运行，或后续接入 Worker。",
  [AGENT_ERROR_CODE.DEBUG_FAILED]:
    "代码自动修复失败，请查看错误信息或手动调整。",
  [AGENT_ERROR_CODE.REPORT_GENERATE_FAILED]:
    "报告生成失败，请重新生成。",
  [AGENT_ERROR_CODE.SAVE_REPORT_FAILED]:
    "报告保存失败，请稍后重试。",
  [AGENT_ERROR_CODE.UNKNOWN_ERROR]:
    "系统出现未知错误，请稍后重试。",
};

export class AgentWorkflowError extends Error {
  code: AgentErrorCode;
  status: number;
  details?: unknown;

  constructor(
    code: AgentErrorCode,
    message = AGENT_ERROR_MESSAGES[code],
    options: { status?: number; details?: unknown } = {},
  ) {
    super(message);
    this.name = "AgentWorkflowError";
    this.code = code;
    this.status = options.status ?? 400;
    this.details = options.details;
  }
}

export function getAgentErrorMessage(error: unknown) {
  if (error instanceof AgentWorkflowError) {
    return error.message || AGENT_ERROR_MESSAGES[error.code];
  }

  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string" &&
    error.code in AGENT_ERROR_MESSAGES
  ) {
    return AGENT_ERROR_MESSAGES[error.code as AgentErrorCode];
  }

  return AGENT_ERROR_MESSAGES.UNKNOWN_ERROR;
}
