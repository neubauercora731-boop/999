import { spawn } from "node:child_process";
import { access, mkdir, readdir } from "node:fs/promises";
import path from "node:path";

export type LibreOfficeAvailability = {
  available: boolean;
  command?: string;
  reason?: string;
};

export type DocToDocxConversionResult = {
  convertedDocxPath: string;
  warnings: string[];
};

const WINDOWS_CANDIDATES = [
  "soffice.com",
  "soffice.exe",
  "soffice",
  "libreoffice.exe",
  "libreoffice",
  "C:\\Program Files\\LibreOffice\\program\\soffice.com",
  "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
  "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.com",
  "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
];

const POSIX_CANDIDATES = ["soffice", "libreoffice"];

function candidateCommands() {
  if (process.platform !== "win32") return POSIX_CANDIDATES;

  const userProfile = process.env.USERPROFILE;
  const portableCandidates = userProfile
    ? [
        path.join(
          userProfile,
          "Apps",
          "LibreOfficePortableExtracted",
          "App",
          "libreoffice",
          "program",
          "soffice.com",
        ),
      ]
    : [];

  return [...portableCandidates, ...WINDOWS_CANDIDATES];
}

function runCommand(
  command: string,
  args: string[],
  options: { cwd?: string; timeoutMs?: number } = {},
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      windowsHide: true,
      shell: false,
    });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("LibreOffice conversion timed out."));
    }, options.timeoutMs ?? 60_000);

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (exitCode) => {
      clearTimeout(timeout);
      resolve({ stdout, stderr, exitCode });
    });
  });
}

async function executableExists(command: string) {
  if (!path.isAbsolute(command)) {
    try {
      if (process.platform === "win32") {
        const result = await runCommand("where.exe", [command], { timeoutMs: 3_000 });
        return result.exitCode === 0 && Boolean((result.stdout || result.stderr).trim());
      }

      const escaped = command.replace(/'/g, "'\\''");
      const result = await runCommand("sh", ["-lc", `command -v '${escaped}'`], { timeoutMs: 3_000 });
      return result.exitCode === 0 && Boolean((result.stdout || result.stderr).trim());
    } catch {
      return false;
    }
  }

  try {
    await access(command);
    return true;
  } catch {
    return false;
  }
}

export async function detectLibreOfficeAvailable(): Promise<LibreOfficeAvailability> {
  const errors: string[] = [];

  for (const command of candidateCommands()) {
    if (!(await executableExists(command))) {
      errors.push(`${command}: not found`);
      continue;
    }

    try {
      const result = await runCommand(command, ["--version"], { timeoutMs: 10_000 });
      if (result.exitCode === 0 || /LibreOffice|OpenOffice|soffice/i.test(result.stdout + result.stderr)) {
        return { available: true, command };
      }
      errors.push(`${command}: ${result.stderr || result.stdout || `exit ${result.exitCode}`}`);
    } catch (error) {
      errors.push(`${command}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    available: false,
    reason: errors.join("; ") || "LibreOffice/soffice was not found.",
  };
}

export async function convertDocToDocx(
  inputPath: string,
  outputDir: string,
): Promise<DocToDocxConversionResult> {
  const availability = await detectLibreOfficeAvailable();
  if (!availability.available || !availability.command) {
    throw new Error(
      "当前上传的是 .doc 老版 Word 格式，无法安全保留原格式填充。请将任务书另存为标准 .docx 后重新上传，或安装 LibreOffice 转换支持。",
    );
  }

  await mkdir(outputDir, { recursive: true });
  const before = new Set(await readdir(outputDir).catch(() => []));
  const result = await runCommand(
    availability.command,
    ["--headless", "--convert-to", "docx", "--outdir", outputDir, inputPath],
    { timeoutMs: 60_000 },
  );

  if (result.exitCode !== 0) {
    throw new Error(
      `DOC 转 DOCX 失败：${result.stderr || result.stdout || `LibreOffice exited with ${result.exitCode}`}`,
    );
  }

  const after = await readdir(outputDir);
  const converted = after.find((fileName) => {
    if (!fileName.toLowerCase().endsWith(".docx")) return false;
    return !before.has(fileName) || path.parse(fileName).name === path.parse(inputPath).name;
  });

  if (!converted) {
    throw new Error("DOC 转换完成但未找到生成的 DOCX 文件。");
  }

  return {
    convertedDocxPath: path.join(outputDir, converted),
    warnings: ["原文件为 .doc，已转换为 .docx 后进行原格式填充，请人工复核格式。"],
  };
}
