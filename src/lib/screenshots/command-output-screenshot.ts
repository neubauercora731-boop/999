import { createHash } from "node:crypto";

import type {
  CommandOutputScreenshotInput,
  GeneratedScreenshotImage,
} from "./types";

const IMAGE_WIDTH = 1280;
const PADDING_X = 48;
const HEADER_HEIGHT = 86;
const LINE_HEIGHT = 26;
const MAX_LINES = 54;
const MAX_LINE_CHARS = 116;

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeLine(value: string) {
  return value.replace(/\t/g, "    ").replace(/\r/g, "");
}

function wrapLine(value: string) {
  const line = normalizeLine(value);
  if (line.length <= MAX_LINE_CHARS) return [line];

  const chunks: string[] = [];
  for (let index = 0; index < line.length; index += MAX_LINE_CHARS) {
    chunks.push(line.slice(index, index + MAX_LINE_CHARS));
  }
  return chunks;
}

function pushWrapped(lines: string[], label: string, value: string) {
  lines.push(label);
  const normalized = value.trimEnd();
  if (!normalized) {
    lines.push("  (empty)");
    return;
  }

  for (const rawLine of normalized.split("\n")) {
    for (const wrapped of wrapLine(rawLine)) {
      lines.push(`  ${wrapped}`);
    }
  }
}

function buildEvidenceLines(input: CommandOutputScreenshotInput) {
  const codeHash = createHash("sha256").update(input.code).digest("hex");
  const codePreview = input.code.split("\n").slice(0, 16).join("\n");
  const lines = [
    "REAL RUN RECORD / 真实运行记录",
    `Task ID: ${input.taskId}`,
    `Run ID: ${input.runId}`,
    `Command: ${input.command}`,
    `Filename: ${input.filename}`,
    `Exit code: ${input.exitCode === null ? "null" : input.exitCode}`,
    `Duration: ${input.durationMs}ms`,
    `Timed out: ${input.timedOut ? "true" : "false"}`,
    `Created at: ${input.createdAt}`,
    `Code SHA256: ${codeHash}`,
    "",
  ];

  pushWrapped(lines, "Code preview:", codePreview);
  lines.push("");
  pushWrapped(lines, "stdout:", input.stdout);
  lines.push("");
  pushWrapped(lines, "stderr:", input.stderr);

  if (lines.length > MAX_LINES) {
    return {
      lines: [
        ...lines.slice(0, MAX_LINES - 2),
        "...output/code preview truncated in screenshot; full stdout/stderr is stored in task outputs.",
      ],
      warnings: ["运行截图内容过长，已在图片中截断；完整 stdout/stderr 已保存在任务输出。"],
    };
  }

  return { lines, warnings: [] };
}

function createSvg(lines: string[], height: number) {
  const textLines = lines
    .map((line, index) => {
      const y = HEADER_HEIGHT + 34 + index * LINE_HEIGHT;
      const fill =
        line.startsWith("stderr:") || line.includes("Exit code: 1")
          ? "#ffb4b4"
          : line.startsWith("stdout:")
            ? "#b7f7c8"
            : "#f3f6fb";
      return `<text x="${PADDING_X}" y="${y}" fill="${fill}">${escapeXml(line)}</text>`;
    })
    .join("\n");

  return `
<svg width="${IMAGE_WIDTH}" height="${height}" viewBox="0 0 ${IMAGE_WIDTH} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" rx="26" fill="#0f172a"/>
  <rect x="0" y="0" width="100%" height="${HEADER_HEIGHT}" rx="26" fill="#111827"/>
  <circle cx="48" cy="43" r="11" fill="#ef4444"/>
  <circle cx="82" cy="43" r="11" fill="#f59e0b"/>
  <circle cx="116" cy="43" r="11" fill="#22c55e"/>
  <text x="160" y="51" fill="#d1d5db" font-family="Consolas, 'Microsoft YaHei', monospace" font-size="22" font-weight="700">Lab Report Assistant - Real Run Evidence</text>
  <g font-family="Consolas, 'Microsoft YaHei', monospace" font-size="20">
    ${textLines}
  </g>
</svg>`;
}

export async function generateCommandOutputScreenshot(
  input: CommandOutputScreenshotInput,
): Promise<GeneratedScreenshotImage> {
  const { lines, warnings } = buildEvidenceLines(input);
  const height = Math.max(720, HEADER_HEIGHT + 70 + lines.length * LINE_HEIGHT);
  const svg = createSvg(lines, height);
  const sharpModule = await import("sharp");
  const sharp = sharpModule.default;
  const buffer = await sharp(Buffer.from(svg)).png().toBuffer();

  return {
    buffer,
    width: IMAGE_WIDTH,
    height,
    warnings,
  };
}
