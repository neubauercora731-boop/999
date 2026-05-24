export type ScreenshotEvidenceType =
  | "command_output_screenshot"
  | "browser_page_screenshot";

export type ScreenshotEvidenceSource =
  | "real_run_code_result"
  | "real_browser_render";

export interface ScreenshotEvidence {
  id: string;
  type: ScreenshotEvidenceType;
  source: ScreenshotEvidenceSource;
  path: string;
  storagePath: string;
  contentType: "image/png";
  fileName: string;
  description?: string;
  createdAt: string;
  relatedRunId: string | null;
  requiredByTask: boolean;
  isRealScreenshot: true;
  isAiGenerated: false;
  missing: false;
  width: number;
  height: number;
  label?: string;
  runtimeMs?: number;
  pageUrl?: string;
  consoleMessages?: Array<{
    type: string;
    text: string;
  }>;
  pageErrors?: string[];
  browser?: {
    engine: "chromium";
    viewport: {
      width: number;
      height: number;
    };
    entryFile: string;
    fullPage: boolean;
  };
  warnings: string[];
}

export interface MissingScreenshotEvidence {
  screenshotRequired: true;
  screenshotMissing: true;
  missingReason: string;
}

export interface CommandOutputScreenshotInput {
  taskId: string;
  runId: string;
  command: string;
  filename: string;
  code: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  timedOut: boolean;
  createdAt: string;
}

export interface FrontendScreenshotFile {
  path: string;
  content: string;
}

export type BrowserScreenshotAction =
  | { type: "click"; selector: string }
  | { type: "fill"; selector: string; value: string }
  | { type: "press"; selector: string; key: string }
  | { type: "waitForSelector"; selector: string; timeoutMs?: number }
  | { type: "wait"; ms: number }
  | { type: "screenshot"; label?: string };

export interface BrowserPageScreenshotInput {
  taskId: string;
  runId: string;
  files: FrontendScreenshotFile[];
  entryFile: string;
  viewport: {
    width: number;
    height: number;
  };
  fullPage: boolean;
  createdAt: string;
  actions?: BrowserScreenshotAction[];
}

export interface GeneratedScreenshotImage {
  buffer: Buffer;
  width: number;
  height: number;
  warnings: string[];
  label?: string;
  pageUrl?: string;
  consoleMessages?: Array<{
    type: string;
    text: string;
  }>;
  pageErrors?: string[];
  runtimeMs?: number;
}
