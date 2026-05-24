import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";

import JSZip from "jszip";

import { evaluateTaskOutput } from "@/lib/agent/quality-evaluation";
import { makeContentDisposition } from "@/lib/http/download-headers";
import { generateBrowserPageScreenshots } from "@/lib/screenshots/browser-page-screenshot";
import { generateCommandOutputScreenshot } from "@/lib/screenshots/command-output-screenshot";
import type { BrowserScreenshotAction } from "@/lib/screenshots/types";
import { loadStandardSamples, type LoadedAgentSample } from "./sample-loader";
import { STANDARD_SAMPLE_REQUIRED_FILES } from "./sample-schema";
import type { AgentSampleMetadata } from "./sample-schema";

type CheckResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  checkedSamples: number;
};

type SampleRunResult = {
  sampleId: string;
  status: "passed" | "failed" | "skipped" | "partial";
  runner?: "browser" | "python" | "docx";
  artifacts?: string[];
  warnings: string[];
  error?: string;
  durationMs?: number;
  quality?: {
    score: number;
    passed: boolean;
    blockingIssues: string[];
    warnings: string[];
  };
};

type LocalRunResult = {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  runtimeMs: number;
  timedOut: boolean;
  command: string;
};

async function exists(filePath: string) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function validateMetadata(metadata: AgentSampleMetadata | null, sampleId: string) {
  const errors: string[] = [];

  if (!metadata) {
    return [`${sampleId}: sample.json is missing or invalid.`];
  }

  if (metadata.sample_id !== sampleId) {
    errors.push(`${sampleId}: sample_id does not match directory name.`);
  }

  if (
    metadata.screenshot_policy.required &&
    metadata.screenshot_policy.allowed_kinds.length === 0
  ) {
    errors.push(`${sampleId}: screenshot required but allowed_kinds is empty.`);
  }

  if (
    metadata.task_type.startsWith("frontend_") &&
    !metadata.required_runners.includes("browser")
  ) {
    errors.push(`${sampleId}: frontend samples must require the browser runner.`);
  }

  if (
    metadata.task_type.startsWith("python_") &&
    !metadata.required_runners.includes("python")
  ) {
    errors.push(`${sampleId}: Python samples must require the python runner.`);
  }

  if (
    metadata.task_type === "no_screenshot_required" &&
    metadata.screenshot_policy.required
  ) {
    errors.push(`${sampleId}: no_screenshot_required sample cannot require screenshots.`);
  }

  return errors;
}

export async function checkSamples(cwd = process.cwd()): Promise<CheckResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const root = path.join(cwd, "docs", "agent-samples");

  for (const requiredFile of ["README.md", "sample-schema.json"]) {
    const requiredPath = path.join(root, requiredFile);
    if (!(await exists(requiredPath))) {
      errors.push(`docs/agent-samples/${requiredFile} is missing.`);
    }
  }

  const samples = await loadStandardSamples(cwd);
  if (samples.length === 0) {
    errors.push("No standard samples were found. Expected directories 002-* and later.");
  }

  for (const sample of samples) {
    for (const requiredFile of STANDARD_SAMPLE_REQUIRED_FILES) {
      if (!sample.files.has(requiredFile)) {
        errors.push(`${sample.id}: missing ${requiredFile}.`);
      }
    }

    if (!sample.files.has("expected-code/README.md")) {
      errors.push(`${sample.id}: expected-code/README.md is missing.`);
    }

    if (![...sample.files].some((file) => file.startsWith("input-files/"))) {
      errors.push(`${sample.id}: input-files/ is empty or missing.`);
    }

    errors.push(...validateMetadata(sample.metadata, sample.id));
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    checkedSamples: samples.length,
  };
}

function getCliOptions() {
  const mode =
    process.argv
      .find((arg) => arg.startsWith("--mode="))
      ?.replace("--mode=", "") || "local-fixture";
  const requestedSampleIds = process.argv.filter((arg) => {
    if (arg.startsWith("-")) return false;
    if (arg.endsWith("sample-regression.ts")) return false;
    if (arg.includes("node_modules")) return false;
    if (arg.includes("tsx")) return false;
    return /^\d{3}($|-)/.test(arg);
  });

  return {
    mode,
    runAll: process.argv.includes("--all"),
    requestedSampleIds,
  };
}

function isBrowserReplaySample(metadata: AgentSampleMetadata | null) {
  return (
    metadata?.required_runners.includes("browser") &&
    metadata.required_evidence.includes("browser_page_screenshot")
  );
}

function isCommandReplaySample(metadata: AgentSampleMetadata | null) {
  return (
    metadata?.required_runners.includes("python") &&
    [
      "002-real-run-screenshot-workflow",
      "006-python-data-analysis-lab",
      "004-python-file-io-lab",
      "005-python-oop-lab",
      "010-no-screenshot-required",
      "011-csv-dataset-doc-export-workflow",
      "012-run-code-screenshot-trace-export-consistency",
    ].includes(metadata.sample_id)
  );
}

function assertAsciiOnly(value: string) {
  for (const char of value) {
    if (char.charCodeAt(0) > 127) {
      throw new Error(`Header contains non-ASCII char: ${char}`);
    }
  }
}

async function inspectDocxPackage(docxPath: string) {
  const zip = await JSZip.loadAsync(await readFile(docxPath));
  const xmlParts: string[] = [];
  const mediaFiles: string[] = [];
  const documentXml = await zip.file("word/document.xml")?.async("string");

  const entries = Object.entries(zip.files);
  for (const [name, file] of entries) {
    if (file.dir) continue;
    if (name.startsWith("word/media/")) {
      mediaFiles.push(name);
    }
    if (name.startsWith("word/") && name.endsWith(".xml")) {
      xmlParts.push(await file.async("string"));
    }
  }

  const xml = xmlParts.join("\n");
  return {
    xml,
    documentXml: documentXml ?? "",
    mediaFiles,
  };
}

function decodeDocxText(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function extractDocxParagraphTexts(documentXml: string) {
  return Array.from(
    documentXml.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g),
  ).map((paragraph) =>
    Array.from(
      paragraph[0].matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g),
    )
      .map((textMatch) => decodeDocxText(textMatch[1] ?? ""))
      .join(""),
  );
}

function getInsertedCodeParagraphs(documentXml: string) {
  const paragraphs = extractDocxParagraphTexts(documentXml);
  const labels = ["【运行结果】", "【运行截图】", "【结果分析】", "【问题及思考】", "【截图缺失】"];
  const codeStart = paragraphs.findIndex(
    (paragraph) => paragraph.trim() === "【代码】" || paragraph.includes("【代码】"),
  );
  if (codeStart < 0) return [];

  const nextLabel = paragraphs.findIndex(
    (paragraph, index) =>
      index > codeStart &&
      labels.some((label) => paragraph.trim().startsWith(label) || paragraph.includes(label)),
  );

  return paragraphs
    .slice(codeStart + 1, nextLabel > codeStart ? nextLabel : codeStart + 160)
    .filter((paragraph) => paragraph.trim().length > 0);
}

async function readInputFiles(sampleDirectory: string) {
  const inputRoot = path.join(sampleDirectory, "input-files");
  const files: Array<{ path: string; content: string }> = [];

  async function walk(current: string, prefix = "") {
    const { readdir } = await import("node:fs/promises");
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath, relative);
      } else if (entry.name !== ".gitkeep") {
        files.push({
          path: relative.replaceAll("\\", "/"),
          content: await readFile(fullPath, "utf8"),
        });
      }
    }
  }

  await walk(inputRoot);
  return files;
}

function sampleRunRoot(sample: LoadedAgentSample) {
  return path.join(process.cwd(), ".tmp", "sample-runs", sample.id);
}

function relativeArtifact(filePath: string) {
  return path.relative(process.cwd(), filePath).replaceAll("\\", "/");
}

async function writeJson(filePath: string, value: unknown) {
  await writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

function safeEnv() {
  const env: Record<string, string> = {};
  for (const key of ["PATH", "PATHEXT", "SystemRoot", "WINDIR", "TEMP", "TMP"]) {
    const value = process.env[key];
    if (value) env[key] = value;
  }
  env.PYTHONIOENCODING = "utf-8";
  env.PYTHONUTF8 = "1";
  env.PYTHONNOUSERSITE = "1";
  return env as unknown as NodeJS.ProcessEnv;
}

async function runPythonFixture(
  code: string,
  extraFiles: Array<{ path: string; content: string }> = [],
): Promise<LocalRunResult> {
  const startedAt = Date.now();
  const dir = await mkdtemp(path.join(tmpdir(), "lab-sample-python-"));
  const file = path.join(dir, "main.py");
  await writeFile(file, code, "utf8");
  for (const extraFile of extraFiles) {
    if (extraFile.path === "main.py" || extraFile.path.includes("..")) continue;
    const target = path.join(dir, ...extraFile.path.split("/"));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, extraFile.content, "utf8");
  }

  async function attempt(command: string): Promise<LocalRunResult & { commandNotFound?: boolean }> {
    return new Promise((resolve) => {
      let stdout = "";
      let stderr = "";
      let timedOut = false;
      let settled = false;
      const child = spawn(command, [file], {
        cwd: dir,
        env: safeEnv(),
        windowsHide: true,
      });
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGKILL");
      }, 8000);

      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString("utf8");
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString("utf8");
      });
      child.on("error", (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const nodeError = error as NodeJS.ErrnoException;
        resolve({
          success: false,
          stdout,
          stderr: nodeError.message,
          exitCode: null,
          runtimeMs: Date.now() - startedAt,
          timedOut: false,
          command,
          commandNotFound: nodeError.code === "ENOENT",
        });
      });
      child.on("close", (exitCode) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({
          success: exitCode === 0 && !timedOut,
          stdout,
          stderr,
          exitCode,
          runtimeMs: Date.now() - startedAt,
          timedOut,
          command,
        });
      });
    });
  }

  try {
    for (const command of ["python", "python3"]) {
      const result = await attempt(command);
      if (!result.commandNotFound) return result;
    }

    return {
      success: false,
      stdout: "",
      stderr: "Python command was not found.",
      exitCode: null,
      runtimeMs: Date.now() - startedAt,
      timedOut: false,
      command: "python",
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function runCommandScreenshotSample(sample: LoadedAgentSample): Promise<SampleRunResult> {
  const startedAt = Date.now();
  const warnings: string[] = [];
  const outputRoot = sampleRunRoot(sample);
  const artifactsDir = path.join(outputRoot, "artifacts");
  const createdAt = new Date().toISOString();
  const runId = `sample-${createdAt.replace(/[:.]/g, "-")}`;
  const codePath = path.join(sample.directory, "input-files", "main.py");

  try {
    const inputFiles = await readInputFiles(sample.directory);
    const code = await readFile(codePath, "utf8");
    const runResult = await runPythonFixture(
      code,
      inputFiles.filter((file) => file.path !== "main.py"),
    );
    const screenshotRequired = sample.metadata?.screenshot_policy.required ?? true;
    const shouldGenerateScreenshot =
      screenshotRequired &&
      Boolean(sample.metadata?.required_evidence.includes("command_output_screenshot"));
    const actualScreenshotsPath = path.join(outputRoot, "actual-screenshots.json");
    const actualRunPath = path.join(outputRoot, "actual-run-result.json");
    const tracePath = path.join(outputRoot, "trace.json");
    const screenshotMetadata: unknown[] = [];
    const screenshotArtifacts: string[] = [];
    const screenshotWarnings: string[] = [];

    await mkdir(artifactsDir, { recursive: true });

    if (shouldGenerateScreenshot) {
      const image = await generateCommandOutputScreenshot({
        taskId: sample.id,
        runId,
        command: `${runResult.command} main.py`,
        filename: "main.py",
        code,
        stdout: runResult.stdout,
        stderr: runResult.stderr,
        exitCode: runResult.exitCode,
        durationMs: runResult.runtimeMs,
        timedOut: runResult.timedOut,
        createdAt,
      });
      const screenshotPath = path.join(artifactsDir, "command-output-screenshot.png");
      await writeFile(screenshotPath, image.buffer);

      const screenshotArtifact = relativeArtifact(screenshotPath);
      screenshotArtifacts.push(screenshotArtifact);
      screenshotWarnings.push(...image.warnings);
      screenshotMetadata.push({
        id: runId,
        type: "command_output_screenshot",
        source: "real_run_code_result",
        path: screenshotArtifact,
        storagePath: screenshotArtifact,
        fileName: "command-output-screenshot.png",
        contentType: "image/png",
        requiredByTask: true,
        isRealScreenshot: true,
        isAiGenerated: false,
        missing: false,
        width: image.width,
        height: image.height,
        exitCode: runResult.exitCode,
        runtimeMs: runResult.runtimeMs,
        warnings: image.warnings,
        createdAt,
      });
    }

    const quality = evaluateTaskOutput({
      workflowType: sample.metadata?.task_type,
      taskText: await readFile(path.join(sample.directory, "sample-task.md"), "utf8"),
      generatedCode: code,
      runResult,
      screenshots: screenshotMetadata,
      reportText: shouldGenerateScreenshot
        ? `Real run stdout:\n${runResult.stdout}\nScreenshot: ${screenshotArtifacts.join(", ")}`
        : `Real run stdout:\n${runResult.stdout}\nNo screenshot is required for this sample.`,
      exportMode:
        sample.metadata?.docx_mode === "generated_report_docx"
          ? "generated_report_docx"
          : "patch_original_docx",
      screenshotRequired,
    });
    const result: SampleRunResult = {
      sampleId: sample.id,
      status: runResult.success && quality.passed ? "passed" : "failed",
      runner: "python",
      artifacts: [
        ...screenshotArtifacts,
        relativeArtifact(actualScreenshotsPath),
        relativeArtifact(actualRunPath),
        relativeArtifact(tracePath),
      ],
      warnings: [...warnings, ...screenshotWarnings, ...quality.warnings],
      error: runResult.success
        ? quality.blockingIssues.join("; ") || undefined
        : runResult.stderr || "Python fixture failed.",
      durationMs: Date.now() - startedAt,
      quality,
    };

    await writeJson(actualScreenshotsPath, screenshotMetadata);
    await writeJson(actualRunPath, { ...runResult, quality });
    const trace: Array<Record<string, unknown>> = [
      {
        step: "run-code",
        status: runResult.success ? "success" : "failed",
        outputSummary: `exitCode=${runResult.exitCode}; runtime=${runResult.runtimeMs}ms`,
        artifacts: screenshotMetadata,
      },
      {
        step: "evaluate",
        status: quality.passed ? "success" : "failed",
        outputSummary: `score=${quality.score}`,
      },
    ];
    if (screenshotRequired) {
      trace.splice(1, 0, {
        step: "generate-screenshot",
        status: screenshotMetadata.length > 0 ? "success" : "failed",
        artifacts: screenshotMetadata,
      });
    } else {
      trace.splice(1, 0, {
        step: "generate-screenshot",
        status: "skipped",
        outputSummary: "Screenshot not required.",
      });
    }
    await writeJson(tracePath, trace);
    return result;
  } catch (error) {
    const actualRunPath = path.join(outputRoot, "actual-run-result.json");
    const result: SampleRunResult = {
      sampleId: sample.id,
      status: "failed",
      runner: "python",
      warnings,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startedAt,
    };
    await mkdir(outputRoot, { recursive: true });
    await writeJson(actualRunPath, result);
    return result;
  }
}

async function runFailedRecoverySample(sample: LoadedAgentSample): Promise<SampleRunResult> {
  const startedAt = Date.now();
  const outputRoot = sampleRunRoot(sample);
  const artifactsDir = path.join(outputRoot, "artifacts");
  const createdAt = new Date().toISOString();
  const runId = `sample-${createdAt.replace(/[:.]/g, "-")}`;
  const initialCodePath = path.join(sample.directory, "input-files", "main.py");
  const fixedCodePath = path.join(sample.directory, "input-files", "fixed_main.py");
  const actualScreenshotsPath = path.join(outputRoot, "actual-screenshots.json");
  const actualRunPath = path.join(outputRoot, "actual-run-result.json");
  const tracePath = path.join(outputRoot, "trace.json");

  try {
    const initialCode = await readFile(initialCodePath, "utf8");
    const fixedCode = await readFile(fixedCodePath, "utf8");
    const firstRun = await runPythonFixture(initialCode);
    const secondRun = await runPythonFixture(fixedCode);

    await mkdir(artifactsDir, { recursive: true });

    const image = await generateCommandOutputScreenshot({
      taskId: sample.id,
      runId,
      command: `${secondRun.command} main.py`,
      filename: "fixed_main.py",
      code: fixedCode,
      stdout: secondRun.stdout,
      stderr: secondRun.stderr,
      exitCode: secondRun.exitCode,
      durationMs: secondRun.runtimeMs,
      timedOut: secondRun.timedOut,
      createdAt,
    });
    const screenshotPath = path.join(artifactsDir, "debug-once-command-output-screenshot.png");
    await writeFile(screenshotPath, image.buffer);
    const screenshotArtifact = relativeArtifact(screenshotPath);
    const metadata = {
      id: runId,
      type: "command_output_screenshot",
      source: "real_run_code_result",
      path: screenshotArtifact,
      storagePath: screenshotArtifact,
      fileName: "debug-once-command-output-screenshot.png",
      contentType: "image/png",
      requiredByTask: true,
      isRealScreenshot: true,
      isAiGenerated: false,
      missing: false,
      width: image.width,
      height: image.height,
      exitCode: secondRun.exitCode,
      runtimeMs: secondRun.runtimeMs,
      warnings: image.warnings,
      createdAt,
    };
    const quality = evaluateTaskOutput({
      workflowType: sample.metadata?.task_type,
      taskText: await readFile(path.join(sample.directory, "sample-task.md"), "utf8"),
      generatedCode: fixedCode,
      runResult: secondRun,
      screenshots: [metadata],
      reportText: [
        "Initial run failed and was recorded.",
        `Initial stderr:\n${firstRun.stderr}`,
        `Debug-once stdout:\n${secondRun.stdout}`,
        `Screenshot: ${screenshotArtifact}`,
      ].join("\n\n"),
      exportMode: "patch_original_docx",
      screenshotRequired: true,
    });
    const passed = !firstRun.success && secondRun.success && quality.passed;
    const result: SampleRunResult = {
      sampleId: sample.id,
      status: passed ? "passed" : "failed",
      runner: "python",
      artifacts: [
        screenshotArtifact,
        relativeArtifact(actualScreenshotsPath),
        relativeArtifact(actualRunPath),
        relativeArtifact(tracePath),
      ],
      warnings: [...image.warnings, ...quality.warnings],
      error: passed
        ? undefined
        : `firstRun.success=${firstRun.success}; secondRun.success=${secondRun.success}; blocking=${quality.blockingIssues.join("; ")}`,
      durationMs: Date.now() - startedAt,
      quality,
    };

    await writeJson(actualScreenshotsPath, [metadata]);
    await writeJson(actualRunPath, { firstRun, secondRun, quality });
    await writeJson(tracePath, [
      {
        step: "run-code",
        status: firstRun.success ? "success" : "failed",
        outputSummary: `initial exitCode=${firstRun.exitCode}; stderrLength=${firstRun.stderr.length}`,
      },
      {
        step: "debug-once",
        status: secondRun.success ? "success" : "failed",
        outputSummary: `second exitCode=${secondRun.exitCode}; runtime=${secondRun.runtimeMs}ms`,
      },
      {
        step: "generate-screenshot",
        status: "success",
        artifacts: [metadata],
      },
      {
        step: "evaluate",
        status: quality.passed ? "success" : "failed",
        outputSummary: `score=${quality.score}`,
      },
    ]);
    return result;
  } catch (error) {
    const result: SampleRunResult = {
      sampleId: sample.id,
      status: "failed",
      runner: "python",
      warnings: [],
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startedAt,
    };
    await mkdir(outputRoot, { recursive: true });
    await writeJson(actualRunPath, result);
    return result;
  }
}

async function runDocxEdgeCaseSample(sample: LoadedAgentSample): Promise<SampleRunResult> {
  const startedAt = Date.now();
  const outputRoot = sampleRunRoot(sample);
  const tracePath = path.join(outputRoot, "trace.json");
  const actualRunPath = path.join(outputRoot, "actual-run-result.json");
  const result: SampleRunResult = {
    sampleId: sample.id,
    status: "partial",
    runner: "docx",
    artifacts: [relativeArtifact(actualRunPath), relativeArtifact(tracePath)],
    warnings: [
      "DOCX edge-case replay is partial: fixture generation/export is documented, but not executed in local-fixture mode yet.",
    ],
    durationMs: Date.now() - startedAt,
  };

  await mkdir(outputRoot, { recursive: true });
  await writeJson(actualRunPath, result);
  await writeJson(tracePath, [
    {
      step: "export-docx",
      status: "skipped",
      outputSummary:
        "Partial replay only. Requires DOCX fixture generation and template-preserving patch validation before pass.",
    },
  ]);
  return result;
}

async function runDownloadFilenameEncodingSample(sample: LoadedAgentSample): Promise<SampleRunResult> {
  const startedAt = Date.now();
  const outputRoot = sampleRunRoot(sample);
  const actualRunPath = path.join(outputRoot, "actual-run-result.json");
  const tracePath = path.join(outputRoot, "trace.json");
  const warnings: string[] = [];
  const cases = [
    { filename: "当前任务报告.docx", fallback: "lab-report.docx" },
    { filename: "实验报告.docx", fallback: "lab-report.docx" },
    { filename: "数据分析实验报告.docx", fallback: "lab-report.docx" },
    { filename: "report.docx", fallback: "report.docx" },
    { filename: "带 空格 的 文件.docx", fallback: "lab-report.docx" },
    { filename: "包含/路径/分隔符.docx", fallback: "lab-report.docx" },
  ];

  try {
    const results = cases.map((item) => {
      const contentDisposition = makeContentDisposition(item.filename, item.fallback);
      assertAsciiOnly(contentDisposition);
      if (!contentDisposition.includes("attachment")) {
        throw new Error("Content-Disposition must include attachment.");
      }
      if (!contentDisposition.includes(`filename="${item.fallback}"`)) {
        throw new Error(`Missing ASCII fallback filename for ${item.filename}.`);
      }
      if (!contentDisposition.includes("filename*=UTF-8''")) {
        throw new Error(`Missing UTF-8 filename* for ${item.filename}.`);
      }
      if (/[^\x00-\x7F]/.test(contentDisposition)) {
        throw new Error(`Content-Disposition contains raw non-ASCII for ${item.filename}.`);
      }
      return {
        filename: item.filename,
        fallbackFilename: item.fallback,
        contentDisposition,
      };
    });

    await mkdir(outputRoot, { recursive: true });
    await writeJson(actualRunPath, { cases: results });
    await writeJson(tracePath, [
      {
        step: "export-docx",
        status: "success",
        outputSummary: "Content-Disposition uses ASCII fallback and UTF-8 filename*.",
      },
    ]);

    return {
      sampleId: sample.id,
      status: "passed",
      runner: "docx",
      artifacts: [relativeArtifact(actualRunPath), relativeArtifact(tracePath)],
      warnings,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    await mkdir(outputRoot, { recursive: true });
    const message = error instanceof Error ? error.message : String(error);
    const result: SampleRunResult = {
      sampleId: sample.id,
      status: "failed",
      runner: "docx",
      artifacts: [relativeArtifact(actualRunPath)],
      warnings,
      error: message,
      durationMs: Date.now() - startedAt,
    };
    await writeJson(actualRunPath, result);
    return result;
  }
}

async function runSy2SectionedDocPreservationSample(
  sample: LoadedAgentSample,
): Promise<SampleRunResult> {
  const startedAt = Date.now();
  const outputRoot = sampleRunRoot(sample);
  const actualRunPath = path.join(outputRoot, "actual-run-result.json");
  const tracePath = path.join(outputRoot, "trace.json");
  const expectedDocxPath = path.join(
    sample.directory,
    "expected-docx",
    "大数据2404张毅198.docx",
  );

  const requiredSnippets = [
    "数据结构与算法",
    "一、实验要求",
    "实验代码",
    "实验结果与分析",
    "问题及思考",
  ];
  const requiredGeneratedLabels = ["【代码】", "【运行截图】", "【问题及思考】"];
  const errors: string[] = [];

  try {
    const { xml, mediaFiles } = await inspectDocxPackage(expectedDocxPath);

    if (xml.includes("系统填写")) {
      errors.push("Final DOCX must not contain the words 系统填写.");
    }

    for (const snippet of requiredSnippets) {
      if (!xml.includes(snippet)) {
        errors.push(`Final DOCX is missing original snippet: ${snippet}.`);
      }
    }

    for (const label of requiredGeneratedLabels) {
      if (!xml.includes(label)) {
        errors.push(`Final DOCX is missing generated fill label: ${label}.`);
      }
    }

    if (mediaFiles.length === 0) {
      errors.push("Final DOCX should contain at least one media file for the real screenshot.");
    }

    const actual = {
      expectedDocx: relativeArtifact(expectedDocxPath),
      requiredSnippets,
      requiredGeneratedLabels,
      mediaFiles,
      hasSystemFill: xml.includes("系统填写"),
      passed: errors.length === 0,
      errors,
    };

    await mkdir(outputRoot, { recursive: true });
    await writeJson(actualRunPath, actual);
    await writeJson(tracePath, [
      {
        step: "export-docx",
        status: errors.length === 0 ? "success" : "failed",
        outputSummary:
          errors.length === 0
            ? "Accepted sy2 delivery artifact preserves original snippets, includes screenshot media, and omits 系统填写."
            : errors.join("; "),
        artifacts: [
          {
            kind: "docx",
            metadata: {
              path: relativeArtifact(expectedDocxPath),
              mediaCount: mediaFiles.length,
              noSystemFill: !xml.includes("系统填写"),
            },
          },
        ],
      },
    ]);

    return {
      sampleId: sample.id,
      status: errors.length === 0 ? "passed" : "failed",
      runner: "docx",
      artifacts: [
        relativeArtifact(expectedDocxPath),
        relativeArtifact(actualRunPath),
        relativeArtifact(tracePath),
      ],
      warnings: [],
      error: errors.join("; ") || undefined,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    await mkdir(outputRoot, { recursive: true });
    const message = error instanceof Error ? error.message : String(error);
    const result: SampleRunResult = {
      sampleId: sample.id,
      status: "failed",
      runner: "docx",
      artifacts: [relativeArtifact(actualRunPath)],
      warnings: [],
      error: message,
      durationMs: Date.now() - startedAt,
    };
    await writeJson(actualRunPath, result);
    return result;
  }
}

type FinalDocxArtifactCheck = {
  fixtureName: string;
  requiredOriginalSnippets: string[];
  requiredGeneratedLabels: string[];
  forbiddenSnippets: string[];
  requiredCaption?: string;
  requireSingleLatestRunScreenshot?: boolean;
  outputSummary: string;
};

async function runFinalDocxArtifactSample(
  sample: LoadedAgentSample,
  check: FinalDocxArtifactCheck,
): Promise<SampleRunResult> {
  const startedAt = Date.now();
  const outputRoot = sampleRunRoot(sample);
  const actualRunPath = path.join(outputRoot, "actual-run-result.json");
  const tracePath = path.join(outputRoot, "trace.json");
  const expectedDocxPath = path.join(sample.directory, "expected-docx", check.fixtureName);
  const errors: string[] = [];

  try {
    const { xml, mediaFiles } = await inspectDocxPackage(expectedDocxPath);
    const systemRunMedia = mediaFiles.filter((file) =>
      file.includes("system-run-screenshot"),
    );

    if (xml.includes("系统填写")) {
      errors.push("Final DOCX must not contain the words 系统填写.");
    }

    for (const snippet of check.requiredOriginalSnippets) {
      if (!xml.includes(snippet)) {
        errors.push(`Final DOCX is missing original snippet: ${snippet}.`);
      }
    }

    for (const label of check.requiredGeneratedLabels) {
      if (!xml.includes(label)) {
        errors.push(`Final DOCX is missing generated fill label: ${label}.`);
      }
    }

    for (const forbidden of check.forbiddenSnippets) {
      if (xml.includes(forbidden)) {
        errors.push(`Final DOCX contains unrelated or stale wording: ${forbidden}.`);
      }
    }

    if (check.requiredCaption && !xml.includes(check.requiredCaption)) {
      errors.push(`Final DOCX is missing required screenshot caption: ${check.requiredCaption}.`);
    }

    if (systemRunMedia.length === 0) {
      errors.push("Final DOCX should contain a real system-run screenshot media file.");
    }

    if (check.requireSingleLatestRunScreenshot && systemRunMedia.length !== 1) {
      errors.push(
        `Final DOCX should contain exactly one latest run screenshot, found ${systemRunMedia.length}.`,
      );
    }

    const actual = {
      expectedDocx: relativeArtifact(expectedDocxPath),
      requiredOriginalSnippets: check.requiredOriginalSnippets,
      requiredGeneratedLabels: check.requiredGeneratedLabels,
      forbiddenSnippets: check.forbiddenSnippets,
      requiredCaption: check.requiredCaption,
      mediaFiles,
      systemRunMedia,
      hasSystemFill: xml.includes("系统填写"),
      passed: errors.length === 0,
      errors,
    };

    await mkdir(outputRoot, { recursive: true });
    await writeJson(actualRunPath, actual);
    await writeJson(tracePath, [
      {
        step: "run-code",
        status: "success",
        outputSummary:
          "Replay validates the already accepted website DOCX artifact, including real screenshot media.",
        artifacts: systemRunMedia.map((file) => ({
          kind: "command_output_screenshot",
          metadata: {
            fileName: file,
            source: "sample-fixture-docx-media",
          },
        })),
      },
      {
        step: "export-docx",
        status: errors.length === 0 ? "success" : "failed",
        outputSummary: errors.length === 0 ? check.outputSummary : errors.join("; "),
        artifacts: [
          {
            kind: "docx",
            metadata: {
              path: relativeArtifact(expectedDocxPath),
              mediaCount: mediaFiles.length,
              systemRunScreenshotCount: systemRunMedia.length,
              noSystemFill: !xml.includes("系统填写"),
            },
          },
        ],
      },
    ]);

    return {
      sampleId: sample.id,
      status: errors.length === 0 ? "passed" : "failed",
      runner: "docx",
      artifacts: [
        relativeArtifact(expectedDocxPath),
        relativeArtifact(actualRunPath),
        relativeArtifact(tracePath),
      ],
      warnings: [],
      error: errors.join("; ") || undefined,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    await mkdir(outputRoot, { recursive: true });
    const message = error instanceof Error ? error.message : String(error);
    const result: SampleRunResult = {
      sampleId: sample.id,
      status: "failed",
      runner: "docx",
      artifacts: [relativeArtifact(actualRunPath)],
      warnings: [],
      error: message,
      durationMs: Date.now() - startedAt,
    };
    await writeJson(actualRunPath, result);
    return result;
  }
}

async function runSy3HuffmanDocRerunScreenshotDedupSample(
  sample: LoadedAgentSample,
): Promise<SampleRunResult> {
  return runFinalDocxArtifactSample(sample, {
    fixtureName: "sy3-huffman-final.docx",
    requiredOriginalSnippets: [
      "数据结构与算法",
      "实验名称：哈夫曼树的实现",
      "一、实验要求",
      "五、实验步骤",
      "哈夫曼",
      "WPL",
    ],
    requiredGeneratedLabels: ["【代码】", "【运行截图】", "【问题及思考】"],
    forbiddenSnippets: ["系统填写", "双栈", "算术表达式", "表达式求值", "空栈", "括号匹配"],
    requireSingleLatestRunScreenshot: true,
    outputSummary:
      "Accepted sy3 artifact preserves the teacher template, keeps Huffman context, and contains exactly one latest run screenshot.",
  });
}

async function runSy4BracketDocCaptionSpecificitySample(
  sample: LoadedAgentSample,
): Promise<SampleRunResult> {
  return runFinalDocxArtifactSample(sample, {
    fixtureName: "sy4-bracket-final.docx",
    requiredOriginalSnippets: [
      "数据结构与算法",
      "栈的应用-括号匹配实验",
      "一、实验要求",
      "二、实验目的",
      "三、实验内容及原理",
      "五、实验步骤",
      "括号匹配问题",
    ],
    requiredGeneratedLabels: ["【代码】", "【运行截图】", "【问题及思考】"],
    forbiddenSnippets: ["系统填写", "哈夫曼", "Huffman", "WPL", "表达式求值算法执行结果", "算术表达式"],
    requiredCaption: "括号匹配程序的实际判断结果",
    requireSingleLatestRunScreenshot: true,
    outputSummary:
      "Accepted sy4 artifact preserves the teacher template and keeps the screenshot caption bracket-matching specific.",
  });
}

async function runSy5CodeFormattingSample(sample: LoadedAgentSample): Promise<SampleRunResult> {
  const startedAt = Date.now();
  const outputRoot = sampleRunRoot(sample);
  const actualRunPath = path.join(outputRoot, "actual-run-result.json");
  const tracePath = path.join(outputRoot, "trace.json");
  const expectedDocxPath = path.join(
    sample.directory,
    "expected-docx",
    "sy5-seqlist-code-format-final.docx",
  );
  const errors: string[] = [];
  const requiredOriginalSnippets = [
    "数据结构与算法",
    "实验名称：顺序表的基本操作",
    "一、实验要求",
    "五、实验步骤",
    "//实现代码：",
    "实验结果与分析",
    "问题及思考",
  ];
  const requiredGeneratedLabels = ["【代码】", "【运行截图】", "【问题及思考】"];

  try {
    const { xml, documentXml, mediaFiles } = await inspectDocxPackage(expectedDocxPath);
    const visibleText = extractDocxParagraphTexts(documentXml).join("\n");
    const codeParagraphs = getInsertedCodeParagraphs(documentXml);
    const systemRunMedia = mediaFiles.filter((file) =>
      file.includes("system-run-screenshot"),
    );
    const codeMaxParagraphLength = codeParagraphs.reduce(
      (maxLength, paragraph) => Math.max(maxLength, paragraph.length),
      0,
    );

    if (xml.includes("系统填写")) {
      errors.push("Final DOCX must not contain the words 系统填写.");
    }

    for (const snippet of requiredOriginalSnippets) {
      if (!visibleText.includes(snippet)) {
        errors.push(`Final DOCX is missing original snippet: ${snippet}.`);
      }
    }

    for (const label of requiredGeneratedLabels) {
      if (!visibleText.includes(label)) {
        errors.push(`Final DOCX is missing generated fill label: ${label}.`);
      }
    }

    if (codeParagraphs.length < 10) {
      errors.push(
        `Inserted code should be split into many copyable paragraphs, found ${codeParagraphs.length}.`,
      );
    }

    if (codeMaxParagraphLength > 900) {
      errors.push(
        `Inserted code still has an oversized paragraph (${codeMaxParagraphLength} chars), which risks unreadable DOCX layout.`,
      );
    }

    if (systemRunMedia.length === 0) {
      errors.push("Final DOCX should contain a real system-run screenshot media file.");
    }

    const actual = {
      expectedDocx: relativeArtifact(expectedDocxPath),
      requiredOriginalSnippets,
      requiredGeneratedLabels,
      visibleTextLength: visibleText.length,
      codeParagraphCount: codeParagraphs.length,
      codeMaxParagraphLength,
      codePreview: codeParagraphs.slice(0, 20),
      mediaFiles,
      systemRunMedia,
      hasSystemFill: xml.includes("系统填写"),
      passed: errors.length === 0,
      errors,
    };

    await mkdir(outputRoot, { recursive: true });
    await writeJson(actualRunPath, actual);
    await writeJson(tracePath, [
      {
        step: "export-docx",
        status: errors.length === 0 ? "success" : "failed",
        outputSummary:
          errors.length === 0
            ? "Accepted sy5 artifact preserves the teacher template and keeps inserted code split into copyable paragraphs."
            : errors.join("; "),
        artifacts: [
          {
            kind: "docx",
            metadata: {
              path: relativeArtifact(expectedDocxPath),
              codeParagraphCount: codeParagraphs.length,
              codeMaxParagraphLength,
              mediaCount: mediaFiles.length,
              systemRunScreenshotCount: systemRunMedia.length,
              noSystemFill: !xml.includes("系统填写"),
            },
          },
        ],
      },
    ]);

    return {
      sampleId: sample.id,
      status: errors.length === 0 ? "passed" : "failed",
      runner: "docx",
      artifacts: [
        relativeArtifact(expectedDocxPath),
        relativeArtifact(actualRunPath),
        relativeArtifact(tracePath),
      ],
      warnings: [],
      error: errors.join("; ") || undefined,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    await mkdir(outputRoot, { recursive: true });
    const message = error instanceof Error ? error.message : String(error);
    const result: SampleRunResult = {
      sampleId: sample.id,
      status: "failed",
      runner: "docx",
      artifacts: [relativeArtifact(actualRunPath)],
      warnings: [],
      error: message,
      durationMs: Date.now() - startedAt,
    };
    await writeJson(actualRunPath, result);
    return result;
  }
}

function browserActionsForSample(sampleId: string): BrowserScreenshotAction[] | undefined {
  if (sampleId === "007-frontend-basic-lab") {
    return [
      { type: "screenshot", label: "initial" },
      { type: "click", selector: "#increment" },
      { type: "wait", ms: 250 },
      { type: "screenshot", label: "after-click" },
    ];
  }

  return undefined;
}

async function runBrowserScreenshotSample(sample: LoadedAgentSample): Promise<SampleRunResult> {
  const startedAt = Date.now();
  const warnings: string[] = [];
  const outputRoot = sampleRunRoot(sample);
  const artifactsDir = path.join(outputRoot, "artifacts");
  const createdAt = new Date().toISOString();
  const runId = `sample-${createdAt.replace(/[:.]/g, "-")}`;

  try {
    const files = await readInputFiles(sample.directory);
    const screenshots = await generateBrowserPageScreenshots({
      taskId: sample.id,
      runId,
      files,
      entryFile: "index.html",
      viewport: { width: 1280, height: 720 },
      fullPage: true,
      createdAt,
      actions: browserActionsForSample(sample.id),
    });
    const actualScreenshotsPath = path.join(outputRoot, "actual-screenshots.json");
    const actualRunPath = path.join(outputRoot, "actual-run-result.json");
    const tracePath = path.join(outputRoot, "trace.json");

    await mkdir(artifactsDir, { recursive: true });
    const metadata: Array<Record<string, unknown>> = [];
    const screenshotArtifacts: string[] = [];
    const screenshotWarnings: string[] = [];

    for (const [index, screenshot] of screenshots.entries()) {
      const label = screenshot.label || `browser-${index + 1}`;
      const fileName = `browser-page-screenshot-${index + 1}-${label}.png`;
      const screenshotPath = path.join(artifactsDir, fileName);
      await writeFile(screenshotPath, screenshot.buffer);
      const screenshotArtifact = relativeArtifact(screenshotPath);
      screenshotArtifacts.push(screenshotArtifact);
      screenshotWarnings.push(...screenshot.warnings);
      metadata.push({
        id: `${runId}-${index + 1}`,
        type: "browser_page_screenshot",
        source: "real_browser_render",
        path: screenshotArtifact,
        storagePath: screenshotArtifact,
        fileName,
        contentType: "image/png",
        requiredByTask: true,
        isRealScreenshot: true,
        isAiGenerated: false,
        missing: false,
        label,
        width: screenshot.width,
        height: screenshot.height,
        viewport: { width: 1280, height: 720 },
        fullPage: true,
        pageUrl: screenshot.pageUrl,
        consoleMessages: screenshot.consoleMessages,
        pageErrors: screenshot.pageErrors,
        runtimeMs: screenshot.runtimeMs,
        browser: {
          engine: "chromium",
          viewport: { width: 1280, height: 720 },
          entryFile: "index.html",
          fullPage: true,
        },
        warnings: screenshot.warnings,
        createdAt,
      });
    }

    const quality = evaluateTaskOutput({
      workflowType: sample.metadata?.task_type,
      taskText: await readFile(path.join(sample.directory, "sample-task.md"), "utf8"),
      generatedCode: JSON.stringify(files.map((file) => file.path)),
      runResult: {
        success: true,
        stdout: "Browser screenshot fixture completed.",
        stderr: screenshotWarnings.join("\n"),
        exitCode: 0,
        runtimeMs: Date.now() - startedAt,
      },
      screenshots: metadata,
      reportText: `Browser page screenshot generated: ${screenshotArtifacts.join(", ")}`,
      exportMode: "patch_original_docx",
      screenshotRequired: true,
    });
    const result: SampleRunResult = {
      sampleId: sample.id,
      status: quality.passed ? "passed" : "failed",
      runner: "browser",
      artifacts: [
        ...screenshotArtifacts,
        relativeArtifact(actualScreenshotsPath),
        relativeArtifact(actualRunPath),
        relativeArtifact(tracePath),
      ],
      warnings: [...warnings, ...screenshotWarnings, ...quality.warnings],
      error: quality.blockingIssues.join("; ") || undefined,
      durationMs: Date.now() - startedAt,
      quality,
    };

    await writeJson(actualScreenshotsPath, metadata);
    await writeJson(actualRunPath, result);
    await writeJson(tracePath, [
      {
        step: "generate-screenshot",
        status: "success",
        artifacts: metadata,
      },
      {
        step: "evaluate",
        status: quality.passed ? "success" : "failed",
        outputSummary: `score=${quality.score}`,
      },
    ]);
    return result;
  } catch (error) {
    const actualRunPath = path.join(outputRoot, "actual-run-result.json");
    const result: SampleRunResult = {
      sampleId: sample.id,
      status: "failed",
      runner: "browser",
      warnings,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startedAt,
    };
    await mkdir(outputRoot, { recursive: true });
    await writeJson(actualRunPath, result);
    return result;
  }
}

function resolveRequestedSamples(samples: LoadedAgentSample[], requestedIds: string[]) {
  return requestedIds.map((requestedId) => {
    if (/^\d{3}$/.test(requestedId)) {
      return samples.find((sample) => sample.id.startsWith(`${requestedId}-`));
    }
    return samples.find((sample) => sample.id === requestedId);
  });
}

export async function runSamples(cwd = process.cwd()) {
  const checkResult = await checkSamples(cwd);
  if (!checkResult.ok) {
    return {
      ok: false,
      results: [] as SampleRunResult[],
      errors: checkResult.errors,
      warnings: checkResult.warnings,
    };
  }

  const options = getCliOptions();
  if (options.mode !== "local-fixture") {
    return {
      ok: false,
      results: [] as SampleRunResult[],
      errors: [`Unsupported samples:run mode: ${options.mode}. Only local-fixture is implemented.`],
      warnings: checkResult.warnings,
    };
  }

  const samples = await loadStandardSamples(cwd);
  const resolved = resolveRequestedSamples(samples, options.requestedSampleIds);
  const missingRequestedSampleIds = options.requestedSampleIds.filter(
    (_sampleId, index) => !resolved[index],
  );
  if (missingRequestedSampleIds.length > 0) {
    return {
      ok: false,
      results: [] as SampleRunResult[],
      errors: [
        `Requested samples were not found: ${missingRequestedSampleIds.join(", ")}.`,
      ],
      warnings: checkResult.warnings,
    };
  }

  const selected =
    options.requestedSampleIds.length > 0
      ? (resolved.filter(Boolean) as LoadedAgentSample[])
      : options.runAll
        ? samples
        : samples.filter((sample) =>
            [
              "002-real-run-screenshot-workflow",
              "003-browser-page-screenshot-workflow",
              "004-python-file-io-lab",
              "005-python-oop-lab",
              "006-python-data-analysis-lab",
              "007-frontend-basic-lab",
              "008-docx-template-edge-cases",
              "009-failed-run-recovery",
              "010-no-screenshot-required",
              "011-csv-dataset-doc-export-workflow",
              "012-run-code-screenshot-trace-export-consistency",
              "013-download-filename-encoding",
              "014-sy2-sectioned-doc-preservation-workflow",
              "015-sy3-huffman-doc-rerun-screenshot-dedup",
              "016-sy4-bracket-doc-caption-specificity",
              "017-sy5-code-block-formatting-workflow",
            ].includes(sample.id),
          );
  const results: SampleRunResult[] = [];

  for (const sample of selected) {
    if (sample.id === "013-download-filename-encoding") {
      results.push(await runDownloadFilenameEncodingSample(sample));
      continue;
    }
    if (sample.id === "014-sy2-sectioned-doc-preservation-workflow") {
      results.push(await runSy2SectionedDocPreservationSample(sample));
      continue;
    }
    if (sample.id === "015-sy3-huffman-doc-rerun-screenshot-dedup") {
      results.push(await runSy3HuffmanDocRerunScreenshotDedupSample(sample));
      continue;
    }
    if (sample.id === "016-sy4-bracket-doc-caption-specificity") {
      results.push(await runSy4BracketDocCaptionSpecificitySample(sample));
      continue;
    }
    if (sample.id === "017-sy5-code-block-formatting-workflow") {
      results.push(await runSy5CodeFormattingSample(sample));
      continue;
    }
    if (sample.id === "008-docx-template-edge-cases") {
      results.push(await runDocxEdgeCaseSample(sample));
      continue;
    }
    if (sample.id === "009-failed-run-recovery") {
      results.push(await runFailedRecoverySample(sample));
      continue;
    }
    if (isCommandReplaySample(sample.metadata)) {
      results.push(await runCommandScreenshotSample(sample));
      continue;
    }
    if (isBrowserReplaySample(sample.metadata)) {
      results.push(await runBrowserScreenshotSample(sample));
      continue;
    }

    results.push({
      sampleId: sample.id,
      status: "skipped",
      warnings: [
        "This sample is structurally checked, but real replay is not implemented yet.",
      ],
    });
  }

  const failedResults = results.filter((result) => result.status === "failed");
  const replayedResults = results.filter(
    (result) => result.status === "passed" || result.status === "partial",
  );
  const errors = failedResults.map(
    (result) =>
      `${result.sampleId}: ${result.error || "sample replay failed without details."}`,
  );

  if (results.length === 0) {
    errors.push("No samples were selected for replay.");
  } else if (replayedResults.length === 0) {
    errors.push("No replay-capable samples ran. Requested samples are not implemented yet.");
  }

  return {
    ok: errors.length === 0,
    results,
    errors,
    warnings: checkResult.warnings,
  };
}

async function main() {
  const mode = process.argv.includes("--run") ? "run" : "check";

  if (mode === "run") {
    const result = await runSamples();
    console.log("\nSample Regression Summary\n");
    for (const warning of result.warnings) {
      console.warn(`WARN: ${warning}`);
    }
    for (const sampleResult of result.results) {
      console.log(
        `${sampleResult.status.toUpperCase()}: ${sampleResult.sampleId}${
          sampleResult.durationMs ? ` (${sampleResult.durationMs}ms)` : ""
        }`,
      );
      if (sampleResult.runner) console.log(`  runner: ${sampleResult.runner}`);
      if (sampleResult.quality) {
        console.log(
          `  quality: ${sampleResult.quality.score} ${
            sampleResult.quality.passed ? "passed" : "failed"
          }`,
        );
      }
      for (const artifact of sampleResult.artifacts ?? []) {
        console.log(`  artifact: ${artifact}`);
      }
      for (const warning of sampleResult.warnings) {
        console.warn(`  WARN: ${warning}`);
      }
      if (sampleResult.error) {
        console.error(`  ERROR: ${sampleResult.error}`);
      }
    }
    if (!result.ok) {
      for (const error of result.errors) {
        console.error(`ERROR: ${error}`);
      }
      process.exitCode = 1;
    }
    return;
  }

  const result = await checkSamples();
  console.log(`Checked ${result.checkedSamples} standard samples.`);

  for (const warning of result.warnings) {
    console.warn(`WARN: ${warning}`);
  }

  if (!result.ok) {
    for (const error of result.errors) {
      console.error(`ERROR: ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("Sample library structural check passed.");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
