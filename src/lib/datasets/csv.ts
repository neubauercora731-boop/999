export type CsvDatasetPreview = {
  fileName: string;
  delimiter: "," | ";" | "\t" | "|";
  columns: string[];
  rowCount: number | null;
  previewRows: string[][];
  rawTextPreview: string;
  truncated: boolean;
};

const DELIMITERS: CsvDatasetPreview["delimiter"][] = [",", ";", "\t", "|"];

function countDelimiter(line: string, delimiter: string) {
  let count = 0;
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      count += 1;
    }
  }

  return count;
}

export function detectCsvDelimiter(text: string): CsvDatasetPreview["delimiter"] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 10);

  let best: CsvDatasetPreview["delimiter"] = ",";
  let bestScore = -1;

  for (const delimiter of DELIMITERS) {
    const score = lines.reduce((sum, line) => sum + countDelimiter(line, delimiter), 0);
    if (score > bestScore) {
      best = delimiter;
      bestScore = score;
    }
  }

  return best;
}

export function parseCsvLine(line: string, delimiter: string) {
  const values: string[] = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        value += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      values.push(value.trim());
      value = "";
      continue;
    }

    value += char;
  }

  values.push(value.trim());
  return values;
}

export function buildCsvDatasetPreview(
  fileName: string,
  text: string,
  maxRows = 50,
): CsvDatasetPreview | null {
  const lines = text
    .replace(/\u0000/g, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return null;

  const delimiter = detectCsvDelimiter(lines.slice(0, maxRows).join("\n"));
  const parsedRows = lines.slice(0, maxRows + 1).map((line) => parseCsvLine(line, delimiter));
  const columns = parsedRows[0] ?? [];
  const previewRows = parsedRows.slice(1, 11);

  return {
    fileName,
    delimiter,
    columns,
    rowCount: Math.max(0, lines.length - 1),
    previewRows,
    rawTextPreview: lines.slice(0, 12).join("\n").slice(0, 2000),
    truncated: lines.length > maxRows,
  };
}

export function isCsvFile(fileName: string, mimeType?: string | null) {
  return (
    fileName.toLowerCase().endsWith(".csv") ||
    mimeType === "text/csv" ||
    mimeType === "application/csv"
  );
}
