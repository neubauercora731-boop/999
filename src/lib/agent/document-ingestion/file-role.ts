export const fileRoles = [
  "task_book",
  "report_template",
  "dataset",
  "screenshot",
  "source_code",
  "reference",
  "unknown",
] as const;

export type FileRole = (typeof fileRoles)[number];

export const fileRoleLabels: Record<FileRole, string> = {
  task_book: "实验任务书",
  report_template: "报告模板",
  dataset: "数据文件",
  screenshot: "截图",
  source_code: "已有代码",
  reference: "参考资料",
  unknown: "未知类型",
};

const parseSupportedExtensions = new Set(["docx", "doc", "txt", "md", "markdown"]);
const documentLikeExtensions = new Set([...parseSupportedExtensions, "pdf"]);
const datasetExtensions = new Set(["csv", "xlsx", "xls", "json"]);
const screenshotExtensions = new Set(["png", "jpg", "jpeg", "webp", "gif"]);
const sourceCodeExtensions = new Set([
  "py",
  "js",
  "ts",
  "java",
  "sql",
  "html",
  "css",
  "cpp",
  "c",
  "cs",
  "php",
]);

const taskBookKeywords = [
  "任务书",
  "实验要求",
  "实验任务",
  "实验内容",
  "作业要求",
  "要求",
  "assignment",
  "lab",
  "task",
  "requirement",
];

const templateKeywords = ["模板", "报告模板", "报告格式", "格式", "template", "format"];
const datasetKeywords = ["数据", "dataset", "data", "表格", "csv"];
const screenshotKeywords = ["截图", "screenshot", "image", "图片"];
const sourceCodeKeywords = ["代码", "code", "source", "main"];
const referenceKeywords = ["参考", "示例", "example", "demo", "资料", "reference"];

function getExtension(fileName: string) {
  const cleanName = fileName.trim().toLowerCase();
  const lastDotIndex = cleanName.lastIndexOf(".");
  return lastDotIndex >= 0 ? cleanName.slice(lastDotIndex + 1) : "";
}

function includesKeyword(fileName: string, keywords: string[]) {
  const normalized = fileName.trim().toLowerCase();
  return keywords.find((keyword) => normalized.includes(keyword.toLowerCase()));
}

function result(role: FileRole, confidence: number, reason: string) {
  return { role, confidence, reason };
}

export function isParseSupported(fileName: string, mimeType?: string | null) {
  const extension = getExtension(fileName);
  const normalizedMime = mimeType?.trim().toLowerCase() ?? "";

  return (
    parseSupportedExtensions.has(extension) ||
    normalizedMime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    normalizedMime === "application/msword" ||
    normalizedMime === "application/vnd.ms-word" ||
    normalizedMime.startsWith("text/plain")
  );
}

export function inferFileRole(fileName: string, mimeType?: string | null) {
  const extension = getExtension(fileName);
  const normalizedMime = mimeType?.trim().toLowerCase() ?? "";
  const taskKeyword = includesKeyword(fileName, taskBookKeywords);
  const templateKeyword = includesKeyword(fileName, templateKeywords);
  const datasetKeyword = includesKeyword(fileName, datasetKeywords);
  const screenshotKeyword = includesKeyword(fileName, screenshotKeywords);
  const sourceCodeKeyword = includesKeyword(fileName, sourceCodeKeywords);
  const referenceKeyword = includesKeyword(fileName, referenceKeywords);
  const isDocumentLike = documentLikeExtensions.has(extension);

  if (taskKeyword && isDocumentLike) {
    return result("task_book", 0.92, `文件名包含“${taskKeyword}”，且是文档类型`);
  }

  if (templateKeyword && isDocumentLike) {
    return result("report_template", 0.9, `文件名包含“${templateKeyword}”，更像报告模板`);
  }

  if (datasetExtensions.has(extension) || datasetKeyword) {
    return result(
      "dataset",
      extension ? 0.88 : 0.72,
      extension ? `后缀为 ${extension}` : `文件名包含“${datasetKeyword}”`,
    );
  }

  if (
    screenshotExtensions.has(extension) ||
    normalizedMime.startsWith("image/") ||
    screenshotKeyword
  ) {
    return result(
      "screenshot",
      extension ? 0.9 : 0.72,
      extension ? `后缀为 ${extension}` : `文件名包含“${screenshotKeyword}”`,
    );
  }

  if (sourceCodeExtensions.has(extension) || sourceCodeKeyword) {
    return result(
      "source_code",
      extension ? 0.9 : 0.74,
      extension ? `后缀为 ${extension}` : `文件名包含“${sourceCodeKeyword}”`,
    );
  }

  if (referenceKeyword) {
    return result("reference", 0.7, `文件名包含“${referenceKeyword}”`);
  }

  if (isParseSupported(fileName, mimeType)) {
    return result("task_book", 0.64, "文件支持文本解析，且未命中模板/数据/截图/代码特征，默认作为任务书候选");
  }

  return result("unknown", 0.2, "文件名和后缀不足以判断材料角色");
}
