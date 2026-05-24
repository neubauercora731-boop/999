import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createServer, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Browser, Page } from "playwright";

import type {
  BrowserPageScreenshotInput,
  BrowserScreenshotAction,
  FrontendScreenshotFile,
  GeneratedScreenshotImage,
} from "./types";

const MAX_FRONTEND_FILES = 40;
const MAX_FILE_CHARS = 1_000_000;
const MAX_TOTAL_CHARS = 2_000_000;
const DEFAULT_RENDER_TIMEOUT_MS = 8_000;
const DEFAULT_STABLE_WAIT_MS = 700;
const DEFAULT_ACTION_TIMEOUT_MS = 8_000;
const ALLOWED_EXTENSIONS = new Set([
  ".html",
  ".htm",
  ".css",
  ".js",
  ".mjs",
  ".json",
  ".txt",
  ".svg",
]);

type ChromiumLauncher = {
  launch: (options: {
    headless: boolean;
    channel?: "chrome" | "msedge";
  }) => Promise<Browser>;
};

function normalizePreviewPath(filePath: string) {
  const normalized = filePath.replace(/\\/g, "/").replace(/^\/+/, "").trim();

  if (!normalized || normalized.includes("\0")) {
    throw new Error("前端截图文件路径无效。");
  }

  const segments = normalized.split("/").filter(Boolean);
  if (
    segments.length === 0 ||
    segments.some((segment) => segment === "." || segment === "..")
  ) {
    throw new Error("前端截图文件路径不能包含上级目录。");
  }

  const lowerPath = segments.join("/").toLowerCase();
  if (
    lowerPath.includes("node_modules/") ||
    lowerPath === ".env" ||
    lowerPath.includes("/.env")
  ) {
    throw new Error("前端截图预览不允许写入 node_modules 或环境变量文件。");
  }

  const extension = path.posix.extname(lowerPath);
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error(`当前前端截图预览暂不支持 ${extension || "无后缀"} 文件。`);
  }

  return segments.join("/");
}

function contentTypeFor(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".html" || extension === ".htm") return "text/html; charset=utf-8";
  if (extension === ".css") return "text/css; charset=utf-8";
  if (extension === ".js" || extension === ".mjs") {
    return "text/javascript; charset=utf-8";
  }
  if (extension === ".json") return "application/json; charset=utf-8";
  if (extension === ".svg") return "image/svg+xml; charset=utf-8";
  return "text/plain; charset=utf-8";
}

function prepareFrontendFiles(files: FrontendScreenshotFile[]) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error("请提供至少一个前端文件用于真实网页效果截图。");
  }

  if (files.length > MAX_FRONTEND_FILES) {
    throw new Error(`前端截图第一版最多支持 ${MAX_FRONTEND_FILES} 个文件。`);
  }

  let totalChars = 0;
  const normalized = files.map((file) => {
    const safePath = normalizePreviewPath(file.path);
    if (typeof file.content !== "string") {
      throw new Error(`文件 ${safePath} 内容必须是文本。`);
    }
    if (file.content.length > MAX_FILE_CHARS) {
      throw new Error(`文件 ${safePath} 内容过大，暂不支持预览。`);
    }
    totalChars += file.content.length;
    return { path: safePath, content: file.content };
  });

  if (totalChars > MAX_TOTAL_CHARS) {
    throw new Error("前端文件总内容过大，暂不支持本地安全预览截图。");
  }

  const deduped = new Map<string, FrontendScreenshotFile>();
  for (const file of normalized) {
    deduped.set(file.path, file);
  }

  return [...deduped.values()];
}

async function writePreviewProject(rootDir: string, files: FrontendScreenshotFile[]) {
  for (const file of files) {
    const absolutePath = path.join(rootDir, ...file.path.split("/"));
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, file.content, "utf8");
  }
}

function isInsideRoot(rootDir: string, targetPath: string) {
  const relative = path.relative(rootDir, targetPath);
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function startPreviewServer(rootDir: string, entryFile: string) {
  const send = (response: ServerResponse, status: number, body: string) => {
    response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(body);
  };

  const server: Server = createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
      const requestedPath =
        requestUrl.pathname === "/"
          ? entryFile
          : decodeURIComponent(requestUrl.pathname).replace(/^\/+/, "");
      const safePath = normalizePreviewPath(requestedPath);
      const absolutePath = path.resolve(rootDir, ...safePath.split("/"));

      if (!isInsideRoot(rootDir, absolutePath)) {
        send(response, 403, "Forbidden");
        return;
      }

      const fileStat = await stat(absolutePath).catch(() => null);
      if (!fileStat?.isFile()) {
        send(response, 404, "Not found");
        return;
      }

      const content = await readFile(absolutePath);
      response.writeHead(200, {
        "Content-Type": contentTypeFor(absolutePath),
        "Cache-Control": "no-store",
      });
      response.end(content);
    } catch (error) {
      send(response, 500, error instanceof Error ? error.message : "Preview error");
    }
  });

  return new Promise<{
    url: string;
    port: number;
    close: () => Promise<void>;
  }>((resolve, reject) => {
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${address.port}/${entryFile}`,
        port: address.port,
        close: () =>
          new Promise<void>((closeResolve) => {
            server.close(() => closeResolve());
          }),
      });
    });
  });
}

function getBrowserLaunchMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (
    message.includes("Executable doesn't exist") ||
    message.includes("Please run the following command") ||
    message.includes("browserType.launch")
  ) {
    return "当前本地缺少 Playwright Chromium 浏览器，请运行 npx playwright install chromium 后重试。";
  }
  return message;
}

async function launchChromiumBrowser(chromium: ChromiumLauncher) {
  const launchOptions = [
    { headless: true },
    { headless: true, channel: "chrome" as const },
    { headless: true, channel: "msedge" as const },
  ];
  let firstError: unknown = null;

  for (const options of launchOptions) {
    try {
      return await chromium.launch(options);
    } catch (error) {
      firstError ??= error;
    }
  }

  throw firstError ?? new Error("Playwright Chromium 启动失败。");
}

async function executeBrowserAction(page: Page, action: BrowserScreenshotAction) {
  if (action.type === "click") {
    await page.click(action.selector, { timeout: DEFAULT_ACTION_TIMEOUT_MS });
    return;
  }

  if (action.type === "fill") {
    await page.fill(action.selector, action.value, { timeout: DEFAULT_ACTION_TIMEOUT_MS });
    return;
  }

  if (action.type === "press") {
    await page.press(action.selector, action.key, { timeout: DEFAULT_ACTION_TIMEOUT_MS });
    return;
  }

  if (action.type === "waitForSelector") {
    await page.waitForSelector(action.selector, {
      timeout: action.timeoutMs ?? DEFAULT_ACTION_TIMEOUT_MS,
    });
    return;
  }

  if (action.type === "wait") {
    await page.waitForTimeout(Math.max(0, Math.min(15_000, action.ms)));
  }
}

export async function generateBrowserPageScreenshots(
  input: BrowserPageScreenshotInput,
): Promise<GeneratedScreenshotImage[]> {
  const files = prepareFrontendFiles(input.files);
  const entryFile = normalizePreviewPath(input.entryFile || "index.html");
  const entryExists = files.some((file) => file.path === entryFile);

  if (!entryExists) {
    throw new Error(`找不到入口文件 ${entryFile}，无法生成真实网页效果截图。`);
  }

  const viewport = {
    width: Math.max(320, Math.min(2560, Math.floor(input.viewport.width || 1280))),
    height: Math.max(240, Math.min(2000, Math.floor(input.viewport.height || 720))),
  };
  const tempDir = await mkdtemp(path.join(tmpdir(), "lab-browser-preview-"));
  const warnings: string[] = [];
  const consoleMessages: Array<{ type: string; text: string }> = [];
  const pageErrors: string[] = [];
  const startedAt = Date.now();
  let previewServer:
    | {
        url: string;
        port: number;
        close: () => Promise<void>;
      }
    | null = null;

  try {
    await writePreviewProject(tempDir, files);
    previewServer = await startPreviewServer(tempDir, entryFile);

    const { chromium } = await import("playwright");
    const browser = await launchChromiumBrowser(chromium);

    try {
      const context = await browser.newContext({
        viewport,
        javaScriptEnabled: true,
        serviceWorkers: "block",
      });

      await context.clearCookies();
      await context.route("**/*", (route) => {
        try {
          const url = new URL(route.request().url());
          const isLocalPreview =
            url.hostname === "127.0.0.1" && url.port === String(previewServer?.port);
          const isSafeInline = url.protocol === "data:" || url.protocol === "blob:";

          if (isLocalPreview || isSafeInline) {
            void route.continue();
            return;
          }

          warnings.push(`已阻止外部资源请求：${url.origin}`);
          void route.abort("blockedbyclient");
        } catch {
          void route.abort("blockedbyclient");
        }
      });

      const page = await context.newPage();
      page.on("console", (message) => {
        const record = {
          type: message.type(),
          text: message.text().slice(0, 500),
        };
        consoleMessages.push(record);
        if (record.type === "error" || record.type === "warning") {
          warnings.push(`浏览器控制台 ${record.type}：${record.text.slice(0, 240)}`);
        }
      });
      page.on("pageerror", (error) => {
        const message = error.message.slice(0, 500);
        pageErrors.push(message);
        warnings.push(`页面脚本错误：${message.slice(0, 240)}`);
      });

      const response = await page.goto(previewServer.url, {
        waitUntil: "domcontentloaded",
        timeout: DEFAULT_RENDER_TIMEOUT_MS,
      });

      if (!response || response.status() >= 400) {
        throw new Error(
          `浏览器预览页面打开失败，HTTP 状态：${response?.status() ?? "unknown"}`,
        );
      }

      await page.waitForTimeout(DEFAULT_STABLE_WAIT_MS);

      const fileHash = createHash("sha256")
        .update(files.map((file) => `${file.path}\n${file.content}`).join("\n---\n"))
        .digest("hex")
        .slice(0, 16);
      warnings.push(`前端文件包 SHA256 前缀：${fileHash}`);

      const screenshots: GeneratedScreenshotImage[] = [];
      const capture = async (label?: string) => {
        const buffer = await page.screenshot({
          type: "png",
          fullPage: input.fullPage,
          timeout: DEFAULT_RENDER_TIMEOUT_MS,
        });
        const dimensions = await page.evaluate(() => ({
          width: Math.max(
            document.documentElement.scrollWidth,
            document.body?.scrollWidth ?? 0,
            window.innerWidth,
          ),
          height: Math.max(
            document.documentElement.scrollHeight,
            document.body?.scrollHeight ?? 0,
            window.innerHeight,
          ),
        }));

        screenshots.push({
          buffer,
          width: input.fullPage ? dimensions.width : viewport.width,
          height: input.fullPage ? dimensions.height : viewport.height,
          warnings: [...warnings],
          label,
          pageUrl: page.url(),
          consoleMessages: [...consoleMessages],
          pageErrors: [...pageErrors],
          runtimeMs: Date.now() - startedAt,
        });
      };

      for (const action of input.actions ?? []) {
        if (action.type === "screenshot") {
          await capture(action.label);
        } else {
          await executeBrowserAction(page, action);
        }
      }

      if (screenshots.length === 0) {
        await capture("final");
      }

      await context.close();
      return screenshots;
    } finally {
      await browser.close().catch(() => undefined);
    }
  } catch (error) {
    throw new Error(getBrowserLaunchMessage(error));
  } finally {
    await previewServer?.close().catch(() => undefined);
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function generateBrowserPageScreenshot(
  input: BrowserPageScreenshotInput,
): Promise<GeneratedScreenshotImage> {
  const screenshots = await generateBrowserPageScreenshots(input);
  const last = screenshots.at(-1);
  if (!last) {
    throw new Error("真实网页效果截图生成失败：没有生成任何截图。");
  }
  return last;
}
