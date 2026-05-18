# Lab Report Assistant

面向学生的“实验报告自动化助手”MVP，基于 Next.js App Router、Supabase 和 Moonshot / Kimi API。

当前版本已经支持这条主链路：

1. 创建任务并上传任务书、截图、数据、代码、模板
2. 服务端调用 Moonshot 解析任务，输出结构化 `ParsedRequirement`
3. 在分析确认页补充说明并确认
4. 分步生成大纲
5. 分步生成正文
6. 独立执行一致性检查
7. 在任务详情页查看状态、日志和结果预览

## Tech Stack

- Next.js App Router + TypeScript
- Tailwind CSS
- Supabase Auth + Postgres + Storage
- Moonshot / Kimi API（兼容 OpenAI SDK 的 `chat.completions` 方式）

## Local Setup

1. 在项目根目录创建 `.env.local`
2. 填写下面这些环境变量
3. 安装依赖并运行开发环境

```bash
npm install
npm run dev
```

开发环境默认地址：`http://localhost:3000`

## Environment Variables

```bash
MOONSHOT_API_KEY=
MOONSHOT_BASE_URL=https://api.moonshot.ai/v1
MOONSHOT_MODEL=kimi-k2.5
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

注意：

- `MOONSHOT_API_KEY` 只能放服务端环境变量，不能下发到前端
- `SUPABASE_SERVICE_ROLE_KEY` 只能放服务端环境变量
- 前端只使用 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Supabase Setup

先执行初始 migration，再执行第二轮增量 migration：

- `supabase/migrations/20260402105000_init.sql`
- `supabase/migrations/20260402143000_task_flow_v2.sql`

这两条 migration 会创建并升级以下核心结构：

- `profiles`
- `tasks`
- `task_inputs`
- `task_files`
- `task_runs`
- `task_steps`
- `task_outputs`
- `billing_logs`

第二轮 migration 额外补了这些关键字段：

- `tasks.current_step`
- `tasks.parsed_requirement_json`
- `tasks.outline_json`
- `tasks.report_markdown`
- `tasks.analysis_status`
- `tasks.generation_status`
- `tasks.consistency_status`
- `tasks.last_error`
- `task_runs.run_no`
- `task_runs.model_name`
- `task_steps.started_at`
- `task_steps.finished_at`

Storage 仍使用私有 bucket：`task-files`

## Moonshot / Kimi Setup

本项目不使用 OpenAI Responses API、Assistants API、file search 或 code interpreter。

AI 统一走服务端的 Moonshot 封装层：

- `src/lib/ai/moonshot.ts`
- `src/lib/ai/prompts.ts`
- `src/lib/ai/types.ts`
- `src/lib/validators/parsed-requirement.ts`

默认模型：

- `kimi-k2.5`

默认 Base URL：

- `https://api.moonshot.ai/v1`

## Main Routes

页面：

- `/`
- `/auth`
- `/tasks`
- `/tasks/new`
- `/tasks/[id]/analysis`
- `/tasks/[id]`

接口：

- `POST /api/tasks`
- `GET /api/tasks`
- `GET /api/tasks/[id]`
- `POST /api/tasks/[id]/analyze`
- `POST /api/tasks/[id]/generate-outline`
- `POST /api/tasks/[id]/generate-report`
- `POST /api/tasks/[id]/consistency-check`
- `POST /api/upload`

## Project Structure

```text
src/
  app/
    api/                              # Route Handlers
    auth/                             # 登录 / 注册
    tasks/                            # 任务列表、创建、分析确认、详情页
  components/ui/                      # 复用 UI
  lib/ai/                             # Moonshot 调用、Prompt、类型
  lib/supabase/                       # Browser / Server / Admin client
  lib/tasks/                          # 上下文组装、状态机、仓储、任务编排
  lib/validators/                     # 服务端结构化校验
supabase/migrations/                  # 数据库 migration
```

## 第二轮增量说明

本轮重点是“增量升级”，没有推翻现有项目结构，而是在原有 MVP 上补齐：

- Moonshot / Kimi AI 服务层
- Prompt 集中管理
- `ParsedRequirement` 结构化校验和标准化
- `/tasks/[id]/analysis` 分析确认页
- 大纲 / 正文 / 检查三个分步接口
- `task_runs` / `task_steps` 运行日志
- 任务详情页状态条、预览区和重试按钮
- 适合后续接入 n8n 的 `task-runner` 编排边界

核心边界文件：

- `src/lib/tasks/context-builder.ts`
- `src/lib/tasks/task-runner.ts`
- `src/lib/tasks/task-status.ts`

## Notes

- `npm run lint` 已通过
- `npm run build` 已通过
- docx / pdf 仍然是预留按钮，尚未接入真实导出逻辑
- 如果你要继续接 n8n，推荐直接从 `src/lib/tasks/task-runner.ts` 这一层接入
