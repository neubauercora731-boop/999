# 实验报告自动化助手项目进度说明

本文档用于把当前网站进度、技术状态、已完成工作、部署情况和后续方向交给另一个 ChatGPT 或开发协作者快速理解。文档不包含任何真实 API Key、`.env.local` 内容或敏感密钥。

## 1. 项目定位

项目名称：实验报告自动化助手
英文/内部名称：Lab Report Automation Assistant / lab-report-assistant
线上地址：https://999-rosy.vercel.app
GitHub 仓库：https://github.com/neubauercora731-boop/999
当前主分支：`main`
当前最新提交：`e48c9e0 Polish P0 lab report workflow experience`

这是一个面向学生实验任务的 AI 工作流系统。目标不是做完整 Codex，也不是普通聊天机器人，而是做一个垂直场景里的“小型 AI 执行型助手”。

核心产品闭环：

1. 用户输入或上传实验任务要求
2. AI 理解实验要求
3. AI 拆解实验步骤
4. AI 生成 Python 实验代码
5. 后端运行代码并保留 stdout/stderr
6. 系统整理实验报告草稿
7. 用户编辑、复制或导出报告
8. 登录用户可以保存历史任务

产品定位必须保持为：

- 学习辅助
- 代码验证
- 实验报告整理
- 任务流程自动化

不能使用或暗示：

- 代写作业
- 作弊
- 包过
- 自动提交学校系统
- 伪造截图或伪造实验结果

## 2. 当前技术栈

框架：

- Next.js `16.2.6`
- React `19.2.4`
- TypeScript
- Tailwind CSS 4

主要依赖：

- `@supabase/ssr`
- `@supabase/supabase-js`
- `openai`
- `zod`
- `docx`
- `mammoth`
- `word-extractor`
- `clsx`

运行环境：

- Node.js 要求：`>=20.9.0`
- `.nvmrc` / `.node-version`：`22`
- 部署平台：Vercel
- 数据库和 Auth：Supabase
- AI：Moonshot，通过服务端环境变量调用

package scripts：

```json
{
  "dev": "next dev --webpack",
  "build": "next build",
  "start": "next start",
  "lint": "eslint"
}
```

## 3. 当前部署状态

线上域名：

```text
https://999-rosy.vercel.app
```

已验证：

- 首页 `/` 可访问
- Demo 页 `/demo` 可访问
- 登录页 `/auth` 可访问
- `/tasks` 未登录时正常 307 跳转到 `/auth`
- `/api/system/supabase-health` 返回 `{"ok":true}`
- Vercel Framework Preset 已改为 `Next.js`
- Vercel 环境变量已配置
- Supabase 项目之前暂停过，已经恢复

Vercel 配置当前应为：

- Framework Preset：Next.js
- Root Directory：仓库根目录
- Build Command：`npm run build`
- Output Directory：不要手动填 `public` 或 `dist`，Next.js 默认即可
- Install Command：默认即可，或 `npm install`
- 环境变量：见下方“环境变量”

## 4. 重要历史问题和修复记录

### 4.1 GitHub 只有 zip，导致 Vercel 404

最开始 GitHub 仓库里只有一个压缩包 `lab-report-assistant-deploy.zip`，Vercel 没有拿到真实 Next.js 源码，所以线上显示：

```text
404: NOT_FOUND
```

后来已把真实项目源码替换进 GitHub 仓库。

相关提交：

```text
2eab6d7 Replace zip with Next.js project files
```

### 4.2 Vercel Framework Preset 是 Other，导致把 public 当静态输出

Vercel 设置里一开始 Framework Preset 是 `Other`。因为项目根目录有 `public/`，Vercel 把 `public` 当成输出目录，导致 Next.js 页面无法正确服务。

已修复为：

```text
Framework Preset: Next.js
```

相关提交：

```text
04c07a1 Redeploy with Next.js framework preset
```

### 4.3 缺少 Vercel 环境变量导致任务页 500

首页能打开，但访问 `/tasks`、`/tasks/new` 时出现：

```text
This page couldn't load
A server error occurred.
```

原因是 Vercel 生产环境缺少 Supabase 环境变量，服务端组件初始化 Supabase 时抛错。

已做两层处理：

1. 已把环境变量添加到 Vercel
2. 代码中增加缺环境变量时的安全跳转，避免白屏或 500

相关提交：

```text
f85e3a1 Handle missing production env on protected routes
07d7d03 Redeploy with Vercel environment variables
```

### 4.4 Supabase 项目暂停导致域名无法解析

Vercel 环境变量生效后，`/api/system/supabase-health` 返回：

```text
Supabase 项目域名无法解析
```

检查 Supabase 后发现项目状态是：

```text
Project is paused
```

已经在 Supabase 控制台点击 `Resume project` 恢复。恢复后验证健康接口返回：

```json
{"ok":true}
```

## 5. 环境变量

不要把任何真实值写入 GitHub。

本项目需要以下环境变量：

```text
MOONSHOT_API_KEY
MOONSHOT_BASE_URL
MOONSHOT_MODEL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

说明：

- `MOONSHOT_API_KEY`：服务端使用，不能暴露到前端
- `MOONSHOT_BASE_URL`：Moonshot API base URL
- `MOONSHOT_MODEL`：当前模型名
- `NEXT_PUBLIC_SUPABASE_URL`：Supabase 项目 URL，前端需要
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`：Supabase anon key，前端需要
- `SUPABASE_SERVICE_ROLE_KEY`：服务端使用，权限很高，绝不能进入前端或 GitHub

当前安全状态：

- `.env.local` 不在 GitHub
- `node_modules` 不在 GitHub
- API Key 不在 GitHub
- `.env.example` 只保留空变量名，不包含真实 key

## 6. 当前项目结构概览

主要目录：

```text
app/
  page.tsx
  auth/page.tsx
  demo/page.tsx
  demo/demo-workflow.tsx
  tasks/page.tsx
  tasks/new/page.tsx
  tasks/new/new-task-form.tsx
  tasks/task-list-actions.tsx
  tasks/[id]/page.tsx
  tasks/[id]/workbench.tsx
  tasks/[id]/analysis/page.tsx
  tasks/[id]/analysis/analysis-panel.tsx
  api/
    system/supabase-health/route.ts
    tasks/route.ts
    tasks/[id]/route.ts
    tasks/[id]/analyze/route.ts
    tasks/[id]/confirm-analysis/route.ts
    tasks/[id]/generate-code/route.ts
    tasks/[id]/run-code/route.ts
    tasks/[id]/generate-report/route.ts
    tasks/[id]/save-report/route.ts
    tasks/[id]/export-docx/route.ts

src/
  components/ui/
  components/task/execution-status-panel.tsx
  lib/demo/lab-demo.ts
  lib/ai/
  lib/tasks/
  lib/supabase/
  lib/reports/
  lib/utils.ts

supabase/
  migrations/
```

## 7. 当前已完成的产品能力

### 7.1 首页价值表达

首页已经重写，目标是让用户 5 秒内明白产品能做什么。

当前首页包含：

- 清晰标题：`AI 实验报告自动化助手`
- 副标题说明：输入老师布置的实验要求，系统会拆解任务、生成代码、运行验证并整理报告
- 主按钮：`开始创建任务`
- 次按钮：`先体验 Demo`
- 核心流程展示：
  1. 输入实验任务要求
  2. AI 拆解实验步骤
  3. 自动生成实验代码
  4. 运行并返回结果
  5. 整理实验报告
  6. 保存到我的任务
- “它能做什么”说明区
- “适合哪些场景”说明区
- “当前版本说明”区

对应文件：

```text
app/page.tsx
```

### 7.2 登录页表达优化

登录页现在不仅是登录表单，也解释了产品价值。

当前登录页包含：

- 登录后保存任务历史的说明
- “先体验 Demo”入口
- 登录/注册切换
- Supabase 不可用时有中文错误提示
- Supabase 配置缺失时不会白屏

对应文件：

```text
app/auth/page.tsx
```

### 7.3 免登录 Demo 体验

新增了 `/demo` 页面。

Demo 默认任务：

```text
请完成一个 Python 冒泡排序实验报告，包括实验目的、实验代码、运行结果、结果分析和实验总结。
```

Demo 展示内容：

- 任务要求
- AI 拆解步骤
- 生成的 Python 代码
- 模拟运行结果
- 实验报告文本
- 执行状态面板
- 复制代码
- 复制报告
- 登录保存任务入口

Demo 模式说明：

- 当前 Demo 是 Mock 数据
- 不调用真实 AI
- 不保存数据库
- 目的是稳定演示完整闭环
- 后续可以替换为真实 AI 接口

对应文件：

```text
app/demo/page.tsx
app/demo/demo-workflow.tsx
src/lib/demo/lab-demo.ts
```

### 7.4 Codex 风格执行状态面板

新增通用组件：

```text
src/components/task/execution-status-panel.tsx
```

状态步骤：

1. 正在理解实验要求...
2. 正在拆解任务步骤...
3. 正在生成实验代码...
4. 正在运行代码并验证结果...
5. 正在整理实验报告...
6. 已完成

每一步支持状态：

- `waiting`：等待中
- `running`：执行中
- `success`：已完成
- `error`：失败

应用位置：

- `/demo` Demo 流程
- `/tasks/[id]` 正式任务工作台

### 7.5 新建任务页优化

以前新建任务页要求用户上传任务书文件。现在已经支持：

- 直接输入实验任务要求
- 也可以上传任务书文件
- 文件上传变为可选
- 输入框变大，适合粘贴老师要求
- 创建后进入 AI 拆解/分析确认页

对应文件：

```text
app/tasks/new/new-task-form.tsx
```

### 7.6 正式任务工作台优化

任务详情页 `/tasks/[id]` 现在更像 AI 执行型助手。

当前支持：

- 展示原始任务要求
- 展示 AI 拆解后的实验步骤
- 展示生成的 Python 代码
- 支持复制代码
- 支持运行代码
- 展示 stdout
- 展示 stderr
- 支持生成报告草稿
- 支持复制报告
- 支持保存报告草稿
- 支持导出 DOCX
- 支持一键“生成实验报告”
- 有执行状态面板
- 失败时会显示中文原因

对应文件：

```text
app/tasks/[id]/page.tsx
app/tasks/[id]/workbench.tsx
```

### 7.7 我的任务页面优化

`/tasks` 页面现在更像真实产品的历史任务中心。

每个任务卡片显示：

- 任务标题
- 创建时间
- 更新时间
- 任务状态
- 当前步骤
- 任务类型：Python 实验报告
- 任务摘要
- 失败原因，如果有
- 查看详情按钮
- 解析确认按钮
- 删除任务按钮

对应文件：

```text
app/tasks/page.tsx
app/tasks/task-list-actions.tsx
```

### 7.8 删除任务能力

新增 API：

```text
DELETE /api/tasks/[id]
```

功能：

- 删除数据库里的任务
- 删除关联的 storage 文件，如果有
- 依赖 Supabase RLS 和 userId 保护，只能删自己的任务

对应文件：

```text
app/api/tasks/[id]/route.ts
src/lib/tasks/repository.ts
```

### 7.9 错误提示优化

新增用户友好的错误转换：

```text
toUserFriendlyErrorMessage()
getFriendlyApiErrorMessage()
```

覆盖场景：

- AI 调用失败：
  - `AI 生成失败，请检查 API Key、余额或网络状态。`
- JSON 解析失败：
  - `AI 返回格式异常，请重新生成一次。`
- Python 运行失败：
  - `代码运行失败，请查看错误信息。`
- Python 运行超时：
  - `代码运行超时，可能存在死循环或任务过长。`
- 未登录访问正式任务：
  - `请先登录，登录后可以保存和查看历史任务。`
- 网络请求失败：
  - `请求失败，请检查网络后重试。`

对应文件：

```text
src/lib/utils.ts
app/tasks/[id]/workbench.tsx
app/tasks/[id]/analysis/analysis-panel.tsx
app/tasks/new/new-task-form.tsx
app/tasks/[id]/task-detail-actions.tsx
```

## 8. 当前 API 概览

### 8.1 系统健康检查

```text
GET /api/system/supabase-health
```

用途：

- 检查 Supabase 环境变量是否存在
- 检查 Supabase 项目域名是否能解析
- 检查 Supabase Auth health 是否可访问

当前线上返回：

```json
{"ok":true}
```

### 8.2 任务列表与创建

```text
GET /api/tasks
POST /api/tasks
```

用途：

- 获取当前登录用户任务列表
- 创建新任务

未登录时返回中文提示。

### 8.3 任务详情与删除

```text
GET /api/tasks/[id]
DELETE /api/tasks/[id]
```

用途：

- 获取任务详情
- 删除任务

### 8.4 任务执行相关

```text
POST /api/tasks/[id]/analyze
POST /api/tasks/[id]/confirm-analysis
POST /api/tasks/[id]/generate-code
POST /api/tasks/[id]/run-code
POST /api/tasks/[id]/generate-report
POST /api/tasks/[id]/save-report
GET  /api/tasks/[id]/export-docx
```

说明：

- `analyze` 调用 AI 解析任务
- `confirm-analysis` 保存用户确认后的结构化分析
- `generate-code` 调用 AI 生成 Python 代码
- `run-code` 在后端运行 Python 代码，保存 stdout/stderr
- `generate-report` 生成报告草稿
- `save-report` 保存用户编辑后的报告
- `export-docx` 导出 Word 文档

## 9. 数据库和 Supabase

Supabase 负责：

- 用户登录注册
- 任务表
- 任务输入表
- 文件记录表
- 任务运行记录
- 步骤记录
- 输出记录
- 报告草稿
- 私有 storage bucket

数据库迁移文件：

```text
supabase/migrations/20260402105000_init.sql
supabase/migrations/20260402143000_task_flow_v2.sql
supabase/migrations/20260430112000_python_p0_workbench.sql
```

重要表大致包括：

- `profiles`
- `tasks`
- `task_inputs`
- `task_files`
- `task_runs`
- `task_steps`
- `task_outputs`
- `task_analysis`
- `billing_logs`

Storage bucket：

```text
task-files
```

RLS 已启用，任务数据按用户隔离。

## 10. 当前正式任务流程

### 10.1 用户新建任务

入口：

```text
/tasks/new
```

用户可以：

- 输入任务要求
- 上传任务书
- 上传模板
- 上传截图
- 上传数据文件
- 上传已有代码

创建成功后跳转到：

```text
/tasks/[id]/analysis
```

### 10.2 AI 分析确认

入口：

```text
/tasks/[id]/analysis
```

用户点击“开始解析任务书”后，系统调用 AI，把实验要求整理为结构化 JSON。

用户可以修改：

- 实验名称
- 课程名称
- 实验目的
- 报告章节
- 所需材料
- 缺失信息
- 风险提示
- Python 任务列表

确认后跳转到：

```text
/tasks/[id]
```

### 10.3 工作台执行

入口：

```text
/tasks/[id]
```

用户可以：

- 生成代码
- 复制代码
- 运行代码
- 查看 stdout/stderr
- 一键生成实验报告
- 生成报告草稿
- 编辑报告草稿
- 复制报告
- 保存报告
- 导出 DOCX
- 返回任务列表

执行状态面板会实时反映当前步骤。

## 11. 当前验证结果

最近一次本地验证：

```powershell
npm install
npm run lint
npm run build
npm run dev -- -p 3103
```

结果：

- `npm install` 成功
- `npm run lint` 成功
- `npm run build` 成功
- 本地 dev 服务可打开首页、Demo、Auth
- 线上首页、Demo、Auth 已验证
- 线上 Supabase health 已验证

线上验证：

```text
https://999-rosy.vercel.app/
https://999-rosy.vercel.app/demo
https://999-rosy.vercel.app/auth
https://999-rosy.vercel.app/api/system/supabase-health
```

结果：

- 首页返回 200
- Demo 返回 200
- Auth 返回 200
- Supabase health 返回 `{"ok":true}`

## 12. 最近 Git 提交记录

```text
e48c9e0 Polish P0 lab report workflow experience
07d7d03 Redeploy with Vercel environment variables
f85e3a1 Handle missing production env on protected routes
04c07a1 Redeploy with Next.js framework preset
2eab6d7 Replace zip with Next.js project files
```

含义：

- `2eab6d7`：把 GitHub 仓库从 zip 替换成真实源码
- `04c07a1`：触发 Vercel 用 Next.js preset 重新部署
- `f85e3a1`：缺环境变量时保护任务页，避免 500
- `07d7d03`：Vercel 环境变量配置后触发部署
- `e48c9e0`：P0 产品体验精修，包括首页、Demo、任务工作台、错误提示、任务删除

## 13. 当前限制

1. Demo 是 Mock 数据，不是真实 AI。
2. 正式任务需要登录。
3. 正式任务依赖 Supabase 和 Moonshot 环境变量。
4. 如果 Moonshot API Key 错误、余额不足或网络失败，正式任务 AI 生成会失败，但页面会显示中文提示。
5. Vercel 上运行 Python 子进程可能受环境限制。如果 Python 不可用，页面会提示用户复制代码到本地运行，不会白屏。
6. 当前不是完整在线 IDE。
7. 当前没有多人协作。
8. 当前没有支付系统。
9. 当前没有复杂权限系统。
10. 当前没有完整 Codex 级项目代码编辑能力。
11. DOCX 导出已有基础能力，但不是复杂 Word 排版系统。
12. PDF/图片 OCR 目前不是完整能力，上传后主要保存材料，后续可扩展。

## 14. 下一步建议

建议优先级从高到低：

### P0.1 提升正式任务成功率

- 检查 Moonshot prompt 是否足够稳定
- 给 `generate-code` 增加更强的代码安全和可运行约束
- 给 `analyze` 增加失败后 Mock fallback 或模板 fallback
- 把 AI 返回格式异常时的重试机制做得更明显

### P0.2 改善线上 Python 运行

- 确认 Vercel 环境是否有 Python
- 如果 Vercel 不适合运行 Python，考虑：
  - 使用外部 Runner
  - 使用 Supabase Edge Function
  - 使用 Render/Fly.io/Cloudflare Worker 外接执行服务
  - 或者明确定位为“生成代码，本地运行”

### P0.3 让 Demo 更像真实产品

- Demo 允许用户编辑默认任务要求
- Demo 可以选择不同样例：
  - 冒泡排序
  - 数据结构实验
  - Web 前端实验
  - 数据库实验
- Demo 可以在本地状态中模拟历史任务

### P0.4 任务详情更完整

- 在详情页增加“运行历史”
- 展示每一次 AI 调用和运行记录
- 显示任务步骤耗时
- 支持查看上一次报告版本

### P0.5 报告导出增强

- 改善 DOCX 样式
- 支持章节目录
- 支持代码块样式
- 支持表格
- 支持用户上传模板映射

## 15. 交给下一个 ChatGPT 的重点提示

如果继续开发，请注意：

1. 不要把 `.env.local` 或任何 API key 写入代码或 GitHub。
2. 不要删除现有功能，除非明确要求。
3. 不要大规模重构数据库。
4. 不要引入大量新依赖。
5. 当前最重要的是演示闭环和真实体验稳定性。
6. Demo 保持稳定，不要让它依赖 AI 或登录。
7. 正式任务的 AI Key 必须只在服务端读取。
8. 用户体验上要强调“AI 执行步骤”，不要退化成普通聊天框。
9. 错误必须显示在页面上，不能只写 console。
10. 修改后必须运行：

```powershell
npm install
npm run lint
npm run build
```

必要时再运行：

```powershell
npm run dev -- -p 3103
```

然后检查：

```text
/
/demo
/auth
/tasks
/tasks/new
```

## 16. 当前项目一句话总结

当前网站已经从“能访问的 Next.js 项目”升级为“可演示的 P0 AI 实验报告工作流产品”：有清晰首页、有免登录 Demo、有登录保存历史、有任务工作台、有执行状态、有错误提示、有任务删除、有 Supabase/Vercel 线上部署闭环。
