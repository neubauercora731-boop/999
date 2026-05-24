export type TaskBlockCandidate = {
  index: number;
  start: number;
  end: number;
  xml: string;
  text: string;
  score: number;
  keywordMatches: string[];
  reason: string;
  inProtectedSection: boolean;
};

export type TaskBlockDetectionResult = {
  candidates: TaskBlockCandidate[];
  selected: TaskBlockCandidate | null;
  warnings: string[];
};

export type TableCellTarget = {
  tableIndex: number;
  rowIndex: number;
  cellIndex: number;
  start: number;
  end: number;
  xml: string;
  labelText: string;
  targetText: string;
  reason: string;
};

export type ParagraphTarget = {
  index: number;
  start: number;
  end: number;
  xml: string;
  text: string;
  reason: string;
};

export type SectionedLabReportTargets = {
  code: ParagraphTarget | null;
  screenshot: ParagraphTarget | null;
  problemThinking: ParagraphTarget | null;
  problemPlaceholder: ParagraphTarget | null;
  warnings: string[];
};

const TASK_BLOCK_KEYWORDS = [
  "任务",
  "实验任务",
  "实验内容",
  "实验要求",
  "任务要求",
  "题目",
  "编程题",
  "代码",
  "程序",
  "运行结果",
  "运行截图",
  "截图",
  "请完成",
  "请编写",
  "请实现",
  "步骤",
  "完成以下",
] as const;

const PROTECTED_SECTION_KEYWORDS = [
  "姓名",
  "学号",
  "班级",
  "课程",
  "学院",
  "专业",
  "教师",
  "指导教师",
  "日期",
  "成绩",
  "评分",
  "评阅",
  "目录",
] as const;

export function xmlDecode(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export function extractParagraphText(paragraphXml: string) {
  return Array.from(paragraphXml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g))
    .map((match) => xmlDecode(match[1] ?? ""))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

export function listParagraphTargets(documentXml: string): ParagraphTarget[] {
  return Array.from(documentXml.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g))
    .map((match, index) => {
      const start = match.index ?? -1;
      return {
        index,
        start,
        end: start + match[0].length,
        xml: match[0],
        text: extractParagraphText(match[0]),
        reason: "document paragraph",
      };
    })
    .filter((paragraph) => paragraph.start >= 0);
}

function findKeywordMatches(text: string) {
  const matches: string[] = TASK_BLOCK_KEYWORDS.filter((keyword) =>
    text.includes(keyword),
  );

  if (/第[一二三四五六七八九十\d]+[题章节]/.test(text)) {
    matches.push("题号");
  }

  if (/^\s*\d+[.、]/.test(text)) {
    matches.push("numbered-item");
  }

  if (/^[一二三四五六七八九十]+[、.]/.test(text)) {
    matches.push("chinese-numbered-item");
  }

  return [...new Set(matches)];
}

function isProtectedSection(text: string, index: number) {
  if (/^目录$|^contents$/i.test(text)) return true;

  const hasProtectedKeyword = PROTECTED_SECTION_KEYWORDS.some((keyword) =>
    text.includes(keyword),
  );
  const hasTaskKeyword = TASK_BLOCK_KEYWORDS.some((keyword) => text.includes(keyword));

  if (hasProtectedKeyword && !hasTaskKeyword) return true;
  if (index <= 8 && /实验报告|报告|封面|课程设计|实训报告/.test(text) && !hasTaskKeyword) {
    return true;
  }

  return false;
}

function scoreCandidate(text: string, index: number, keywordMatches: string[]) {
  if (!text || keywordMatches.length === 0) return -1;
  if (text.length > 500) return -1;

  let score = keywordMatches.length * 3;

  if (/实验内容|实验要求|任务要求|实验任务|完成以下/.test(text)) score += 8;
  if (/请完成|请编写|请实现|编程题|代码|程序|算法|实现/.test(text)) score += 6;
  if (/截图|运行结果|运行截图/.test(text)) score += 3;
  if (/第[一二三四五六七八九十\d]+[题章节]|^\s*\d+[.、]|^[一二三四五六七八九十]+[、.]/.test(text)) {
    score += 4;
  }
  if (/[:：]\s*$/.test(text)) score += 2;
  if (index < 6) score -= 4;
  if (text.length < 4) score -= 2;

  return score;
}

export function detectTaskBlockInsertionPoint(
  documentXml: string,
): TaskBlockDetectionResult {
  const warnings: string[] = [];
  const paragraphMatches = Array.from(
    documentXml.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g),
  );
  const candidates: TaskBlockCandidate[] = [];

  for (const [index, match] of paragraphMatches.entries()) {
    const xml = match[0];
    const start = match.index ?? -1;
    if (start < 0) continue;

    const text = extractParagraphText(xml);
    const keywordMatches = findKeywordMatches(text);
    const inProtectedSection = isProtectedSection(text, index);
    const score = inProtectedSection
      ? -1
      : scoreCandidate(text, index, keywordMatches);

    if (score < 5) continue;

    candidates.push({
      index,
      start,
      end: start + xml.length,
      xml,
      text,
      score,
      keywordMatches,
      reason: `匹配 ${keywordMatches.join(", ")}，得分 ${score}`,
      inProtectedSection,
    });
  }

  const selected = [...candidates].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.index - a.index;
  })[0] ?? null;

  if (!selected) {
    warnings.push("无法安全定位任务填写位置，请用户确认插入位置。");
  }

  return {
    candidates,
    selected,
    warnings,
  };
}

function extractCellText(cellXml: string) {
  return Array.from(cellXml.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g))
    .map((match) => extractParagraphText(match[0]))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function tableRows(tableXml: string) {
  return Array.from(tableXml.matchAll(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g)).map((match) => ({
    xml: match[0],
    start: match.index ?? -1,
    end: (match.index ?? -1) + match[0].length,
  }));
}

function rowCells(rowXml: string) {
  return Array.from(rowXml.matchAll(/<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g)).map((match) => ({
    xml: match[0],
    start: match.index ?? -1,
    end: (match.index ?? -1) + match[0].length,
    text: extractCellText(match[0]),
  }));
}

function findRightCellByLabel(documentXml: string, labelPattern: RegExp) {
  const tables = Array.from(documentXml.matchAll(/<w:tbl(?:\s[^>]*)?>[\s\S]*?<\/w:tbl>/g));

  for (const [tableIndex, tableMatch] of tables.entries()) {
    const tableXml = tableMatch[0];
    const tableStart = tableMatch.index ?? -1;
    if (tableStart < 0) continue;

    for (const [rowIndex, row] of tableRows(tableXml).entries()) {
      const cells = rowCells(row.xml);
      const labelCellIndex = cells.findIndex((cell) => labelPattern.test(cell.text));
      if (labelCellIndex < 0) continue;

      const targetCell = cells[labelCellIndex + 1] ?? cells[labelCellIndex];
      if (!targetCell || targetCell.start < 0) continue;

      const labelCell = cells[labelCellIndex];
      return {
        tableIndex,
        rowIndex,
        cellIndex: labelCellIndex + 1 < cells.length ? labelCellIndex + 1 : labelCellIndex,
        start: tableStart + row.start + targetCell.start,
        end: tableStart + row.start + targetCell.end,
        xml: targetCell.xml,
        labelText: labelCell.text,
        targetText: targetCell.text,
        reason:
          labelCellIndex + 1 < cells.length
            ? `定位到“${labelCell.text}”所在行的右侧单元格`
            : `定位到“${labelCell.text}”所在单元格`,
      } satisfies TableCellTarget;
    }
  }

  return null;
}

export function detectImplementationResultCell(documentXml: string) {
  return findRightCellByLabel(documentXml, /实施过程与结果分析/);
}

export function detectProblemThinkingCell(documentXml: string) {
  return findRightCellByLabel(documentXml, /问题及思考|问题与思考|问题\s*及\s*思考/);
}

function findParagraphByPattern(
  documentXml: string,
  pattern: RegExp,
  reason: string,
  options: {
    minIndex?: number;
    afterIndex?: number;
    beforeIndex?: number;
    preferLast?: boolean;
    allowProtected?: boolean;
  } = {},
) {
  const matches = listParagraphTargets(documentXml).filter((paragraph) => {
    if (!paragraph.text || !pattern.test(paragraph.text)) return false;
    if (options.minIndex !== undefined && paragraph.index < options.minIndex) return false;
    if (options.afterIndex !== undefined && paragraph.index <= options.afterIndex) return false;
    if (options.beforeIndex !== undefined && paragraph.index >= options.beforeIndex) return false;
    if (!options.allowProtected && isProtectedSection(paragraph.text, paragraph.index)) {
      return false;
    }
    return true;
  });

  const selected = options.preferLast ? matches.at(-1) : matches[0];
  return selected ? { ...selected, reason } : null;
}

export function detectCodeSectionParagraph(documentXml: string) {
  return findParagraphByPattern(
    documentXml,
    /实验代码|程序代码|源代码|代码[:：]?\s*$/,
    "定位到段落式模板的实验代码标记",
    { minIndex: 6, preferLast: false },
  );
}

export function detectScreenshotSectionParagraph(documentXml: string) {
  return findParagraphByPattern(
    documentXml,
    /实验结果与分析|运行结果截图|附上运行结果截图|运行截图|结果截图|截图/,
    "定位到段落式模板的实验结果与运行截图标记",
    { minIndex: 6, preferLast: true },
  );
}

export function detectProblemThinkingParagraph(documentXml: string) {
  return findParagraphByPattern(
    documentXml,
    /问题及思考|问题与思考|问题\s*及\s*思考/,
    "定位到段落式模板的问题及思考标记",
    { minIndex: 6, preferLast: true },
  );
}

export function detectProblemThinkingPlaceholderParagraph(
  documentXml: string,
  afterProblemThinkingIndex: number,
) {
  return findParagraphByPattern(
    documentXml,
    /XXXXX|\*{3,}|掌握了.*能.*完成.*遇到了.*问题|遇到了\s*X+\s*问题/i,
    "定位到问题及思考的可替换占位文本",
    {
      afterIndex: afterProblemThinkingIndex,
      beforeIndex: afterProblemThinkingIndex + 8,
      allowProtected: true,
    },
  );
}

export function detectSectionedLabReportTargets(
  documentXml: string,
): SectionedLabReportTargets {
  const warnings: string[] = [];
  const code = detectCodeSectionParagraph(documentXml);
  const screenshot = detectScreenshotSectionParagraph(documentXml);
  const problemThinking = detectProblemThinkingParagraph(documentXml);
  const problemPlaceholder = problemThinking
    ? detectProblemThinkingPlaceholderParagraph(documentXml, problemThinking.index)
    : null;

  if (!code) warnings.push("未找到段落式模板的实验代码填写标记。");
  if (!screenshot) warnings.push("未找到段落式模板的运行截图/结果分析填写标记。");
  if (!problemThinking) warnings.push("未找到段落式模板的问题及思考填写标记。");

  return {
    code,
    screenshot,
    problemThinking,
    problemPlaceholder,
    warnings,
  };
}
