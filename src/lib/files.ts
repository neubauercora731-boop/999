import { createHash } from "node:crypto";

import mammoth from "mammoth";
import WordExtractor from "word-extractor";

const TEXT_FILE_EXTENSIONS = new Set([
  ".txt",
  ".md",
  ".csv",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".py",
  ".java",
  ".c",
  ".cpp",
  ".sql",
  ".yaml",
  ".yml",
  ".xml",
  ".html",
  ".css",
]);

const DOCX_EXTENSIONS = new Set([".docx"]);
const DOC_EXTENSIONS = new Set([".doc"]);

const DOCX_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const DOC_MIME_TYPES = new Set([
  "application/msword",
  "application/vnd.ms-word",
]);

const DEFAULT_TEXT_EXTRACTION_LIMIT = 16_000;
const wordExtractor = new WordExtractor();

function getLowercaseExtension(fileName: string) {
  const lastDotIndex = fileName.lastIndexOf(".");

  if (lastDotIndex < 0) {
    return "";
  }

  return fileName.slice(lastDotIndex).toLowerCase();
}

function normalizeExtractedText(value: string, maxLength: number) {
  const normalized = value
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return normalized.slice(0, maxLength) || null;
}

function isTextLikeFile(fileName: string, mimeType: string | null | undefined) {
  const extension = getLowercaseExtension(fileName);

  return (
    Boolean(mimeType?.startsWith("text/")) ||
    mimeType === "application/json" ||
    mimeType === "application/xml" ||
    mimeType === "application/javascript" ||
    TEXT_FILE_EXTENSIONS.has(extension)
  );
}

function isDocxFile(fileName: string, mimeType: string | null | undefined) {
  const extension = getLowercaseExtension(fileName);
  return DOCX_EXTENSIONS.has(extension) || DOCX_MIME_TYPES.has(mimeType ?? "");
}

function isDocFile(fileName: string, mimeType: string | null | undefined) {
  const extension = getLowercaseExtension(fileName);
  return DOC_EXTENSIONS.has(extension) || DOC_MIME_TYPES.has(mimeType ?? "");
}

async function extractDocxText(bytes: Uint8Array) {
  const result = await mammoth.extractRawText({
    buffer: Buffer.from(bytes),
  });

  return result.value;
}

async function extractDocText(bytes: Uint8Array) {
  const document = await wordExtractor.extract(Buffer.from(bytes));
  const parts = [
    document.getHeaders({ includeFooters: false }),
    document.getBody(),
    document.getFootnotes(),
    document.getEndnotes(),
    document.getAnnotations(),
    document.getTextboxes({
      includeBody: true,
      includeHeadersAndFooters: true,
    }),
    document.getFooters(),
  ];

  return parts.filter(Boolean).join("\n\n");
}

function extractPlainText(bytes: Uint8Array, maxLength: number) {
  const decoded = new TextDecoder("utf-8", { fatal: false }).decode(
    bytes.slice(0, maxLength * 2),
  );

  return decoded.slice(0, maxLength);
}

export function createFileChecksum(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

export interface FileTextExtractionResult {
  text: string | null;
  method: "docx_mammoth" | "doc_word_extractor" | "plain_text" | "unavailable";
}

export async function extractTextExcerpt(
  fileName: string,
  mimeType: string | null | undefined,
  bytes: Uint8Array,
  maxLength = DEFAULT_TEXT_EXTRACTION_LIMIT,
): Promise<FileTextExtractionResult> {
  try {
    if (isDocxFile(fileName, mimeType)) {
      const extracted = await extractDocxText(bytes);
      return {
        text: normalizeExtractedText(extracted, maxLength),
        method: "docx_mammoth",
      };
    }

    if (isDocFile(fileName, mimeType)) {
      const extracted = await extractDocText(bytes);
      return {
        text: normalizeExtractedText(extracted, maxLength),
        method: "doc_word_extractor",
      };
    }

    if (!isTextLikeFile(fileName, mimeType)) {
      return {
        text: null,
        method: "unavailable",
      };
    }

    return {
      text: normalizeExtractedText(extractPlainText(bytes, maxLength), maxLength),
      method: "plain_text",
    };
  } catch {
    return {
      text: null,
      method: "unavailable",
    };
  }
}

export function getFileStem(fileName: string) {
  const extension = getLowercaseExtension(fileName);

  if (!extension) {
    return fileName.trim();
  }

  return fileName.slice(0, -extension.length).trim();
}
