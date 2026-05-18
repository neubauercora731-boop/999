import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

const HEADING_LEVEL_MAP = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
  5: HeadingLevel.HEADING_5,
  6: HeadingLevel.HEADING_6,
} as const;

function getHeadingLevel(level: number) {
  switch (level) {
    case 1:
      return HEADING_LEVEL_MAP[1];
    case 2:
      return HEADING_LEVEL_MAP[2];
    case 3:
      return HEADING_LEVEL_MAP[3];
    case 4:
      return HEADING_LEVEL_MAP[4];
    case 5:
      return HEADING_LEVEL_MAP[5];
    case 6:
      return HEADING_LEVEL_MAP[6];
    default:
      return HeadingLevel.HEADING_3;
  }
}

function normalizeMarkdown(value: string) {
  return value.replace(/\r\n/g, "\n").trim();
}

function stripMarkdownSyntax(value: string) {
  return value
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .trim();
}

function createInlineRuns(text: string) {
  const segments = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);

  return segments.map((segment) => {
    const isBold = segment.startsWith("**") && segment.endsWith("**");
    return new TextRun({
      text: isBold ? segment.slice(2, -2) : segment,
      bold: isBold,
      size: 24,
    });
  });
}

function createCodeParagraphs(codeLines: string[]) {
  return codeLines.map(
    (line) =>
      new Paragraph({
        children: [
          new TextRun({
            text: line,
            font: "Consolas",
            size: 21,
          }),
        ],
        spacing: {
          after: 80,
        },
      }),
  );
}

function createBodyParagraphs(markdown: string) {
  const normalized = normalizeMarkdown(markdown);
  const lines = normalized.split("\n");
  const paragraphs: Paragraph[] = [];
  const codeLines: string[] = [];
  let inCodeBlock = false;

  lines.forEach((rawLine, index) => {
    const line = rawLine.replace(/\s+$/, "");
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        paragraphs.push(...createCodeParagraphs(codeLines));
        codeLines.length = 0;
      }
      inCodeBlock = !inCodeBlock;
      return;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      return;
    }

    if (!trimmed) {
      paragraphs.push(
        new Paragraph({
          spacing: {
            after: 120,
          },
        }),
      );
      return;
    }

    if (/^-{3,}$/.test(trimmed)) {
      paragraphs.push(
        new Paragraph({
          spacing: {
            after: 180,
          },
        }),
      );
      return;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      paragraphs.push(
        new Paragraph({
          text: stripMarkdownSyntax(headingMatch[2]),
          heading: getHeadingLevel(level),
          spacing: {
            before: 240,
            after: 120,
          },
        }),
      );
      return;
    }

    const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (bulletMatch) {
      paragraphs.push(
        new Paragraph({
          children: createInlineRuns(bulletMatch[1]),
          bullet: {
            level: 0,
          },
          spacing: {
            after: 80,
          },
        }),
      );
      return;
    }

    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (numberedMatch) {
      paragraphs.push(
        new Paragraph({
          children: createInlineRuns(`${numberedMatch[1]}. ${numberedMatch[2]}`),
          spacing: {
            after: 80,
          },
        }),
      );
      return;
    }

    const isCoverTitle = index === 0 && trimmed.includes("实验报告");

    paragraphs.push(
      new Paragraph({
        children: createInlineRuns(trimmed),
        alignment: isCoverTitle ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: {
          after: isCoverTitle ? 220 : 100,
        },
      }),
    );
  });

  if (codeLines.length > 0) {
    paragraphs.push(...createCodeParagraphs(codeLines));
  }

  return paragraphs;
}

export function createDocxFileName(taskTitle: string, experimentName?: string | null) {
  const baseName = (experimentName || taskTitle || "lab-report")
    .replace(/[^\w\u4e00-\u9fff.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return `${baseName || "lab-report"}.docx`;
}

export async function exportReportToDocx(markdown: string) {
  const document = new Document({
    sections: [
      {
        properties: {},
        children: createBodyParagraphs(markdown),
      },
    ],
  });

  return Packer.toBuffer(document);
}
