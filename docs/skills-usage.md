# Codex Skills Usage

本文档记录“实验报告自动化助手”项目适合使用的 Codex Skills、筛选结论、调用顺序和安全边界。它补充 `AGENTS.md`：`AGENTS.md` 说明项目规则，本文档说明什么时候使用哪些 skill。

## File Role Recognition Workflow

- Respect the upload slot: a parseable file uploaded through the task-book slot should be treated as `task_book`, even when the filename is vague, such as `sy3.doc`.
- Keep datasets separate: `.csv`, `.xlsx`, `.xls`, and `.json` remain `dataset` and must not be parsed as task books.
- Generic parseable documents (`.doc`, `.docx`, `.txt`, `.md`) with no template/data/screenshot/source-code signal are task-book candidates by default.
- If the analysis page has exactly one parseable non-dataset document, auto-select it as the task-book candidate.
- If users upload a task book plus CSV dataset, parse the document as task requirements and inject the CSV only into analysis/code/run/report context.

## Skill Directory Conclusion

当前本机可识别的 skill 来源包括：

- 用户级：`C:\Users\87808\.codex\skills`
- 系统级：`C:\Users\87808\.codex\skills\.system`
- 插件缓存级：`C:\Users\87808\.codex\plugins\cache\...`

官方 `skill-installer` 的推荐安装位置是 `$CODEX_HOME/skills`，通常等价于用户级 `~/.codex/skills`。安装或新增 skill 后，通常需要重启 Codex 才能稳定识别。

本仓库现在新增了项目级草案：

- `.agents/skills/lab-docx-delivery-workflow/`

说明：

- 这是项目级自定义 skill 草案，不是全局安装。
- 当前会话的可用 skills 列表不会自动热加载新建目录。
- 是否自动识别 `.agents/skills/` 取决于当前 Codex 版本和启动扫描行为。
- 稳妥用法是显式要求 Codex 阅读 `.agents/skills/lab-docx-delivery-workflow/SKILL.md`，或在重启 Codex 后确认它是否出现在 skills 列表中。

## Sources Reviewed

- [openai/skills](https://github.com/openai/skills)
- [OpenAI Using skills](https://openai.com/academy/skills/)
- [OpenAI skill-creator](https://github.com/openai/skills/blob/main/skills/.system/skill-creator/SKILL.md)
- [OpenAI playwright-interactive](https://github.com/openai/skills/blob/main/skills/.curated/playwright-interactive/SKILL.md)
- [garrytan/gstack](https://github.com/garrytan/gstack)
- [troykelly/codex-skills](https://github.com/troykelly/codex-skills)
- [proflead/codex-skills-library](https://github.com/proflead/codex-skills-library)
- [anthropics/skills docx](https://github.com/anthropics/skills/blob/main/skills/docx/SKILL.md)
- [ComposioHQ/awesome-codex-skills](https://github.com/ComposioHQ/awesome-codex-skills)
- [VoltAgent/awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills)
- [heilcheng/awesome-agent-skills](https://github.com/heilcheng/awesome-agent-skills)
- [alirezarezvani/claude-skills](https://github.com/alirezarezvani/claude-skills)
- [microsoft/playwright-cli skill](https://github.com/microsoft/playwright-cli/blob/main/skills/playwright-cli/SKILL.md)

## Candidate Skill Evaluation

| Skill / Repo | 来源 | 类型 | 解决什么问题 | 对本项目价值 | 风险 | 是否建议安装 | 是否建议只参考 | 备注 |
|---|---|---|---|---|---|---|---|---|
| `openai/skills` | OpenAI GitHub | 官方技能目录 | SKILL.md 结构、references/scripts/assets 组织方式 | 高 | 需要逐个审查具体 skill | 按需安装官方可信 skill | 是 | 作为自定义 skill 写法基准 |
| `skill-creator` | OpenAI 系统 skill | skill 创建指南 | 指导项目自定义 skill 草案 | 高 | 过早固化错误流程 | 已内置 | 是 | 本次已按其结构创建草案 |
| `playwright-interactive` | OpenAI curated | 浏览器交互 | 本地页面 QA、登录态检查、端到端验收 | 中高 | 需要浏览器会话清理；可能接触 cookies | 暂缓 | 是 | 本项目已有浏览器/Playwright 能力时再显式使用 |
| `garrytan/gstack` | GitHub 社区 | 工程流程包 | plan/review/qa/security/docs 多类审查 | 很高 | 第三方来源；不能盲目运行脚本 | 已有本机同类 skills，按需使用 | 是 | 优先用已安装的 plan-eng-review、qa-only、cso、document-release |
| `plan-eng-review` | gstack 风格本机 skill | 架构审查 | 审查 Agent workflow、API、数据流、Runner、DOCX patch 风险 | 很高 | 只审查计划，不替代真实测试 | 适合现在使用 | 否 | 每次大流程调整前用 |
| `qa-only` | gstack 风格本机 skill | 只报告 QA | 验收 /auth、/tasks、上传、parse-document、导出流程 | 很高 | 需要 dev server 和测试账号状态 | 适合现在使用 | 否 | 先报告，不乱改 |
| `cso` / security review | gstack 风格本机 skill | 安全审查 | Supabase RLS、service role、上传文件、run-code、截图证据 | 很高 | 输出可能很大，需要限定范围 | 适合现在使用 | 否 | 上线前必用 |
| `document-release` | gstack 风格本机 skill | 文档收尾 | 同步 README、进度文档、workflow 文档 | 高 | 可能误写敏感信息，需审查 | 适合现在使用 | 否 | 功能完成后用 |
| `review` | gstack 风格本机 skill | 代码审查 | 检查 diff 中的 bug、回归、测试缺口 | 高 | 依赖 diff 质量 | 适合按需使用 | 否 | 业务代码改动后用 |
| `investigate` | gstack 风格本机 skill | 调试定位 | 处理 Kimi JSON、Supabase 登录态、DOCX patch 失败 | 高 | 可能带来较多探索输出 | 适合按需使用 | 否 | 报错时先定位再改 |
| `freeze` / `guard` | gstack 目标方向 | 改动范围限制 | 限制 Codex 不乱改封面、任务要求、页面、schema | 高 | 本机未确认存在同名可用 skill | 暂不安装 | 是 | 先用 AGENTS.md 和项目 skill 固化规则 |
| `troykelly/codex-skills` | GitHub 社区 | issue-driven / autonomous workflow | issue 驱动开发、hook、MCP、自动化循环 | 中 | README 包含 install 脚本、MCP、GitHub token 相关配置 | 暂缓 | 是 | 不适合当前“先本地稳定、不推送”阶段 |
| `proflead/codex-skills-library` | GitHub 社区 | 技能库 | debugging/testing/documentation/system design 方向参考 | 中 | 需逐个确认 SKILL.md 与脚本 | 暂缓 | 是 | 只作为检索入口 |
| `anthropics/skills docx` | Anthropic GitHub | DOCX 文档处理 | DOCX 读写、OOXML、tracked changes、formatting preservation 经验 | 很高 | 面向 Claude；脚本和依赖需单独审查 | 不直接安装 | 是 | 对原格式保护规则最有参考价值 |
| Composio 文档/skills 索引 | Composio / 社区 | skills catalog | 找到更多 docx、QA、workflow skill | 中 | 目录质量不一，可能引导运行安装脚本 | 暂不安装 | 是 | 只用作发现入口 |
| `ComposioHQ/awesome-codex-skills` | GitHub 社区 | Codex skills 索引 | 查找官方/社区 skills | 中 | 索引不等于质量保证 | 暂不安装 | 是 | 只筛选，不批量安装 |
| `VoltAgent/awesome-agent-skills` | GitHub 社区 | 大型 agent skills 索引 | 发现测试、文档、浏览器、Agent 方向技能 | 中 | 1000+ 技能，容易污染上下文 | 暂不安装 | 是 | 只作为搜索入口 |
| `heilcheng/awesome-agent-skills` | GitHub 社区 | 教程/目录 | 了解 skill 生态和目录规范 | 低中 | 泛化较强 | 不安装 | 是 | 参考即可 |
| `alirezarezvani/claude-skills` | GitHub 社区 | Claude skills 集合 | 可能有文档、QA、开发流程启发 | 中 | 非 Codex 原生，需要转译审查 | 不安装 | 是 | 只参考高质量单项 |
| `microsoft/playwright-cli` skill | Microsoft GitHub | 浏览器自动化 | 上传、登录、页面截图、前端实验截图 | 中高 | 会启动浏览器和脚本；需要明确测试目标 | 暂缓 | 是 | 等端到端 QA 自动化阶段再接 |
| Browserbase/browser automation skills | 社区/厂商 | 浏览器自动化 | 远程浏览器 QA、截图 | 中 | 可能涉及 cookies、远程上下文、账号态 | 不建议当前使用 | 是 | 本地优先阶段不需要 |
| 大型全栈自动化 skill pack | 社区 | 一键实现/部署 | 看似省事 | 低 | 可能安装依赖、改 schema、访问 token、部署 | 不建议 | 否 | 与当前安全策略冲突 |

## Recommended Skills for Lab DOCX Delivery

推荐使用顺序：

```text
plan-eng-review
↓
lab-docx-delivery-workflow
↓
qa-only
↓
cso
↓
document-release
```

### 第一批：现在适合用

- `plan-eng-review`：审查 DOCX 交付链路、数据流、失败处理、插入点定位和验收方案。
- `lab-docx-delivery-workflow`：项目级草案，约束原 DOCX 保留、真实运行、真实截图和导出验收。
- `qa-only`：只报告端到端流程问题，不主动乱改代码。
- `cso`：检查密钥、RLS、文件上传、run-code、截图证据链和导出文件安全。
- `document-release`：功能完成后同步文档、进度和限制。
- `review`：业务代码改动后做 diff 审查。
- `investigate`：遇到文档解析、登录态、Moonshot JSON、DOCX patch 报错时定位根因。
- DOCX formatting preservation 参考资料：重点参考 `anthropics/skills docx`，但不直接运行未知脚本。

### 第二批：暂缓

- Playwright/browser automation：适合后续做自动化 E2E、页面截图和前端实验截图，但当前先保持本地手动验收优先。
- Full automated deployment：当前明确不 push、不部署。
- Issue-driven/TDD 大型流程：适合团队化后再接，现在会增加流程复杂度。
- 大型 skill pack：只筛选单项，不批量安装。

### 第三批：不建议

- 来源不明、没有清晰 `SKILL.md` 的 skill。
- 要求执行未知安装脚本的 skill。
- 会访问 cookies、token、浏览器登录态但不透明的 skill。
- 会修改密钥、部署凭证、Supabase schema 或账号设置的 skill。
- 与 Next.js / Supabase / Moonshot / DOCX 交付链路无关的泛化 skill。

## Explicit Invocation

可以这样显式调用：

```text
用 plan-eng-review 审查 lab-docx-delivery-workflow 的架构和数据流。
用 .agents/skills/lab-docx-delivery-workflow/SKILL.md 约束这次 DOCX 交付。
用 qa-only 对 /auth、/tasks、/tasks/new、/tasks/[id]/analysis、/tasks/[id] 做只报告验收。
用 cso 检查 Supabase RLS、API key、上传文件、run-code 和截图证据链安全。
用 document-release 在功能完成后更新 README、workflow 文档和变更记录。
```

## Safety Notes

- 不提交 `.env.local`。
- 不提交真实 API key、GitHub token、Vercel token、Supabase service role key。
- 不把 `MOONSHOT_API_KEY` 或 `SUPABASE_SERVICE_ROLE_KEY` 放入前端代码。
- 不运行未审查的第三方 scripts。
- 不让 skill 修改账号、密钥、部署凭证、Supabase 项目权限或 schema。
- Demo 页面必须保持 mock、稳定、免登录。
- 报告生成和截图生成必须基于真实运行证据。
- 如果任务书要求截图但没有真实截图，只能标记 `screenshotMissing = true` 和 `【截图缺失】`。

## Future Custom Skills

### `lab-report-sample-analyzer`

用途：分析 Codex 完成实验任务的优秀样本，提取 `agent_trace`、automation map、`workflow_pattern` 和失败恢复点。

创建前提：

- 已收集 5 个优秀样本。
- 已手工跑通样本分析模板。
- 已明确样本字段和隐私处理规则。

### `lab-report-workflow-miner`

用途：从多个样本中提炼共性 `workflow_patterns`，例如 `python_algorithm_lab`、`python_file_io_lab`、`python_oop_lab`、`database_crud_lab`、`frontend_basic_lab`。

创建前提：

- `lab-report-sample-analyzer` 输出稳定。
- 至少有 2-3 类不同实验任务样本。
- 已确定 pattern schema。

### `lab-report-evaluator`

用途：根据任务要求、代码、stdout、stderr、报告内容和安全规则，对 Agent 输出做 0-100 分质量评分。

创建前提：

- 已有 `agent_trace` schema。
- 已有 evaluator rubric 初稿。
- 已能区分代码正确性、运行证据、报告完整性、格式质量和安全合规。

## Next Recommended Skill

下一步要审查“样本库 + workflow_patterns”方案时，建议先用：

```text
plan-ceo-review
```

先确认样本库是否真正服务产品目标、是否过早复杂化。通过后再用：

```text
plan-eng-review
```

审查 `sample`、`agent_trace`、`workflow_pattern`、`evaluator` 的数据结构和落地路径。

## Browser Page Screenshot Skills

本次真实网页效果截图 workflow 参考和启用的能力：

| Skill / Repo | 用途 | 当前状态 | 风险控制 |
|---|---|---|---|
| OpenAI `playwright-interactive` | 真实浏览器渲染、截图、视觉 QA 方法 | 本机已安装，作为实现参考 | 不复用用户 cookies，不把密钥带进截图浏览器 |
| `playwright` npm package | 服务端本地 Chromium 截图 Runner | 已加入项目依赖 | 只运行本地静态预览，不执行用户 npm scripts |
| Microsoft `playwright-cli` | 可重复浏览器截图/QA 的参考工具 | 只参考，未安装额外 skill | 不运行未知脚本 |
| Vercel `agent-browser` | 浏览器自动化和 QA skill 参考 | 只参考，未安装额外 skill | 不接入远程账号或 token |
| `qa-only` | 后续验收页面和截图链路 | 本机可用 | 只报告问题，不自动大改 |
| `cso` | 检查截图 Runner、Storage、cookies、密钥边界 | 本机可用 | 关注 service role 仅服务端使用 |

本项目现在新增专属系统能力样本：

```text
docs/agent-samples/003-browser-page-screenshot-workflow/
```

推荐后续调用顺序：

```text
plan-eng-review
-> playwright-interactive / browser
-> qa-only
-> cso
-> document-release
```

当前明确不做：

- 不运行用户上传的 `package.json` scripts。
- 不自动执行 `npm install` / `npm run dev`。
- 不把 Supabase 登录 cookies 注入截图浏览器。
- 不开放外部网络资源请求。
- 不把 AI 生成图片标记为真实网页效果截图。

## Roadmap And Workflow Foundation Skills

Project-level skill drafts added for the long-term Lab Report Assistant workflow:

- `.agents/skills/browser-page-screenshot-workflow/SKILL.md`
- `.agents/skills/sample-library-regression-workflow/SKILL.md`
- `.agents/skills/report-quality-evaluation-workflow/SKILL.md`
- `.agents/skills/task-runner-boundary-workflow/SKILL.md`
- `.agents/skills/supabase-storage-metadata-workflow/SKILL.md`
- `.agents/skills/multi-agent-lab-delivery-workflow/SKILL.md`

Recommended sequence for future major work:

```text
plan-eng-review
-> multi-agent-lab-delivery-workflow
-> task-runner-boundary-workflow
-> browser-page-screenshot-workflow or sample-library-regression-workflow
-> qa-only
-> cso
-> document-release
```

Current install status:

- These are repository-level skill drafts, not global installations.
- Current Codex sessions may need explicit file reading or a restart before they appear in the automatic skill list.
- No third-party install scripts were run for these project skills.

External references reviewed for this foundation:

- OpenAI skills repository and `playwright-interactive` skill.
- Playwright screenshot documentation.
- GitHub Actions workflow syntax and permissions documentation.

Use external skills only after reading their `SKILL.md` and any scripts they require. Do not run skills that request cookies, tokens, deployment credentials, or unreviewed remote scripts.

## DOC/DOCX Preservation Skill Rules

Use the project DOCX preservation workflow whenever a task involves a teacher-provided DOC/DOCX task book or lab template.

- Universal default: every original document element is immutable unless it is a clearly identified fillable answer area. This rule protects all original text and layout, not only named examples such as `项目任务书`, `项目计划`, or `填表说明`.
- Standard `.docx`: use `patch_original_docx`; preserve the OOXML package and mainly patch `word/document.xml`, relationships, media, and content types when inserting images.
- Legacy `.doc`: extract text for analysis, then try safe LibreOffice/soffice conversion to a `.docx` baseline before original-format export. If conversion is unavailable or fails, stop and ask the user to upload a standard `.docx`; do not generate a fake original-format DOCX.
- Non-standard `.docx`: if it cannot be opened as an OOXML zip, stop original-format export and ask for a standard `.docx`.
- `generated_report_docx` must not be a silent fallback when an original task book exists. It is allowed only with no original task book, explicit user selection, or clearly marked test mode.
- Never modify cover pages, class/name/student ID/course fields, teacher requirements, project plans, fill instructions, existing tables, headers, footers, numbering, media, styles, page breaks, or any other source content.
- Only append under a reliable task/question/requirement block or into the corresponding fillable answer cell. Replacing placeholder/instruction text is allowed only when the source document explicitly says that placeholder text should be removed for submission.
- Required inserted labels are `【代码】`, `【运行结果】`, `【运行截图】`, `【结果分析】`, `【问题及思考】`, and `【截图缺失】`. Do not put the words `系统填写` into delivered DOC/DOCX content.
- If screenshots are required, insert real `command_output_screenshot` or `browser_page_screenshot` PNG evidence. If none exists, insert `【截图缺失】`.
- If the insertion point or preservation validation is unsafe, return a Chinese error instead of exporting a misleading document.
- Preservation validation must sample original snippets across the beginning, middle, end, and known section labels, not only the cover page or first task requirement.
- All inserted report text, screenshot captions, run descriptions, and fallback messages must default to Chinese unless the assignment explicitly asks for English.

## Product Workflow Closure Update

Current P0 workflow status:

- `sample-library-regression-workflow`: use before changing `docs/agent-samples` or `src/lib/samples`; 002 and 003 now have local fixture replay.
- `report-quality-evaluation-workflow`: use before changing report generation or DOCX export; `evaluateTaskOutput()` is now part of the DOCX export quality gate.
- `task-runner-boundary-workflow`: use before changing Python/browser execution; local runners remain development-only and production should move to a worker.
- `multi-agent-lab-delivery-workflow`: use for large changes touching orchestrator, sample replay, security, DOCX, and UI.

## Canonical Change Log

Use `docs/website-change-log.md` as the canonical website change log and configuration record.

The root `WEBSITE_CHANGE_LOG.md` is a convenience mirror for quick access from the project root. If the two files ever drift, update `docs/website-change-log.md` first and then sync the root mirror.

## UI/UX Optimization Skills

Use these skills or review methods before changing website presentation:

- `plan-design-review`: run before UI implementation to define scope, user goals, and no-touch business boundaries.
- `design-review`: use to check visual hierarchy, spacing, status clarity, error states, trust signals, and whether the UI feels like a real workflow product instead of a demo.
- `web-design-guidelines`: if available, use as Web UI/accessibility guidance. If not available locally, do not install unknown third-party skills just for polish.
- `qa-only`: use after UI changes for browser verification. It should report navigation, layout, console, and network issues without changing workflow logic.
- `review`: use after edits to confirm UI changes did not alter API contracts, Supabase access, screenshot evidence, sample regression, or DOCX export behavior.

UI optimization must stay presentation-only unless the user explicitly requests a workflow change. It must not modify Supabase schema, API response semantics, document-ingestion, screenshot metadata, quality evaluation, sample replay, or template-preserving DOCX patch behavior.
