import mammoth from "mammoth";
import WordExtractor from "word-extractor";

import {
  DocumentIngestionError,
  MAX_RAW_TEXT_LENGTH,
  type ExtractTextInput,
  type ExtractTextResult,
} from "./types";

const wordExtractor = new WordExtractor();

function cleanRawText(value: string) {
  return value
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

function isZipStructureError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    message.includes("not a zip") ||
    message.includes("end of central directory") ||
    message.includes("invalid zip") ||
    message.includes("zip file")
  );
}

async function extractDocx(bytes: Uint8Array) {
  const buffer = Buffer.from(bytes);

  try {
    const result = await mammoth.extractRawText({ buffer });
    return {
      rawText: result.value,
      method: "docx_mammoth" as const,
      warnings: [] as string[],
    };
  } catch (error) {
    if (!isZipStructureError(error)) {
      throw error;
    }

    // Some teacher-provided files use a legacy Word binary payload with a
    // .docx extension. Fall back to word-extractor instead of rejecting them.
    return {
      rawText: await extractDoc(bytes),
      method: "docx_word_extractor" as const,
      warnings: [
        "该 .docx 文件不是标准 Office Open XML 格式，已使用 word-extractor 兼容解析。",
      ],
    };
  }
}

async function extractDoc(bytes: Uint8Array) {
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

function extractPlain(bytes: Uint8Array) {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

export async function extractDocumentRawText({
  bytes,
  fileType,
}: ExtractTextInput): Promise<ExtractTextResult> {
  const warnings: string[] = [];

  try {
    let rawText = "";
    let method: ExtractTextResult["method"];

    if (fileType === "docx") {
      const docxResult = await extractDocx(bytes);
      rawText = docxResult.rawText;
      method = docxResult.method;
      warnings.push(...docxResult.warnings);
    } else if (fileType === "doc") {
      rawText = await extractDoc(bytes);
      method = "doc_word_extractor";
    } else if (fileType === "txt" || fileType === "md") {
      rawText = extractPlain(bytes);
      method = "plain_text";
    } else {
      throw new DocumentIngestionError(
        "UNSUPPORTED_FILE_TYPE",
        "当前版本暂不支持该文件类型。",
        415,
      );
    }

    const cleaned = cleanRawText(rawText);
    if (!cleaned) {
      throw new DocumentIngestionError(
        "EMPTY_DOCUMENT_TEXT",
        "文档为空，或当前版本无法识别正文内容。",
        422,
      );
    }

    if (cleaned.length > MAX_RAW_TEXT_LENGTH) {
      warnings.push(`原始文本较长，已截断到 ${MAX_RAW_TEXT_LENGTH} 字以内。`);
    }

    return {
      rawText: cleaned.slice(0, MAX_RAW_TEXT_LENGTH),
      method,
      warnings,
    };
  } catch (error) {
    if (error instanceof DocumentIngestionError) {
      throw error;
    }

    throw new DocumentIngestionError(
      "EXTRACT_TEXT_FAILED",
      "提取文档文字失败，请确认文件未损坏，或改用 docx/txt/md 格式上传。",
      422,
    );
  }
}
