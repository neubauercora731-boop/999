# Lab Report Assistant

面向学生实验任务的垂直 Agent 工作流系统。它不是普通聊天框，而是把“上传任务书 -> 解析任务 -> 生成代码 -> 真实运行 -> 真实截图 -> 质量检查 -> 保留原模板导出 DOCX”串成一条可追踪的交付链路。

## 当前能力

- Supabase Auth 登录态、任务列表、新建任务和文件上传。
- 文件角色识别：`task_book`、`report_template`、`dataset`、`screenshot`、`source_code`、`reference`、`unknown`。
- DOC/DOCX/TXT/MD 任务书解析，CSV/XLSX 等数据集进入任务上下文。
- AI 分析、代码生成、真实运行 Python、失败记录和一次调试入口。
- `command_output_screenshot` 真实运行截图。
- `browser_page_screenshot` 静态前端页面真实浏览器截图基础能力。
- Agent trace console 和 quality evaluation。
- `patch_original_docx` 原模板保护导出，最终 DOCX 不出现“系统填写”字样。
- `.doc` 本地可通过 LibreOffice/soffice 转成 `.docx` baseline 后再 patch；不能安全转换时禁止伪原格式导出。
- 样本库回归：`npm run samples:check` 和 `npm run samples:run -- --mode=local-fixture --all`。

## Tech Stack

- Next.js App Router + TypeScript + React 19
- Tailwind CSS 4
- Supabase Auth / Postgres / Storage
- Moonshot / Kimi OpenAI-compatible chat completions
- DOCX: `jszip`、`docx`、`mammoth`、`word-extractor`
- Screenshots: `sharp`、`playwright`

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

开发地址：

```text
http://localhost:3000
```

本地完整运行建议：

- Node.js 20+
- Python 3，用于本地 `run-code`
- LibreOffice/soffice，用于 `.doc -> .docx` baseline 转换
- Playwright Chromium，用于本地浏览器截图样本

```bash
npx playwright install chromium
```

## Environment Variables

复制 `.env.example` 到 `.env.local`，本地填真实值。不要提交 `.env.local`。

```bash
MOONSHOT_API_KEY=
MOONSHOT_BASE_URL=https://api.moonshot.ai/v1
MOONSHOT_MODEL=kimi-k2.5

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

安全边界：

- `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 会暴露给浏览器。
- `SUPABASE_SERVICE_ROLE_KEY` 只能放服务端环境变量，不能进入前端。
- `MOONSHOT_API_KEY` 只能放服务端环境变量，不能进入前端。

## Supabase Setup

迁移文件在 `supabase/migrations/`：

- `20260402105000_init.sql`
- `20260402143000_task_flow_v2.sql`
- `20260430112000_python_p0_workbench.sql`

Storage bucket：

```text
task-files
```

上线前请在 Supabase Dashboard 复核：

- 所有业务表已启用 RLS。
- `task-files` bucket 是 private。
- Storage policy 使用 `userId/taskId` 路径隔离。
- service role key 没有放到浏览器端。

## Verification

上线前至少运行：

```bash
npm run samples:check
npm run samples:run -- --mode=local-fixture --all
npm run lint
npm run build
```

公开 GitHub Actions 只运行不依赖真实 Office 文档的 privacy-safe 样本子集。`014`-`017` 的 DOC/DOCX 原格式保护样本保留为本地-only fixture，避免把真实实验文档发布到公开仓库。

当前 `008-docx-template-edge-cases` 在样本回放中是 partial by design，不代表主流程失败。

## GitHub / Vercel Notes

推荐先推到 GitHub，再用 Vercel Git Integration 创建 Preview Deployment。Vercel 生产环境需要配置与 `.env.example` 对应的环境变量。

注意：当前 Python runner、Playwright browser runner、LibreOffice `.doc` 转换属于 local-first 能力。在 Vercel Serverless 上不建议长期承载重型运行任务；生产化建议后续拆到 Docker Worker / VPS / Render / Railway，再由 Next.js 负责任务入口、状态查询和 DOCX 下载。

详细上线清单见：

- `docs/deployment/github-vercel-release-checklist.md`
- `docs/deployment/local-backup-and-restore.md`
