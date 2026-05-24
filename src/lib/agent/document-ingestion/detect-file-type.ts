import type { DetectedDocumentFile, DocumentFileType } from "./types";

const IMAGE_MIME_PREFIX = "image/";

function getExtension(fileName: string) {
  const lastDotIndex = fileName.lastIndexOf(".");
  if (lastDotIndex < 0) return "";
  return fileName.slice(lastDotIndex + 1).trim().toLowerCase();
}

export function detectDocumentFileType(
  fileName: string,
  mimeType: string | null | undefined,
): DetectedDocumentFile {
  const normalizedMime = mimeType?.trim().toLowerCase() || null;
  const extension = getExtension(fileName);
  let fileType: DocumentFileType = "unknown";

  if (
    extension === "docx" ||
    normalizedMime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    fileType = "docx";
  } else if (
    extension === "doc" ||
    normalizedMime === "application/msword" ||
    normalizedMime === "application/vnd.ms-word"
  ) {
    fileType = "doc";
  } else if (extension === "txt" || normalizedMime?.startsWith("text/plain")) {
    fileType = "txt";
  } else if (extension === "md" || extension === "markdown") {
    fileType = "md";
  } else if (extension === "pdf" || normalizedMime === "application/pdf") {
    fileType = "pdf";
  } else if (
    normalizedMime?.startsWith(IMAGE_MIME_PREFIX) ||
    ["png", "jpg", "jpeg", "webp", "gif", "bmp"].includes(extension)
  ) {
    fileType = "image";
  }

  if (fileType === "pdf") {
    return {
      fileType,
      extension,
      mimeType: normalizedMime,
      supported: false,
      warning: "当前版本暂不支持 PDF 文本解析。",
    };
  }

  if (fileType === "image") {
    return {
      fileType,
      extension,
      mimeType: normalizedMime,
      supported: false,
      warning: "当前版本暂不支持图片 OCR。",
    };
  }

  return {
    fileType,
    extension,
    mimeType: normalizedMime,
    supported: ["docx", "doc", "txt", "md"].includes(fileType),
    warning: fileType === "unknown" ? "当前版本暂不支持该文件类型。" : undefined,
  };
}
