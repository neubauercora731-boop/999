export type DownloadHeaderInput = {
  filename: string;
  fallbackFilename?: string;
  contentType: string;
};

export function sanitizeAsciiFilename(input: string, fallback = "download") {
  const withoutPath = input.replace(/[\\/]/g, "_");
  const ascii = withoutPath
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/["<>|:*?]/g, "_")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .trim();

  return ascii || fallback;
}

export function encodeRFC5987Value(value: string) {
  return encodeURIComponent(value)
    .replace(/['()]/g, (char) =>
      `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
    )
    .replace(/\*/g, "%2A");
}

export function makeContentDisposition(
  filename: string,
  fallbackFilename = "download",
) {
  const safeFallback = sanitizeAsciiFilename(fallbackFilename || filename, "download");
  const safeDisplayFilename = filename.replace(/[\\/]/g, "_");
  const encodedFilename = encodeRFC5987Value(safeDisplayFilename);

  return `attachment; filename="${safeFallback}"; filename*=UTF-8''${encodedFilename}`;
}

export function makeDownloadHeaders(input: DownloadHeaderInput): HeadersInit {
  return {
    "Content-Type": input.contentType,
    "Content-Disposition": makeContentDisposition(
      input.filename,
      input.fallbackFilename,
    ),
  };
}

export function decodeHeaderValue(value: string | null) {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
