import {
  MAX_NORMALIZED_TEXT_LENGTH,
  type NormalizedTextResult,
} from "./types";

function normalizeLine(line: string) {
  return line.replace(/\u0000/g, "").replace(/[ \t]+/g, " ").trimEnd();
}

export function normalizeDocumentText(rawText: string): NormalizedTextResult {
  const warnings: string[] = [];
  const normalized = rawText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map(normalizeLine)
    .join("\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();

  if (normalized.length > MAX_NORMALIZED_TEXT_LENGTH) {
    warnings.push(
      `文档正文较长，已截断到 ${MAX_NORMALIZED_TEXT_LENGTH} 字以内用于 AI 结构化。`,
    );
  }

  return {
    normalizedText: normalized.slice(0, MAX_NORMALIZED_TEXT_LENGTH),
    warnings,
  };
}
