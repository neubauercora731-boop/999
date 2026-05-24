# Local Dev Checklist

## Goal

本项目先以本地跑通为准，再考虑 GitHub push 和 Vercel 部署。不要在登录态、上传、解析、任务创建没有本地验证前频繁部署。

## Local Startup

```bash
npm install
npm run dev
```

如果 `3000` 端口被占用：

```bash
npm run dev -- --port 3001
```

开发地址：

- `http://localhost:3000`
- 备用：`http://localhost:3001`

## Required `.env.local`

`.env.local` 只放在本机，不能提交 Git。

必需变量名：

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
MOONSHOT_API_KEY=
MOONSHOT_BASE_URL=https://api.moonshot.ai/v1
MOONSHOT_MODEL=kimi-k2.5
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

说明：

- `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 会进入浏览器，只能放公开 Supabase 配置。
- `SUPABASE_SERVICE_ROLE_KEY` 只能服务端使用，不能进入 Client Component。
- `MOONSHOT_API_KEY` 只能服务端使用，不能进入前端代码。
- 修改 `.env.local` 后必须重启 `npm run dev`。

## Supabase Redirect URL Checklist

在 Supabase Dashboard 手动检查：

Authentication -> URL Configuration

本地开发时 Site URL 可临时设为：

```text
http://localhost:3000
```

生产环境 Site URL：

```text
https://999-rosy.vercel.app
```

Redirect URLs 至少包含：

```text
http://localhost:3000/**
http://127.0.0.1:3000/**
http://localhost:3001/**
http://127.0.0.1:3001/**
http://localhost:3103/**
http://127.0.0.1:3103/**
https://999-rosy.vercel.app/**
```

## Auth State Test

每次修登录态后按顺序测：

1. 打开 `/auth`，确认页面不白屏。
2. 用错误密码登录，确认显示中文错误。
3. 用测试账号登录，确认跳转 `/tasks`。
4. 刷新 `/tasks`，确认仍保持登录。
5. 打开 `/tasks/new`，确认不跳回 `/auth`。
6. 点击任务列表的“退出登录”，确认回到 `/auth`。
7. 退出后直接打开 `/tasks`，确认跳转 `/auth`。
8. 未登录请求 `/api/tasks`，确认返回 `401`。

## Feature Dev Preflight

开发功能前：

- 确认 `.env.local` 存在且变量齐全。
- 确认 `npm run dev` 是当前项目唯一运行中的 dev server。
- 先打开 `/auth` 和 `/tasks` 验证登录态。
- 不要在登录态异常时继续开发上传、解析、AI 工作流。

## Feature Dev Verification

功能改完后：

```bash
npm run lint
npm run build
```

如果涉及页面体验，再启动：

```bash
npm run dev
```

手动检查：

- `/`
- `/demo`
- `/auth`
- `/tasks`
- `/tasks/new`
- `/tasks/[id]/analysis`
- `/tasks/[id]`

## When To Push GitHub

只有满足以下条件再 push：

- `npm run lint` 通过。
- `npm run build` 通过。
- 本地登录、刷新、登出通过。
- 本地任务创建通过。
- 涉及上传/解析时，本地上传和 analysis 页面通过。
- 没有 `.env.local`、API key、node_modules 进入 Git。

## When To Deploy Vercel

只有满足以下条件再部署：

- 本地完整流程稳定。
- Vercel 环境变量已配置齐全。
- Supabase Redirect URLs 已包含生产域名。
- 生产环境不依赖本地-only 配置。

## Post-Deploy Auth Regression

部署后回测：

1. 打开生产 `/auth`。
2. 登录测试账号。
3. 进入 `/tasks`。
4. 刷新 `/tasks`。
5. 打开 `/tasks/new`。
6. 创建一个最小任务。
7. 打开 `/tasks/[id]/analysis`。
8. 登出后确认受保护页面会回到 `/auth`。
