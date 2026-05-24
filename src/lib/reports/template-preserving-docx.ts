import JSZip from "jszip";

import {
  detectImplementationResultCell,
  detectProblemThinkingCell,
  detectSectionedLabReportTargets,
  detectTaskBlockInsertionPoint,
  type ParagraphTarget,
} from "@/lib/reports/task-block-detector";

export const DOCX_EXPORT_MODES = {
  AUTO: "auto",
  GENERATED_REPORT_DOCX: "generated_report_docx",
  PATCH_ORIGINAL_DOCX: "patch_original_docx",
} as const;

export type DocxExportMode =
  (typeof DOCX_EXPORT_MODES)[keyof typeof DOCX_EXPORT_MODES];

export class TemplatePreservingDocxError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "TemplatePreservingDocxError";
    this.code = code;
    this.status = status;
  }
}

export type TemplateFillMode =
  | "full_report"
  | "screenshot_only_table"
  | "sectioned_lab_report";

interface PatchOriginalDocxInput {
  originalDocx: Uint8Array | Buffer;
  reportMarkdown: string;
  generatedCode?: string | null;
  stdout?: string | null;
  stderr?: string | null;
  sourceFileName: string;
  screenshotRequired: boolean;
  screenshotMissing: boolean;
  screenshotNotes?: string[];
  screenshots?: PatchScreenshotInput[];
  fillMode?: TemplateFillMode;
  screenshotCaption?: string;
  problemThinkingText?: string;
}

export interface PatchScreenshotInput {
  imageBytes: Uint8Array | Buffer;
  contentType: "image/png";
  fileName: string;
  description: string;
  createdAt: string;
  storagePath?: string;
  type?: "command_output_screenshot" | "browser_page_screenshot";
  source?: string;
}

export interface PatchOriginalDocxResult {
  buffer: Buffer;
  metadata: {
    insertedAfterParagraphText: string;
    insertedParagraphCount: number;
    screenshotRequired: boolean;
    screenshotMissing: boolean;
    screenshotInsertedCount: number;
    insertionPointScore: number;
    insertionPointReason: string;
    insertionPointKeywordMatches: string[];
    preserveOriginalDocx: true;
    insertionMode: "append_under_task" | "fill_table_cells" | "fill_section_markers";
    rewriteWholeDocument: false;
    originalDocumentPolicy: "immutable_except_explicit_fill_cells";
    fillMode: TemplateFillMode;
    tableTargets?: Array<{
      labelText: string;
      tableIndex: number;
      rowIndex: number;
      cellIndex: number;
      reason: string;
    }>;
    sectionTargets?: Array<{
      labelText: string;
      paragraphIndex: number;
      reason: string;
    }>;
  };
}

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripControlChars(value: string) {
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
}

function extractReusableParagraphProperties(paragraphXml: string) {
  const match = paragraphXml.match(/<w:pPr[\s\S]*?<\/w:pPr>/);
  if (!match) return "";

  return match[0]
    .replace(/<w:numPr[\s\S]*?<\/w:numPr>/g, "")
    .replace(/<w:sectPr[\s\S]*?<\/w:sectPr>/g, "");
}

function extractReusableCellProperties(cellXml: string) {
  const match = cellXml.match(/<w:tcPr[\s\S]*?<\/w:tcPr>/);
  return match?.[0] ?? "";
}

function paragraphXml(
  text: string,
  options: {
    basePPr?: string;
    bold?: boolean;
    code?: boolean;
    color?: string;
  } = {},
) {
  const clean = stripControlChars(text);
  const runProperties = options.code
    ? '<w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:eastAsia="Consolas"/><w:sz w:val="20"/></w:rPr>'
    : options.bold
      ? `<w:rPr><w:b/><w:sz w:val="24"/>${options.color ? `<w:color w:val="${options.color}"/>` : ""}</w:rPr>`
      : options.color
        ? `<w:rPr><w:color w:val="${options.color}"/></w:rPr>`
        : "";

  return [
    "<w:p>",
    options.basePPr ?? "",
    "<w:r>",
    runProperties,
    `<w:t xml:space="preserve">${xmlEscape(clean || " ")}</w:t>`,
    "</w:r>",
    "</w:p>",
  ].join("");
}

function codeParagraphXml(text: string) {
  const clean = stripControlChars(text).replace(/\t/g, "    ");

  return [
    "<w:p>",
    '<w:pPr><w:spacing w:before="0" w:after="0" w:line="276" w:lineRule="auto"/><w:jc w:val="left"/></w:pPr>',
    "<w:r>",
    '<w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:eastAsia="Consolas"/><w:sz w:val="18"/></w:rPr>',
    `<w:t xml:space="preserve">${xmlEscape(clean || " ")}</w:t>`,
    "</w:r>",
    "</w:p>",
  ].join("");
}

function codeBlockParagraphs(code: string, basePPr = "") {
  const lines = code.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  return [
    paragraphXml("【代码】", { basePPr, bold: true }),
    ...lines.map((line) => codeParagraphXml(line)),
  ];
}

function getPngSize(imageBytes: Uint8Array | Buffer) {
  const buffer = Buffer.from(imageBytes);
  const isPng =
    buffer.length >= 24 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47;

  if (!isPng) return { width: 1280, height: 720 };

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function imageParagraphXml(input: {
  relId: string;
  name: string;
  description: string;
  docPrId: number;
  width: number;
  height: number;
  maxWidthInches?: number;
}) {
  const maxWidthEmu = (input.maxWidthInches ?? 5.8) * 914400;
  const ratio = input.height / Math.max(input.width, 1);
  const cx = Math.round(maxWidthEmu);
  const cy = Math.round(maxWidthEmu * ratio);
  const name = xmlEscape(input.name);
  const description = xmlEscape(input.description);

  return `
<w:p>
  <w:r>
    <w:drawing>
      <wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
        <wp:extent cx="${cx}" cy="${cy}"/>
        <wp:docPr id="${input.docPrId}" name="${name}" descr="${description}"/>
        <wp:cNvGraphicFramePr>
          <a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>
        </wp:cNvGraphicFramePr>
        <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
          <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
            <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
              <pic:nvPicPr>
                <pic:cNvPr id="0" name="${name}" descr="${description}"/>
                <pic:cNvPicPr/>
              </pic:nvPicPr>
              <pic:blipFill>
                <a:blip r:embed="${input.relId}"/>
                <a:stretch>
                  <a:fillRect/>
                </a:stretch>
              </pic:blipFill>
              <pic:spPr>
                <a:xfrm>
                  <a:off x="0" y="0"/>
                  <a:ext cx="${cx}" cy="${cy}"/>
                </a:xfrm>
                <a:prstGeom prst="rect">
                  <a:avLst/>
                </a:prstGeom>
              </pic:spPr>
            </pic:pic>
          </a:graphicData>
        </a:graphic>
      </wp:inline>
    </w:drawing>
  </w:r>
</w:p>`;
}

function ensurePngContentType(contentTypesXml: string) {
  if (/Extension="png"/.test(contentTypesXml)) return contentTypesXml;

  return contentTypesXml.replace(
    "</Types>",
    '<Default Extension="png" ContentType="image/png"/></Types>',
  );
}

function ensureDocumentRelationshipNamespace(documentXml: string) {
  if (documentXml.includes("xmlns:r=")) return documentXml;

  return documentXml.replace(
    /<w:document\b/,
    '<w:document xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"',
  );
}

function getNextRelationshipId(relsXml: string) {
  const ids = Array.from(relsXml.matchAll(/Id="rId(\d+)"/g)).map((match) =>
    Number(match[1]),
  );

  return Math.max(0, ...ids) + 1;
}

async function prepareScreenshotImageParagraphs(
  zip: JSZip,
  screenshots: PatchScreenshotInput[],
  captionOverride?: string,
  options: { maxWidthInches?: number } = {},
) {
  if (screenshots.length === 0) return [];

  const relsPath = "word/_rels/document.xml.rels";
  const relsFile = zip.file(relsPath);
  let relsXml =
    (await relsFile?.async("string")) ??
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
  let nextRelationshipId = getNextRelationshipId(relsXml);
  const paragraphs: string[] = [];

  screenshots.forEach((screenshot, index) => {
    const mediaName = `system-run-screenshot-${Date.now()}-${index + 1}.png`;
    const relId = `rId${nextRelationshipId}`;
    nextRelationshipId += 1;
    const imageBytes = Buffer.from(screenshot.imageBytes);
    const size = getPngSize(imageBytes);
    const description =
      screenshot.description ||
      (screenshot.type === "browser_page_screenshot"
        ? "真实网页效果截图，来源于浏览器渲染结果。"
        : "真实运行截图，来源于 run-code 结果。");

    zip.file(`word/media/${mediaName}`, imageBytes);
    relsXml = relsXml.replace(
      "</Relationships>",
      `<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${mediaName}"/></Relationships>`,
    );
    paragraphs.push(
      imageParagraphXml({
        relId,
        name: screenshot.fileName || mediaName,
        description,
        docPrId: Date.now() % 1000000 + index,
        width: size.width,
        height: size.height,
        maxWidthInches: options.maxWidthInches,
      }),
    );
    paragraphs.push(
      paragraphXml(
        captionOverride ||
          `${description}生成时间：${screenshot.createdAt}。该图片由真实运行结果生成，未使用 AI 伪造。`,
      ),
    );
  });

  zip.file(relsPath, relsXml);

  const contentTypesFile = zip.file("[Content_Types].xml");
  if (contentTypesFile) {
    const contentTypesXml = await contentTypesFile.async("string");
    zip.file("[Content_Types].xml", ensurePngContentType(contentTypesXml));
  }

  return paragraphs;
}

function markdownToInsertedParagraphs(markdown: string, basePPr: string) {
  if (!markdown.trim()) return [];

  const paragraphs: string[] = [];
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let inCodeBlock = false;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock) {
      paragraphs.push(codeParagraphXml(line));
      continue;
    }

    if (!trimmed) {
      paragraphs.push(paragraphXml("", { basePPr }));
      continue;
    }

    const headingMatch = trimmed.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch) {
      paragraphs.push(paragraphXml(headingMatch[1], { basePPr, bold: true }));
      continue;
    }

    const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (bulletMatch) {
      paragraphs.push(paragraphXml(`• ${bulletMatch[1]}`, { basePPr }));
      continue;
    }

    paragraphs.push(
      paragraphXml(trimmed.replace(/\*\*([^*]+)\*\*/g, "$1"), { basePPr }),
    );
  }

  return paragraphs;
}

function buildPreScreenshotMarkdown(input: PatchOriginalDocxInput) {
  const parts: string[] = [];

  if (input.generatedCode?.trim()) {
    parts.push(
      [
        "【代码】",
        "```python",
        input.generatedCode.trim(),
        "```",
      ].join("\n"),
    );
  }

  if (input.stdout?.trim() || input.stderr?.trim()) {
    parts.push(
      [
        "【运行结果】",
        input.stdout?.trim()
          ? `stdout:\n\`\`\`text\n${input.stdout.trim()}\n\`\`\``
          : "stdout: 未捕获到输出。",
        input.stderr?.trim()
          ? `stderr:\n\`\`\`text\n${input.stderr.trim()}\n\`\`\``
          : "stderr: 无错误输出。",
      ].join("\n\n"),
    );
  }

  if (input.screenshotRequired) {
    if (input.screenshotMissing) {
      parts.push(
        [
          "【截图缺失】",
          "任务书要求提供真实运行截图，但当前流程未捕获到真实截图。请补充真实运行截图后再最终提交。",
          ...(input.screenshotNotes ?? []),
        ].join("\n"),
      );
    } else {
      parts.push(
        [
          "【运行截图】",
          "已检测到真实截图材料，导出时会插入任务下方。",
          ...(input.screenshotNotes ?? []),
        ].join("\n"),
      );
    }
  }

  return parts.join("\n\n");
}

function buildPostScreenshotMarkdown(input: PatchOriginalDocxInput) {
  return ["【结果分析】", input.reportMarkdown.trim()].join("\n\n");
}

function replaceCellContent(cellXml: string, bodyParagraphs: string[]) {
  const tcPr = extractReusableCellProperties(cellXml);
  return `<w:tc>${tcPr}${bodyParagraphs.join("")}</w:tc>`;
}

function replaceRange(value: string, start: number, end: number, replacement: string) {
  return `${value.slice(0, start)}${replacement}${value.slice(end)}`;
}

function plainParagraphsFromText(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => paragraphXml(line));
}

async function patchScreenshotOnlyTable(input: {
  zip: JSZip;
  documentXml: string;
  patchInput: PatchOriginalDocxInput;
}) {
  const implementationCell = detectImplementationResultCell(input.documentXml);
  const problemCell = detectProblemThinkingCell(input.documentXml);

  if (!implementationCell) {
    throw new TemplatePreservingDocxError(
      "IMPLEMENTATION_RESULT_CELL_NOT_FOUND",
      "无法安全定位“实施过程与结果分析”对应的表格填写区域，请用户确认插入位置。",
    );
  }

  if (!problemCell) {
    throw new TemplatePreservingDocxError(
      "PROBLEM_THINKING_CELL_NOT_FOUND",
      "无法安全定位“问题及思考”对应的表格填写区域，请用户确认插入位置。",
    );
  }

  const screenshotParagraphs =
    input.patchInput.screenshotRequired && input.patchInput.screenshotMissing
      ? [
          paragraphXml("【截图缺失】", { bold: true }),
          paragraphXml(
            "任务书要求提供真实运行截图，但当前流程未捕获到真实截图。请补充真实运行截图后再最终提交。",
          ),
        ]
      : [
          paragraphXml("【运行截图】", { bold: true }),
          ...(await prepareScreenshotImageParagraphs(
            input.zip,
            input.patchInput.screenshots ?? [],
            input.patchInput.screenshotCaption ||
              "代码及运行结果截图如上。截图来源于本次真实运行过程，用于展示程序执行、输出结果和模型评价指标。",
          )),
        ];

  if (
    input.patchInput.screenshotRequired &&
    !input.patchInput.screenshotMissing &&
    screenshotParagraphs.length <= 1
  ) {
    throw new TemplatePreservingDocxError(
      "SCREENSHOT_REQUIRED_BUT_IMAGE_NOT_FOUND",
      "任务要求截图，但未找到可插入的真实 PNG 截图。",
    );
  }

  const problemParagraphs = [
    paragraphXml("【问题及思考】", { bold: true }),
    ...plainParagraphsFromText(
      input.patchInput.problemThinkingText ||
        "本次实验中需要注意数据特征与预测目标之间并非完全线性关系，线性回归便于解释主要影响因素，多项式回归可刻画非线性趋势，逻辑回归适合挂科风险二分类预警。实际应用时应关注数据质量、样本规模、特征选择和模型泛化能力，避免只根据单次结果判断模型优劣。",
    ),
  ];

  const replacements = [
    {
      target: implementationCell,
      xml: replaceCellContent(implementationCell.xml, screenshotParagraphs),
    },
    {
      target: problemCell,
      xml: replaceCellContent(problemCell.xml, problemParagraphs),
    },
  ].sort((a, b) => b.target.start - a.target.start);

  let patchedXml = input.documentXml;
  for (const replacement of replacements) {
    patchedXml = replaceRange(
      patchedXml,
      replacement.target.start,
      replacement.target.end,
      replacement.xml,
    );
  }

  return {
    patchedXml,
    insertedParagraphCount: screenshotParagraphs.length + problemParagraphs.length,
    tableTargets: [implementationCell, problemCell].map((target) => ({
      labelText: target.labelText,
      tableIndex: target.tableIndex,
      rowIndex: target.rowIndex,
      cellIndex: target.cellIndex,
      reason: target.reason,
    })),
  };
}

function buildSectionScreenshotCaption(input: PatchOriginalDocxInput) {
  const context = `${input.reportMarkdown}\n${input.generatedCode ?? ""}\n${input.stdout ?? ""}`;
  if (/哈夫曼|Huffman|WPL/i.test(context)) {
    return "【运行截图】上图为本次程序真实运行截图，展示哈夫曼树构造过程与 WPL 计算结果。";
  }
  if (/括号匹配|bracket/i.test(context)) {
    return "【运行截图】上图为本次程序真实运行截图，展示括号匹配程序的实际判断结果。";
  }
  if (/双栈|算术表达式|表达式求值|stack/i.test(context)) {
    return "【运行截图】上图为本次程序真实运行截图，展示表达式求值算法执行结果。";
  }
  return "【运行截图】上图为本次程序真实运行截图，展示程序的实际输出结果。";
}

function buildDefaultProblemThinkingText(input: PatchOriginalDocxInput) {
  const context = `${input.reportMarkdown}\n${input.generatedCode ?? ""}\n${input.stdout ?? ""}`;
  if (/哈夫曼|Huffman|WPL/i.test(context)) {
    return "通过本次实验，进一步掌握了哈夫曼树的贪心构造过程，理解了每次选取最小权值节点合并的原因，并能结合运行结果校验带权路径长度 WPL。调试时重点关注权值输入合法性、堆中节点合并顺序和叶子节点深度计算。";
  }
  if (/括号匹配|bracket/i.test(context)) {
    return "通过本次实验，进一步掌握了栈在括号匹配中的应用，理解了左括号入栈、右括号出栈匹配以及最终栈空判断的过程。调试时重点关注括号类型对应关系、右括号提前出现和输入结束后栈内是否仍有未匹配左括号等边界情况。";
  }
  if (/双栈|算术表达式|表达式求值|stack/i.test(context)) {
    return "通过本次实验，进一步掌握了栈的后进先出特点，理解了运算符优先级、括号匹配和中间结果入栈过程。调试时重点关注空栈、括号匹配和非法表达式等边界情况。";
  }
  return "通过本次实验，进一步理解了任务所涉及的数据结构与算法实现过程。调试时重点关注输入合法性、边界条件、核心步骤输出和最终结果校验，确保程序运行结果与实验要求一致。";
}

async function buildSectionScreenshotParagraphs(input: {
  zip: JSZip;
  patchInput: PatchOriginalDocxInput;
  basePPr?: string;
}) {
  if (input.patchInput.screenshotRequired && input.patchInput.screenshotMissing) {
    return [
      paragraphXml("【截图缺失】", { basePPr: input.basePPr, bold: true }),
      paragraphXml(
        "任务书要求提供真实运行截图，但当前流程未捕获到真实截图。请补充真实运行截图后再最终提交。",
        { basePPr: input.basePPr },
      ),
    ];
  }

  if (!input.patchInput.screenshotRequired) {
    return [] as string[];
  }

  const screenshots = await prepareScreenshotImageParagraphs(
    input.zip,
    input.patchInput.screenshots ?? [],
    input.patchInput.screenshotCaption || buildSectionScreenshotCaption(input.patchInput),
    { maxWidthInches: 3.15 },
  );

  if (screenshots.length === 0) {
    throw new TemplatePreservingDocxError(
      "SCREENSHOT_REQUIRED_BUT_IMAGE_NOT_FOUND",
      "任务要求截图，但未找到可插入的真实 PNG 截图。",
    );
  }

  return screenshots;
}

async function patchSectionedLabReport(input: {
  zip: JSZip;
  documentXml: string;
  patchInput: PatchOriginalDocxInput;
}) {
  const targets = detectSectionedLabReportTargets(input.documentXml);

  if (!targets.code || !targets.screenshot || !targets.problemThinking) {
    throw new TemplatePreservingDocxError(
      "SECTIONED_LAB_TARGETS_NOT_FOUND",
      `无法安全定位段落式实验报告填写位置：${targets.warnings.join("；")}`,
    );
  }

  const codeBasePPr = extractReusableParagraphProperties(targets.code.xml);
  const screenshotBasePPr = extractReusableParagraphProperties(targets.screenshot.xml);
  const problemBasePPr = extractReusableParagraphProperties(targets.problemThinking.xml);
  const codeText = input.patchInput.generatedCode?.trim();

  const codeParagraphs = codeText
    ? codeBlockParagraphs(codeText, codeBasePPr)
    : [
        paragraphXml("【代码】", { basePPr: codeBasePPr, bold: true }),
        paragraphXml("当前任务尚未生成可插入的代码。", { basePPr: codeBasePPr }),
      ];
  const screenshotParagraphs = await buildSectionScreenshotParagraphs({
    zip: input.zip,
    patchInput: input.patchInput,
    basePPr: screenshotBasePPr,
  });
  const problemParagraphs = [
    paragraphXml(
      `【问题及思考】 ${
        input.patchInput.problemThinkingText || buildDefaultProblemThinkingText(input.patchInput)
      }`,
      { basePPr: problemBasePPr },
    ),
  ];

  const replacements: Array<{ start: number; end: number; xml: string }> = [
    {
      start: targets.code.end,
      end: targets.code.end,
      xml: codeParagraphs.join(""),
    },
    {
      start: targets.screenshot.end,
      end: targets.screenshot.end,
      xml: screenshotParagraphs.join(""),
    },
  ];

  if (targets.problemPlaceholder) {
    replacements.push({
      start: targets.problemPlaceholder.start,
      end: targets.problemPlaceholder.end,
      xml: problemParagraphs.join(""),
    });
  } else {
    replacements.push({
      start: targets.problemThinking.end,
      end: targets.problemThinking.end,
      xml: problemParagraphs.join(""),
    });
  }

  let patchedXml = input.documentXml;
  for (const replacement of replacements.sort((a, b) => b.start - a.start)) {
    patchedXml = replaceRange(
      patchedXml,
      replacement.start,
      replacement.end,
      replacement.xml,
    );
  }

  return {
    patchedXml,
    insertedParagraphCount:
      codeParagraphs.length + screenshotParagraphs.length + problemParagraphs.length,
    sectionTargets: [
      targets.code,
      targets.screenshot,
      targets.problemThinking,
      targets.problemPlaceholder,
    ]
      .filter((target): target is ParagraphTarget => target !== null)
      .map((target) => ({
        labelText: target.text,
        paragraphIndex: target.index,
        reason: target.reason,
      })),
  };
}

export async function patchOriginalDocxWithFill(
  input: PatchOriginalDocxInput,
): Promise<PatchOriginalDocxResult> {
  let zip: JSZip;

  try {
    zip = await JSZip.loadAsync(Buffer.from(input.originalDocx));
  } catch {
    throw new TemplatePreservingDocxError(
      "UNSAFE_DOCX_PACKAGE",
      "当前任务书不是标准 Office Open XML DOCX，无法安全保持原格式。请上传标准 .docx，或先启用安全转换流程。",
    );
  }

  const documentFile = zip.file("word/document.xml");
  if (!documentFile) {
    throw new TemplatePreservingDocxError(
      "DOCX_DOCUMENT_XML_NOT_FOUND",
      "当前 DOCX 缺少 word/document.xml，无法安全保持原格式。",
    );
  }

  const documentXml = ensureDocumentRelationshipNamespace(
    await documentFile.async("string"),
  );
  const hasReportTableTargets =
    Boolean(detectImplementationResultCell(documentXml)) &&
    Boolean(detectProblemThinkingCell(documentXml));
  const sectionedTargets = detectSectionedLabReportTargets(documentXml);
  const hasSectionedLabTargets =
    Boolean(sectionedTargets.code) &&
    Boolean(sectionedTargets.screenshot) &&
    Boolean(sectionedTargets.problemThinking);
  const fillMode =
    input.fillMode ??
    (hasReportTableTargets
      ? "screenshot_only_table"
      : hasSectionedLabTargets
        ? "sectioned_lab_report"
        : "full_report");

  let patchedXml = documentXml;
  let insertedParagraphCount = 0;
  let insertedAfterParagraphText = "";
  let insertionPointScore = 0;
  let insertionPointReason = "";
  let insertionPointKeywordMatches: string[] = [];
  let tableTargets: PatchOriginalDocxResult["metadata"]["tableTargets"];
  let sectionTargets: PatchOriginalDocxResult["metadata"]["sectionTargets"];

  if (fillMode === "screenshot_only_table") {
    const tablePatch = await patchScreenshotOnlyTable({
      zip,
      documentXml,
      patchInput: input,
    });
    patchedXml = tablePatch.patchedXml;
    insertedParagraphCount = tablePatch.insertedParagraphCount;
    tableTargets = tablePatch.tableTargets;
    insertedAfterParagraphText = tableTargets.map((target) => target.labelText).join(" / ");
    insertionPointScore = 100;
    insertionPointReason = "按模板表格标签定向填充右侧单元格";
    insertionPointKeywordMatches = ["实施过程与结果分析", "问题及思考"];
  } else if (fillMode === "sectioned_lab_report") {
    const sectionPatch = await patchSectionedLabReport({
      zip,
      documentXml,
      patchInput: input,
    });
    patchedXml = sectionPatch.patchedXml;
    insertedParagraphCount = sectionPatch.insertedParagraphCount;
    sectionTargets = sectionPatch.sectionTargets;
    insertedAfterParagraphText = sectionTargets.map((target) => target.labelText).join(" / ");
    insertionPointScore = 100;
    insertionPointReason = "按段落标记分别填充实验代码、运行截图、问题及思考";
    insertionPointKeywordMatches = ["实验代码", "实验结果与分析", "问题及思考"];
  } else {
    const detection = detectTaskBlockInsertionPoint(documentXml);
    const insertionPoint = detection.selected;

    if (!insertionPoint) {
      throw new TemplatePreservingDocxError(
        "INSERTION_POINT_NOT_FOUND",
        "无法可靠定位任务填写位置。为避免破坏原文档格式，请先让用户确认插入位置。",
      );
    }

    const basePPr = extractReusableParagraphProperties(insertionPoint.xml);
    const preScreenshotMarkdown = buildPreScreenshotMarkdown(input);
    const postScreenshotMarkdown = buildPostScreenshotMarkdown(input);
    const screenshotImageParagraphs = await prepareScreenshotImageParagraphs(
      zip,
      input.screenshots ?? [],
    );
    const insertedParagraphs = [
      ...markdownToInsertedParagraphs(preScreenshotMarkdown, basePPr),
      ...screenshotImageParagraphs,
      ...markdownToInsertedParagraphs(postScreenshotMarkdown, basePPr),
    ];
    const insertXml = insertedParagraphs.join("");
    patchedXml = `${documentXml.slice(0, insertionPoint.end)}${insertXml}${documentXml.slice(
      insertionPoint.end,
    )}`;
    insertedParagraphCount = insertedParagraphs.length;
    insertedAfterParagraphText = insertionPoint.text;
    insertionPointScore = insertionPoint.score;
    insertionPointReason = insertionPoint.reason;
    insertionPointKeywordMatches = insertionPoint.keywordMatches;
  }

  zip.file("word/document.xml", patchedXml);

  const generated = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
  });

  return {
    buffer: Buffer.from(generated),
    metadata: {
      insertedAfterParagraphText,
      insertedParagraphCount,
      screenshotRequired: input.screenshotRequired,
      screenshotMissing: input.screenshotMissing,
      screenshotInsertedCount: input.screenshots?.length ?? 0,
      insertionPointScore,
      insertionPointReason,
      insertionPointKeywordMatches,
      preserveOriginalDocx: true,
      insertionMode:
        fillMode === "screenshot_only_table"
          ? "fill_table_cells"
          : fillMode === "sectioned_lab_report"
            ? "fill_section_markers"
            : "append_under_task",
      rewriteWholeDocument: false,
      originalDocumentPolicy: "immutable_except_explicit_fill_cells",
      fillMode,
      tableTargets,
      sectionTargets,
    },
  };
}
