# AGENTS.md

## Project Overview

This repository is the **实验报告自动化助手** project.

It is a vertical AI Agent workflow system for student lab tasks. It is not a generic AI chat box. The product should help users turn a lab requirement into a verified code-and-report workflow.

The core workflow is:

```text
analyze -> plan -> generate-code -> run-code -> debug-once -> generate-report -> evaluate -> save-report -> export-docx
```

The intended loop:

1. Understand the experiment task.
2. Break the task into executable steps.
3. Generate runnable code.
4. Run code and capture real stdout/stderr.
5. If execution fails, attempt one automatic repair.
6. Run the repaired code again.
7. Generate the lab report from real execution evidence.
8. Save the report.
9. Export the report as DOCX.

## Product Positioning

The product must stay within:

- Learning assistance.
- Code verification.
- Lab report organization.
- Task workflow automation.

The product must not create, suggest, or encourage:

- 代写作业
- 作弊
- 包过
- Automatic submission to school systems.
- Fake screenshots.
- Fake runtime results.

Never claim that generated content is guaranteed to satisfy a school, teacher, or grading system. Generated reports are drafts and must remain reviewable by the user.

## Current Important Pages

Do not break these pages:

- `/` - Homepage and product positioning entry point.
- `/demo` - Login-free mock demo. Must remain stable and independent of Supabase, Moonshot, real task history, and real Python execution.
- `/auth` - Login and registration page backed by Supabase Auth.
- `/tasks` - Authenticated task history page.
- `/tasks/new` - Authenticated task creation and upload page.
- `/tasks/[id]` - Formal task workbench for code generation, execution, debugging, report editing, saving, and DOCX export.
- `/tasks/[id]/analysis` - Structured task analysis confirmation page. Users must confirm analysis before the formal workbench proceeds.

## Current Important APIs

Keep these route handlers stable:

- `/api/tasks` - Creates tasks and lists task records for the authenticated user.
- `/api/tasks/[id]` - Reads or deletes a specific task owned by the authenticated user.
- `/api/tasks/[id]/analyze` - Calls the task analysis flow and stores structured analysis.
- `/api/tasks/[id]/confirm-analysis` - Saves the user-confirmed analysis before code generation.
- `/api/tasks/[id]/generate-code` - Generates Python code for the confirmed task.
- `/api/tasks/[id]/run-code` - Runs submitted/generated code and stores real stdout/stderr, exit status, and runtime evidence.
- `/api/tasks/[id]/generate-report` - Generates the report draft from the confirmed task, generated code, and execution evidence.
- `/api/tasks/[id]/save-report` - Saves user-edited report markdown.
- `/api/tasks/[id]/export-docx` - Exports the saved report as DOCX and stores export metadata.

Additional or evolving APIs:

- `/api/tasks/[id]/debug-code` - Attempts one repair pass after a failed code run. It must not loop indefinitely.
- `/api/tasks/[id]/run-agent-workflow` - Current one-click Agent workflow entry. It corresponds to the future `/api/tasks/[id]/agent/run` concept.
- `/api/tasks/[id]/agent/run` - Future stable Agent workflow entry point for analyze/plan/code/run/debug/report/save.
- `/api/tasks/[id]/agent/trace` - Future endpoint for storing or reading Agent Trace data across the workflow.
- `/api/tasks/[id]/complete` - Legacy or convenience endpoint for completing the current task flow.
- `/api/tasks/[id]/consistency-check` - Legacy or future evaluator-style consistency check.
- `/api/upload` - Uploads task files and extracts text when possible.
- `/api/system/supabase-health` - Checks Supabase configuration and service availability.

## Non-Negotiable Safety Rules

1. Never commit `.env.local`.
2. Never expose API keys.
3. Never put `MOONSHOT_API_KEY` in frontend code.
4. Never put `SUPABASE_SERVICE_ROLE_KEY` in frontend code.
5. Never commit `node_modules`.
6. Never fake stdout or runtime results.
7. Never generate wording like `代写作业`, `作弊`, or `包过` in product copy or user-facing claims except when documenting banned phrases.
8. Demo must remain mock, stable, and login-free.
9. Do not break Supabase Auth or RLS assumptions.
10. Do not run unknown scripts from third-party skills without reviewing them first.

Also never commit:

- `.next`
- API keys or access tokens
- Supabase JWTs
- Vercel tokens
- GitHub tokens
- Private database URLs

Client-side code may only use public environment variables such as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## DOC/DOCX Original Format Preservation Rule

For uploaded DOC/DOCX task books, lab-report templates, or teacher-provided original documents:

`docs/agent-samples/014-sy2-sectioned-doc-preservation-workflow/` is the high-value regression sample for paragraph-marker teacher templates. It requires keeping all original document content intact, filling only `实验代码`, `实验结果与分析`, and `问题及思考`, and never inserting the words `系统填写` into the delivered DOC/DOCX.

1. Default behavior must treat every piece of original document content as immutable. This is not limited to cover pages or named sections such as `项目任务书`, `项目计划`, and `填表说明`; it applies to all teacher-provided text, tables, pictures, headers, footers, page breaks, styles, numbering, section order, and existing media.
2. Default behavior must not rebuild the whole document.
3. Default behavior must not rewrite the cover page.
4. Default behavior must not rewrite class, name, student ID, course name, or similar original information fields.
5. Default behavior must not rewrite teacher-provided task requirements or any other original source text.
6. Default behavior must not delete existing paragraphs, tables, images, headers, footers, page breaks, styles, numbering, or section order.
7. Only a clearly identified fillable answer area may receive system content. Even there, prefer appending under the existing prompt; replacing placeholder text is allowed only when the original document explicitly says that placeholder/instruction text should be removed for submission.

## File Role Recognition Rule

File role recognition must respect both the upload slot and the file's actual type:

1. Files uploaded through the task-book slot and supporting text extraction (`.doc`, `.docx`, `.txt`, `.md`) should be treated as `task_book` even when the filename is vague, such as `sy3.doc` or `888.docx`.
2. Generic parseable documents with no dataset/template/screenshot/source-code signals are task-book candidates by default, not references.
3. CSV/XLSX/XLS/JSON files are datasets and must not be parsed as task books, even if uploaded in the wrong slot.
4. Files uploaded through the template slot should become `report_template` when parseable.
5. Files uploaded through screenshot/code/data slots should keep the corresponding role.
6. Analysis UI should auto-select the only parseable non-dataset document as the task-book candidate, while still showing CSV/XLSX in the dataset area.
8. The system may only append generated content under a reliably identified task/question/requirement block or into the corresponding right-side answer cell.
9. Inserted content must be clearly labeled:
   - `【代码】`
   - `【运行结果】`
   - `【运行截图】`
   - `【结果分析】`
   - `【问题及思考】`
   - `【截图缺失】`
10. If no reliable insertion point is found, stop and return `无法安全定位任务填写位置，请用户确认插入位置。`
11. If the original format cannot be preserved safely, stop and return a Chinese error. Do not output a format-damaging DOCX.
12. `.docx` files may be patched only through the OOXML package while preserving existing package parts as much as possible.
13. `.doc` files are legacy binary Word files. They may be extracted for analysis, but original-format-preserving export requires a safe `.docx` baseline. If no safe conversion exists, ask for a standard `.docx` template.
14. Any DOC/DOCX export task must use these defaults:
   - `preserveOriginalDocument = true`
   - `insertionMode = append_under_task`
   - `rewriteWholeDocument = false`
15. Before returning a patched DOCX, verify that original text snippets across the beginning, middle, end, and known section labels remain present, and verify that fill labels such as `【代码】`, `【运行截图】`, and `【问题及思考】` remain present.
16. Preserving the original document means preserving teacher-provided content and structure; appended system content may naturally add pages. Do not optimize by deleting, overwriting, or consuming original content merely to keep the original page count.
17. If a template uses paragraph markers instead of tables, fill each marker independently. For example, append code under `实验代码`, insert real screenshots under `实验结果与分析`, and fill reflection under `问题及思考`, while keeping the marker text itself unchanged.

The legacy full-report DOCX generation mode may remain available only when it is explicitly marked as `generated_report_docx` / non-template-preserving. It must not be presented as preserving the teacher's original format.

### Strict DOC/DOCX Export Gate

When an uploaded teacher task book exists, DOCX export must not silently fall back to rebuilding a new report:

1. Standard `.docx` must use `patch_original_docx` and append content under a reliable task block.
2. Legacy `.doc` must first be safely converted to a `.docx` baseline before patching. If LibreOffice/soffice conversion is unavailable or fails, stop with a Chinese error asking the user to upload a standard `.docx`.
3. Non-standard `.docx` files that cannot be opened as OOXML zip packages must not be treated as successfully preserved.
4. `generated_report_docx` is allowed only when there is no original task book or the user explicitly selects a clearly labeled non-original-format export.
5. Generated content inserted into DOCX must default to Chinese unless the source task explicitly requires English.
6. A rebuilt DOCX must never be described as preserving the original cover, class/name/student ID fields, course fields, teacher requirements, layout, or formatting.

If a task book explicitly requires screenshots, the workflow must set `screenshotRequired = true`. If no real screenshot evidence is available, the workflow must set `screenshotMissing = true` and must not fake screenshots.

## Real Run Screenshot Workflow Rule

When source materials require screenshots, running screenshots, result images, UI screenshots, or similar evidence:

1. Detect the requirement from task text, document-ingestion output, or confirmed analysis.
2. Set `screenshotRequired = true`.
3. For Python/command-line tasks, generate a `command_output_screenshot` only from real `run-code` evidence: command, code hash/preview, stdout, stderr, exit code, runtime, and timestamp.
4. For frontend/browser tasks, future `browser_page_screenshot` evidence must come from a real rendered page state.
5. Store screenshot metadata with `isRealScreenshot = true` and `isAiGenerated = false`.
6. If no real screenshot is available, set `screenshotMissing = true`.
7. DOCX export must insert the real screenshot when available, or insert a clear `【截图缺失】` note when unavailable.
8. Never use AI-generated images, placeholder images, or invented stdout/stderr as screenshot evidence.
9. Screenshot generation failure must not erase real stdout/stderr. Keep the run result and show a warning.

## Lab DOCX Delivery Workflow

Any task that processes an uploaded lab task-book DOCX and produces a final DOCX deliverable must follow the project workflow documented in `docs/workflows/lab-docx-delivery-workflow.md` and the draft project skill in `.agents/skills/lab-docx-delivery-workflow/`.

Required defaults:

1. Use `lab-docx-delivery-workflow` before changing DOCX delivery behavior.
2. Default `preserve_original_docx = true`.
3. Default `rewrite_whole_document = false`.
4. Default `insertion_mode = append_under_task`.
5. Do not modify the cover page.
6. Do not modify teacher-provided task requirements.
7. Do not fake runtime output.
8. Do not fake screenshots.
9. If required screenshots are missing, mark `【截图缺失】`.
10. Before export, verify that original key text, cover content, task requirements, and fill labels are present.

If the workflow cannot safely preserve the original DOCX structure, stop and return a Chinese error instead of exporting a misleading or format-damaging document.

## Agent Workflow Foundation

Long-term Agent workflow work must preserve the current core chain:

```text
analyze -> plan -> generate-code -> run-code -> debug-once -> generate-report -> evaluate -> save-report -> export-docx
```

New workflow infrastructure should be added under clear boundaries:

- `src/lib/agent/workflow-types.ts` for workflow classification.
- `src/lib/agent/agent-trace.ts` for trace data shapes.
- `src/lib/agent/quality-evaluation.ts` for quality scoring data shapes.
- `src/lib/agent/workflow-orchestrator.ts` for orchestration skeletons before production execution.
- `src/lib/samples/*` for sample-library checks.
- `.agents/skills/*` for reusable project skills.

Do not connect a one-click workflow to production execution until auth, task ownership, trace recording, error handling, and rollback behavior are explicit.

## Browser Page Screenshot Rule

For frontend lab tasks that require webpage, interface, browser, or page-effect screenshots:

1. Use `browser_page_screenshot` evidence.
2. Evidence must come from real Playwright/browser rendering.
3. The screenshot browser must not reuse the user's Supabase login cookies.
4. The MVP must not run user-uploaded `npm install`, `npm run dev`, or arbitrary package scripts.
5. Browser screenshot metadata must use `type = "browser_page_screenshot"` and `source = "real_browser_render"`.
6. If a real browser PNG cannot be generated, mark `【截图缺失】`.
7. Do not use AI-generated images as browser screenshots.

## Sample Library Regression Rule

Standard samples under `docs/agent-samples/003-*` and later should include:

- `README.md`
- `sample.json`
- `sample-task.md`
- `input-files/`
- `expected-analysis.json`
- `expected-plan.json`
- `expected-code/`
- `expected-run-result.json`
- `expected-screenshots.json`
- `expected-report.md`
- `expected-docx-checklist.md`
- `verification-notes.md`

Run `npm run samples:check` after changing sample-library structure. The first checker is structural; future `samples:run` should replay real workflows.

## Development Commands

This project currently uses npm.

Install:

```bash
npm install
```

Development server:

```bash
npm run dev
```

The actual package script is:

```bash
next dev --webpack
```

Lint:

```bash
npm run lint
```

Build:

```bash
npm run build
```

Start production build:

```bash
npm run start
```

## Required Checks After Changes

After every code change, run:

```bash
npm run lint
npm run build
```

If the change affects page experience, routing, forms, auth, upload, task execution UI, or report export, also start the app:

```bash
npm run dev
```

Then manually check:

- `/`
- `/demo`
- `/auth`
- `/tasks`
- `/tasks/new`
- `/tasks/[id]`

When checking formal task pages, remember that authenticated routes require Supabase configuration and a valid user session.

## Architecture Direction

Frontend page layer:

- Owns user input, upload UI, workflow status display, code display, stdout/stderr display, report editing, copy actions, export actions, and quality score display.
- Should not own complex Agent orchestration.

API layer:

- Owns authentication, task reads/writes, AI calls, upload handling, report export, workflow entry points, and server-only secrets.
- Must enforce user ownership and preserve Supabase RLS assumptions.

Agent layer:

- Should gradually concentrate orchestration under `src/lib/agent` or a similar boundary.
- Owns sample matching, task analysis, plan generation, code generation, code execution decisions, one debug attempt, report generation, quality scoring, and Agent Trace creation.

Runner layer:

- Future production-grade execution should move toward an isolated runner such as Docker Worker, Render, Railway, VPS, or another sandboxed service.
- The runner should execute Python, capture stdout/stderr, generate real screenshots when needed, and package artifacts.
- Vercel can host the web app, but should not be treated as the long-term production sandbox for arbitrary code execution.

Data layer:

- Supabase Auth for users.
- Supabase Postgres for tasks, inputs, files, runs, outputs, and future traces.
- Supabase RLS for ownership boundaries.
- Supabase Storage for task files and exported DOCX artifacts.

## Sample Library Direction

The next product direction is a sample library. The goal is not direct fine-tuning at first. The goal is to accumulate reusable workflow knowledge:

- Golden samples.
- Failure cases.
- Agent traces.
- Workflow patterns.
- Evaluator rules.

Core terms:

- `sample` - One excellent task case, including input, expected workflow, code, output, report, and evaluation notes.
- `agent_trace` - One complete execution record from task intake through final report and evaluation.
- `workflow_pattern` - A standard execution routine for a class of lab tasks.
- `evaluator` - A quality checker that scores outputs against task requirements, runtime evidence, safety rules, and report completeness.

## Workflow Pattern Direction

Future `workflow_patterns` may include:

- `python_algorithm_lab`
- `python_file_io_lab`
- `python_oop_lab`
- `database_crud_lab`
- `frontend_basic_lab`

Each pattern should define expected task understanding, code shape, execution strategy, evidence requirements, report sections, common failure modes, and evaluator checks.

## Coding Style

- Prefer TypeScript.
- Keep changes scoped. Do not do large refactors unless the user explicitly asks and the risk is understood.
- Prefer existing components, route handlers, repository helpers, task contracts, and UI primitives over new abstractions.
- Error messages shown to users should be Chinese and understandable.
- Frontend Client Components should not contain private keys, service-role logic, or complex Agent orchestration.
- Server-only logic must stay in API routes, server utilities, or `src/lib` modules that are not imported by Client Components.
- Agent orchestration should gradually move into `src/lib/agent` or a clear equivalent boundary.
- Reuse `src/lib/tasks` for task context, status, repository access, and workflow persistence.
- Preserve existing Supabase Auth, Storage, and RLS assumptions.
- Do not silently invent runtime output. If execution is unavailable, say so explicitly in UI and reports.

## Skill Usage Policy

Mature GitHub-hosted or globally installed skills may be used to assist development, but their source and scripts must be reviewed first.

Project-specific skill selection, invocation examples, and future custom skill plans are documented in `docs/skills-usage.md`.

Preferred skill categories:

- Planning / architecture review skills.
- QA skills.
- Security review skills.
- Code review skills.
- Deployment review skills.
- Documentation release skills.

Recommended current gstack-style skills for this project:

- `/investigate` - Root-cause analysis before fixing production issues.
- `/plan-eng-review` - Architecture, data flow, edge cases, and test plan review.
- `/plan-ceo-review` - Product strategy and scope review.
- `/plan-design-review` - UI/UX plan review before page changes.
- `/review` - Code review for bugs, regressions, and missing tests.
- `/qa` or `/qa-only` - Browser QA and regression testing.
- `/cso` - Security review for keys, RLS, uploads, and execution boundaries.
- `/setup-deploy` - Vercel, Supabase, environment, and deployment setup review.
- `/document-release` - Release notes and documentation after meaningful changes.

Forbidden skill behavior:

- Do not run third-party scripts before reviewing them.
- Do not install large numbers of unrelated skills.
- Do not let a skill modify secrets, deployment credentials, account settings, or tokens.
- Do not write GitHub tokens, Vercel tokens, Supabase keys, Moonshot keys, or service-role keys into the repository.

## When Unsure

If a request is unclear or risky, Codex should first output:

1. Current understanding.
2. Risk points.
3. Recommended approach.
4. Questions that require user confirmation.

Do not make broad or irreversible changes when the task is ambiguous. Prefer a small, reversible change with clear verification.

## Current Known Limits

- P1 prioritizes Python lab reports.
- `debug-code` only attempts one automatic repair.
- DOCX export exists, but generated report quality still depends on task parsing and runtime evidence.
- Some uploaded file types may be stored without OCR.
- Formal task flows require Supabase and Moonshot environment variables.
- Generated reports are drafts and require user review.
## Canonical Project Record

`docs/website-change-log.md` is the canonical website change log and configuration record. The root `WEBSITE_CHANGE_LOG.md` is only a convenience copy for quick viewing. Future Codex sessions should read and update `docs/website-change-log.md` first, then sync the root copy if needed.
