# AGENTS.md

## Project

This repository is the **AI 实验报告自动化助手**. It is a student-facing AI workflow product for lab tasks:

1. Users enter or upload experiment requirements.
2. AI analyzes and structures the task.
3. AI generates experiment code.
4. The system runs and verifies code where possible.
5. The system creates a lab report draft.
6. Users can save history and export DOCX.

Product positioning must stay within learning assistance, code verification, report organization, and workflow automation.

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase Auth and database
- Moonshot AI API
- Vercel deployment
- DOCX export via server-side report utilities

## Pages That Must Not Be Broken

- `/` homepage
- `/demo` mock demo, must remain public and login-free
- `/auth` login page
- `/tasks` task history
- `/tasks/new` new task creation
- `/tasks/[id]` formal task workbench
- `/tasks/[id]/analysis` task analysis confirmation
- `GET /api/tasks/[id]/export-docx`

## Secret And Environment Safety

Never commit or expose:

- `.env.local`
- `node_modules`
- `.next`
- API keys or access tokens
- `MOONSHOT_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- Supabase JWTs or private credentials

Client-side code may only use public environment variables such as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Required Verification

After code changes, run:

```bash
npm run lint
npm run build
```

For UI or routing changes, also run the app locally and check the relevant pages:

```bash
npm run dev -- -p 3103
```

## Product Copy Rules

Do not use these phrases or similar claims:

- 代写作业
- 作弊
- 包过

Do not promise guaranteed grades, automatic school submission, or unverifiable results.

## Demo Rules

`/demo` must stay:

- Mock-based
- Login-free
- Stable without Moonshot or Supabase
- Safe for first-time users

Do not make Demo depend on real AI, real auth, real task history, or real Python execution.

## Formal Workbench Flow

The formal task workbench must emphasize and preserve this flow:

```text
analyze
→ generate-code
→ run-code
→ debug-code
→ generate-report
→ save-report
→ export-docx
```

The P1 Agent path is:

```text
需求理解
→ 任务规划
→ 代码生成
→ 运行验证
→ 报错修复一次
→ 再次运行
→ 报告生成
→ 结果沉淀
```

Never fake runtime output. If stdout exists, reports may cite stdout. If Python cannot run on the current environment, the UI and report must clearly say that real execution was not completed.

## gstack Skills In Codex

The recommended global location for gstack skills is:

```text
~/.codex/skills/
```

This project currently expects these gstack skills to be available globally after Codex restart:

- `/office-hours` → product discovery and problem framing
- `/plan-ceo-review` → founder/product strategy review
- `/plan-eng-review` → architecture, data flow, edge cases, and test plan review
- `/plan-design-review` → pre-implementation UI/UX plan review
- `/design-review` → post-implementation visual and UX review
- `/qa-only` → focused QA without implementation
- `/qa` → browser QA and regression testing
- `/investigate` → root-cause investigation before changing code
- `/review` → code review for bugs, regressions, and missing tests
- `/cso` → security review
- `/setup-deploy` → deployment setup review
- `/document-release` → release notes and user-facing change documentation

Use these skills by name when the user asks for them, for example `/qa`, `/review`, or `/cso`. If a skill is not loaded in the current Codex session, explain that Codex must be restarted after installation or fall back to the matching built-in workflow.

## Recommended gstack Flow For This Project

For new product or feature ideas:

```text
/office-hours
→ /plan-ceo-review
→ /plan-eng-review
→ /plan-design-review if UI is involved
→ implement
→ /review
→ /qa
→ /document-release
```

For bug fixes:

```text
/investigate
→ implement minimal fix
→ /review
→ /qa-only or /qa
```

For UI polish:

```text
/plan-design-review
→ implement
→ /design-review
→ /qa
```

For security-sensitive changes:

```text
/cso
→ implement
→ /review
→ /qa
```

For deployment changes:

```text
/setup-deploy
→ implement config changes
→ npm run lint
→ npm run build
→ /qa
→ /document-release
```

## Project-Specific Skill Guidance

Use `/office-hours` when the user is deciding what this product should become, such as adding a Docker Runner, uploads, richer task history, or a portfolio demo mode.

Use `/plan-ceo-review` when scope or product value is uncertain. Keep the product useful as a real learning assistant, not a generic chatbot.

Use `/plan-eng-review` before changing the task workflow, Supabase data shape, API contracts, file upload flow, code runner, DOCX export, or auth behavior.

Use `/plan-design-review` before changing `/`, `/demo`, `/tasks`, `/tasks/new`, or `/tasks/[id]`.

Use `/design-review` after UI changes. Check loading states, error states, mobile layout, copy clarity, and whether the workbench feels like an AI execution assistant.

Use `/investigate` before fixing production issues such as Vercel 404, Supabase auth failures, Python runner failures, AI JSON parse failures, or DOCX export errors.

Use `/review` after non-trivial code changes. Prioritize bugs, regressions, missing tests, security issues, and Vercel compatibility.

Use `/qa-only` when the user only wants verification and no code changes.

Use `/qa` after feature work, especially when routes, forms, auth, or task execution UI changed.

Use `/cso` for environment variables, Supabase RLS, service role usage, file upload security, code execution, and generated-code sandboxing.

Use `/setup-deploy` for Vercel project settings, root directory, build command, environment variables, output behavior, or GitHub deployment wiring.

Use `/document-release` after shipping meaningful changes to write a concise release note and update project documentation when useful.

## Current Known Limits

- P1 prioritizes Python lab reports.
- `debug-code` only auto-fixes once.
- Vercel may not be suitable for production-grade Python subprocess execution.
- Production-grade code execution should move toward a Docker Runner Worker on Render, Railway, VPS, or another isolated runtime.
- Generated reports are drafts and require user review.

