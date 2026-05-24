import JSZip from "jszip";

import { extractParagraphText } from "@/lib/reports/task-block-detector";

export type DocxPreservationValidationResult = {
  passed: boolean;
  originalTextLength: number;
  exportedTextLength: number;
  checkedSnippets: string[];
  missingSnippets: string[];
  warnings: string[];
  systemFillFound: boolean;
};

async function readDocumentXml(docxBytes: Uint8Array | Buffer) {
  const zip = await JSZip.loadAsync(Buffer.from(docxBytes));
  const documentFile = zip.file("word/document.xml");

  if (!documentFile) {
    throw new Error("DOCX is missing word/document.xml.");
  }

  return documentFile.async("string");
}

function extractParagraphTexts(documentXml: string) {
  return Array.from(documentXml.matchAll(/<w:p[\s\S]*?<\/w:p>/g))
    .map((match) => extractParagraphText(match[0]))
    .map((text) => text.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, "");
}

function isReplaceableTemplateInstruction(text: string) {
  return /提交时删除|删除文中.*说明文字|红色说明文字|要求结果以截图形式展示|请在此填写|填写示例|占位|placeholder|\*{3,}|XXXXX|掌握了.*能.*完成.*遇到了.*问题/i.test(
    text,
  );
}

function selectKeySnippets(paragraphs: string[]) {
  const snippets: string[] = [];
  const addSnippet = (text: string) => {
    const snippet = text.replace(/\s+/g, " ").trim();
    if (snippet.length < 4) return;

    // Some templates explicitly mark right-cell hints as throwaway filling
    // instructions. Preserve all real source content, but do not fail export
    // merely because that explicit placeholder text was replaced in the
    // answer cell.
    if (isReplaceableTemplateInstruction(snippet)) return;

    snippets.push(snippet.length > 120 ? snippet.slice(0, 120) : snippet);
  };

  const sampleIndexes = new Set<number>();
  const total = paragraphs.length;

  paragraphs.slice(0, 20).forEach((_, index) => sampleIndexes.add(index));
  paragraphs.slice(Math.max(0, total - 20)).forEach((_, index) =>
    sampleIndexes.add(Math.max(0, total - 20) + index),
  );
  [0.25, 0.5, 0.75].forEach((ratio) => {
    const index = Math.floor(total * ratio);
    for (let offset = -3; offset <= 3; offset += 1) {
      const candidate = index + offset;
      if (candidate >= 0 && candidate < total) sampleIndexes.add(candidate);
    }
  });

  [...sampleIndexes]
    .sort((a, b) => a - b)
    .map((index) => paragraphs[index])
    .forEach(addSnippet);

  paragraphs
    .filter((text) =>
      /课程|班级|姓名|学号|专业|学院|指导教师|成绩|日期|填表说明|项目计划|项目任务书|项目报告|项目评价|课程学习总结|任务|实验|要求|内容|代码|截图|运行结果|题目|问题及思考|实施过程与结果分析/.test(
        text,
      ),
    )
    .slice(0, 40)
    .forEach(addSnippet);

  return [...new Set(snippets)].slice(0, 80);
}

function hasSystemFillMarker(text: string) {
  return (
    text.includes("【代码】") ||
    text.includes("【运行结果】") ||
    text.includes("【运行截图】") ||
    text.includes("【结果分析】") ||
    text.includes("【问题及思考】") ||
    text.includes("【截图缺失】") ||
    text.includes("【系统填写") ||
    text.includes("銆愮郴缁熷～鍐") ||
    text.includes("銆愭埅鍥剧己澶")
  );
}

export async function validateDocxPreservation(input: {
  originalDocx: Uint8Array | Buffer;
  exportedDocx: Uint8Array | Buffer;
  requireSystemFill?: boolean;
}): Promise<DocxPreservationValidationResult> {
  const warnings: string[] = [];

  try {
    const [originalXml, exportedXml] = await Promise.all([
      readDocumentXml(input.originalDocx),
      readDocumentXml(input.exportedDocx),
    ]);
    const originalParagraphs = extractParagraphTexts(originalXml);
    const exportedParagraphs = extractParagraphTexts(exportedXml);
    const originalText = originalParagraphs.join("\n");
    const exportedText = exportedParagraphs.join("\n");
    const normalizedExportedText = normalizeText(exportedText);
    const checkedSnippets = selectKeySnippets(originalParagraphs);
    const missingSnippets = checkedSnippets.filter(
      (snippet) => !normalizedExportedText.includes(normalizeText(snippet)),
    );
    const originalTextLength = normalizeText(originalText).length;
    const exportedTextLength = normalizeText(exportedText).length;
    const systemFillFound = hasSystemFillMarker(exportedText);

    if (originalTextLength > 0 && exportedTextLength < originalTextLength * 0.8) {
      warnings.push("导出后文本长度显著少于原文，可能存在原内容丢失。");
    }
    if (missingSnippets.length > 0) {
      warnings.push("导出后缺少原文档关键片段，已阻止可能破坏原格式的导出。");
    }
    if (input.requireSystemFill !== false && !systemFillFound) {
      warnings.push("导出后未检测到【代码】、【运行结果】、【运行截图】、【结果分析】、【问题及思考】或【截图缺失】等填写标记。");
    }

    return {
      passed:
        missingSnippets.length === 0 &&
        (originalTextLength === 0 || exportedTextLength >= originalTextLength * 0.8) &&
        (input.requireSystemFill === false || systemFillFound),
      originalTextLength,
      exportedTextLength,
      checkedSnippets,
      missingSnippets,
      warnings,
      systemFillFound,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown DOCX validation error.";
    return {
      passed: false,
      originalTextLength: 0,
      exportedTextLength: 0,
      checkedSnippets: [],
      missingSnippets: [],
      warnings: [`DOCX 原文完整性校验失败：${message}`],
      systemFillFound: false,
    };
  }
}
