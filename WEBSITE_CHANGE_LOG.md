# Website Change Log and Configuration

Last updated: 2026-05-24

This document is the long-term record for the Lab Report Assistant website. Update it whenever the website code, configuration, workflow, API behavior, environment requirements, or local/deployment process changes.

### 2026-05-24 - GitHub Main Push and Vercel Production Verification

Changed files:
- `docs/website-change-log.md`
- `WEBSITE_CHANGE_LOG.md`

What changed:
- Pushed release commit `b9f748c` to `origin/main`.
- Confirmed public GitHub Actions regression completed successfully for `main`.
- Confirmed the existing Vercel Git Integration deployed the pushed `main` branch to the production site.
- Verified the production homepage, auth page, and Supabase health endpoint respond successfully.

Why:
- The project moved from local release preparation into actual GitHub and Vercel publication while preserving local backup and secret boundaries.

Configuration impact:
- No new environment variables.
- No new npm dependencies.
- Vercel uses its existing configured environment variables.

Data/schema impact:
- No Supabase schema change.
- No Storage bucket change.

Verification:
- GitHub push: `main -> origin/main`, release commit `b9f748c`.
- GitHub Actions regression: success.
- `https://999-rosy.vercel.app/`: 200 OK.
- `https://999-rosy.vercel.app/auth`: 200 OK.
- `https://999-rosy.vercel.app/api/system/supabase-health`: 200 OK, `{"ok":true}`.

Security notes:
- `.env.local` was not committed.
- Real DOC/DOCX local-only fixtures were not committed.
- Vercel deployment package excludes local artifacts through `.vercelignore`.

### 2026-05-24 - GitHub and Vercel Release Preparation With Local Backup

Changed files:
- `README.md`
- `.gitignore`
- `.gitattributes`
- `.vercelignore`
- `.env.example`
- `.github/workflows/regression.yml`
- `docs/deployment/github-vercel-release-checklist.md`
- `docs/deployment/local-backup-and-restore.md`
- `docs/website-change-log.md`
- `WEBSITE_CHANGE_LOG.md`

What changed:
- Rewrote the mojibake README into readable UTF-8 Chinese release documentation.
- Added Vercel ignore rules so local artifacts, sample binaries, root task documents, and progress files are not uploaded to Vercel.
- Added GitHub ignore rules for root-level user Office/PDF files and local temp logs.
- Added binary attributes for Office/PDF/image/archive fixtures.
- Updated GitHub Actions regression to run lint, build, sample structural check, and privacy-safe local-fixture replay without requiring production secrets.
- Kept real DOC/DOCX preservation fixtures local-only so personal/template Office documents are not pushed to the public repository.
- Added release and local backup/restore documentation.
- Created a local backup outside the repository before release-prep edits.

Why:
- The project is ready to move from local development toward GitHub and Vercel, but needs clear secret boundaries, backup instructions, CI checks, and production runner caveats.

Configuration impact:
- No new environment variables.
- No new npm dependencies.
- Vercel must configure the variables listed in `.env.example`.

Data/schema impact:
- No Supabase schema change.
- No Storage bucket change.

Verification:
- `git diff --check`: pass, only Windows CRLF normalization warnings.
- tracked secret pattern scan: pass.
- `npm audit --audit-level=high`: pass for high severity; 2 moderate advisories remain in transitive dependencies (`brace-expansion`, `ws`).
- `npm run samples:check`: pass.
- `npm run samples:run -- --mode=local-fixture --all`: pass locally, with `008-docx-template-edge-cases` still partial by design. Public CI uses a privacy-safe subset that excludes local-only Office fixtures.
- `npm run lint`: pass.
- `npm run build`: pass.
- local release backup: created outside the repository.

Security notes:
- `.env.local` remains gitignored.
- `.vercel/` remains gitignored.
- No GitHub push.
- No Vercel deployment.

### 2026-05-24 - sy5 Code Block Formatting and DOCX Paragraph Detection Hardening

Changed files:
- `src/lib/reports/template-preserving-docx.ts`
- `src/lib/reports/task-block-detector.ts`
- `src/lib/samples/sample-regression.ts`
- `docs/agent-samples/017-sy5-code-block-formatting-workflow/*`
- `docs/agent-samples/README.md`
- `docs/agent-samples/sample-regression-plan.md`

What changed:
- Inserted DOCX code blocks as line-oriented paragraphs using a monospace run style instead of compacting the whole source into one paragraph.
- Hardened DOCX paragraph/table/text extraction regexes so `w:pPr`, `w:tcPr`, and `w:tab` child nodes are not mistaken for paragraphs, cells, or text nodes.
- Ran `sy5.doc` through the real website flow and exported `sy5_website_full_flow_export.docx`.
- Added sample `017-sy5-code-block-formatting-workflow` with the accepted website-generated DOCX artifact and replay checks for original snippets, screenshot media, no `系统填写`, and copyable code formatting.

Why:
- Real review of the generated sy5 DOCX showed code could become visually messy if Word received compacted source text. The workflow now keeps code readable even if it consumes more pages.

Configuration impact:
- No new environment variables.
- No new npm dependencies.

Data/schema impact:
- No Supabase schema change.
- Existing `task-files`, screenshot metadata, and `patch_original_docx` behavior remain unchanged.

Verification:
- `npm run samples:check`: pass
- `npm run samples:run -- --mode=local-fixture 014-sy2-sectioned-doc-preservation-workflow`: pass
- `npm run samples:run -- --mode=local-fixture 015-sy3-huffman-doc-rerun-screenshot-dedup`: pass
- `npm run samples:run -- --mode=local-fixture 016-sy4-bracket-doc-caption-specificity`: pass
- `npm run samples:run -- --mode=local-fixture 017-sy5-code-block-formatting-workflow`: pass
- `npm run samples:run -- --mode=local-fixture --all`: pass, with 008 remaining partial by design
- `npm run lint`: pass
- `npm run build`: pass
- Browser website flow for `sy5.doc`: exported DOCX saved to Desktop
- LibreOffice PDF render inspection: pass for code layout and screenshot page

Security notes:
- No secrets committed.
- `.env.local` not printed.
- No GitHub push.
- No Vercel deployment.

### 2026-05-24 - Workbench Density Polish and sy3/sy4 Replay Enablement

Changed files:
- `app/tasks/[id]/workbench.tsx`
- `src/lib/samples/sample-regression.ts`
- `docs/agent-samples/015-sy3-huffman-doc-rerun-screenshot-dedup/*`
- `docs/agent-samples/016-sy4-bracket-doc-caption-specificity/*`
- `docs/agent-samples/README.md`
- `docs/agent-samples/sample-regression-plan.md`
- `docs/ui-polish-report.md`

What changed:
- Changed the Workbench Trace console from dense always-open cards into compact expandable rows that show status, evidence count, and summary first.
- Moved the long report editor into an expandable section so the Workbench keeps its execution and evidence hierarchy visible.
- Added local DOCX replay checks for sample 015 and sample 016.
- Stored accepted sy3/sy4 DOCX artifacts under each sample's `expected-docx/` directory.
- The sy3 replay rejects stale `系统填写`, double-stack, expression-evaluation, and empty-stack wording, and requires exactly one latest run screenshot.
- The sy4 replay rejects unrelated Huffman/expression wording and requires the bracket-specific screenshot caption.

Why:
- The previous UI pass left deep Workbench details too dense, and 015/016 were high-value preservation samples but were still skipped in direct replay.

Configuration impact:
- No new environment variables.
- No new npm dependencies.

Data/schema impact:
- No Supabase schema change.
- No API contract change.
- Existing `task-files`, screenshot metadata, and `patch_original_docx` behavior remain unchanged.

Verification:
- `npm run samples:check`: pass
- `npm run samples:run -- --mode=local-fixture 014-sy2-sectioned-doc-preservation-workflow`: pass
- `npm run samples:run -- --mode=local-fixture 015-sy3-huffman-doc-rerun-screenshot-dedup`: pass
- `npm run samples:run -- --mode=local-fixture 016-sy4-bracket-doc-caption-specificity`: pass
- `npm run samples:run -- --mode=local-fixture --all`: pass, with 008 remaining partial by design
- `npm run lint`: pass
- `npm run build`: pass
- Browser smoke QA: pass on desktop and 390px viewport

Security notes:
- No secrets committed.
- `.env.local` not printed.
- No GitHub push.
- No Vercel deployment.

### 2026-05-24 - UI/UX Polish for Lab Delivery Workflow

Changed files:
- `app/page.tsx`
- `app/auth/page.tsx`
- `app/tasks/page.tsx`
- `app/tasks/task-list-actions.tsx`
- `app/tasks/sign-out-button.tsx`
- `app/tasks/new/new-task-form.tsx`
- `app/tasks/[id]/analysis/page.tsx`
- `app/tasks/[id]/page.tsx`
- `app/tasks/[id]/task-detail-actions.tsx`
- `app/tasks/[id]/workbench.tsx`
- `app/globals.css`
- `src/components/ui/*`
- `src/components/task/execution-status-panel.tsx`
- `docs/ui-polish-report.md`
- `docs/skills-usage.md`

What changed:
- Updated homepage, auth, task center, new-task, analysis, and workbench presentation to reflect the current product state.
- Clarified the real workflow: upload materials, identify file roles, parse task book, run Agent workflow, collect real evidence, inspect Trace/quality, and export template-preserving DOCX.
- Cleaned product copy around task-book versus dataset handling and DOCX original-template preservation.
- Simplified the global visual style into a quieter SaaS workspace with consistent status colors.
- Added a UI polish report and UI/UX skill usage notes.

Why:
- The website now has mature delivery capabilities, but parts of the UI still read like an early demo. The interface should help users understand and trust the real lab delivery workflow without changing business behavior.

Configuration impact:
- No new environment variables.
- No new npm dependencies.

Data/schema impact:
- No Supabase schema change.
- No API contract change.
- Existing `task-files`, screenshot metadata, sample replay, and `patch_original_docx` behavior remain unchanged.

Verification:
- `npm run lint`: pass during implementation
- Full sample/build/browser verification recorded in `docs/ui-polish-report.md`

Security notes:
- No secrets committed.
- `.env.local` not printed.
- No GitHub push.
- No Vercel deployment.

### 2026-05-24 - sy4 Bracket Matching Website E2E and Caption Specificity Fix

Changed files:
- `src/lib/reports/template-preserving-docx.ts`
- `docs/agent-samples/016-sy4-bracket-doc-caption-specificity/*`
- `docs/agent-samples/README.md`
- `docs/website-change-log.md`
- `WEBSITE_CHANGE_LOG.md`

What changed:
- Ran `sy4.doc` through the website full flow without manually providing task content.
- Confirmed the task book was recognized as a parseable task book and the agent workflow generated code, ran code, produced stdout/stderr/exitCode/runtime, and created one real `command_output_screenshot`.
- Exported the final document through the website as `patch_original_docx`.
- Added a bracket-matching-specific caption and reflection branch before the generic `stack` branch so bracket matching no longer receives expression-evaluation wording.
- Added sample `016-sy4-bracket-doc-caption-specificity` to preserve the lesson.

Why:
- The first sy4 export preserved the teacher template and inserted the real screenshot, but the screenshot caption was too generic because `stack` matched before the more specific bracket-matching context.

Configuration impact:
- No new environment variables.
- No new npm dependencies.

Data/schema impact:
- No Supabase schema change.
- Existing `task-files` and `task_outputs.report_json.screenshots` remain unchanged.

Verification:
- Website task: `bdc513e7-cbf4-43e9-ad98-e34f3b2dcf9b`
- Final export: `C:\Users\87808\Desktop\sy4_website_full_flow_export.docx`
- Export mode: `patch_original_docx`
- Real screenshot inserted: pass
- Original key snippets preserved: pass
- Final DOCX does not contain `系统填写`: pass
- Final DOCX does not contain unrelated Huffman or expression-evaluation captions: pass
- `npm run samples:check`: pass
- `npm run lint`: pass
- `npm run build`: pass

Security notes:
- No secrets committed.
- `.env.local` not printed.
- No GitHub push.
- No Vercel deployment.

### 2026-05-24 - Improve File Role Recognition for Vague Task Books

Changed files:
- `src/lib/agent/document-ingestion/file-role.ts`
- `app/api/upload/route.ts`
- `app/tasks/[id]/analysis/page.tsx`
- `AGENTS.md`
- `docs/skills-usage.md`
- `docs/website-change-log.md`
- `WEBSITE_CHANGE_LOG.md`

What changed:
- Parseable `.doc`, `.docx`, `.txt`, and `.md` files with vague names are now task-book candidates by default instead of low-confidence references.
- Upload now respects the selected slot: files uploaded through the task-book field become `task_book` when text extraction is supported.
- CSV/XLSX/XLS/JSON files remain `dataset` and are not parsed as task books.
- The analysis page now upgrades the only parseable non-dataset document to a task-book candidate for old records whose metadata was previously `reference`.
- Added permanent file-role recognition rules to project docs.

Why:
- The sy3 E2E showed that a single uploaded `sy3.doc` was labeled as reference material even though it was the only parseable teacher task book. This made the user flow less trustworthy.

Configuration impact:
- No new environment variables.
- No new npm dependencies.

Data/schema impact:
- No Supabase schema change.
- Existing task file metadata remains compatible; old records get a UI-level fallback.

Verification:
- Role inference smoke test: `sy3.doc`, `888.docx`, and `.txt` task descriptions resolve to `task_book`; `sy1.csv` and `data.xlsx` resolve to `dataset`: pass
- `npm run samples:check`: pass
- `npm run lint`: pass
- `npm run build`: pass

Security notes:
- No secrets committed.
- `.env.local` not printed.
- No GitHub push.
- No Vercel deployment.

### 2026-05-24 - sy3 Huffman Website E2E Fixes

Changed files:
- `src/lib/tasks/task-runner.ts`
- `src/lib/reports/template-preserving-docx.ts`
- `src/lib/screenshots/evidence.ts`
- `app/api/tasks/[id]/export-docx/route.ts`
- `docs/agent-samples/015-sy3-huffman-doc-rerun-screenshot-dedup/*`
- `docs/agent-samples/README.md`
- `docs/website-change-log.md`
- `WEBSITE_CHANGE_LOG.md`

What changed:
- Ran `sy3.doc` through the website full flow without manually providing task content.
- Added a Huffman-specific fallback generator so JSON-format failures do not degrade into code that merely prints the task description.
- Removed stale stack/double-stack wording from default screenshot captions and problem-thinking text.
- Normalized screenshot evidence with `relatedRunId` and made DOCX export use the latest run's screenshot set by default, preventing historical rerun screenshots from accumulating in the final document.
- Added sample `015-sy3-huffman-doc-rerun-screenshot-dedup` to preserve the lesson.

Why:
- The first sy3 export preserved the teacher template but showed two reusable risks: unrelated reflection/caption leakage and duplicate screenshots after rerun. The final export now keeps the sy3/Huffman context and inserts only one latest real run screenshot.

Configuration impact:
- No new environment variables.
- No new npm dependencies.

Data/schema impact:
- No Supabase schema change.
- Existing `task-files` and `task_outputs.report_json.screenshots` remain unchanged.

Verification:
- Website task: `2da16d19-36d2-40d3-a6a0-02cf688c1173`
- Final export: `C:\Users\87808\Desktop\sy3_website_full_flow_export_final.docx`
- Final DOCX contains `【代码】`, `【运行截图】`, `【问题及思考】`, `哈夫曼`, and `WPL`: pass
- Final DOCX does not contain `系统填写`, `双栈`, `算术表达式`, or `空栈`: pass
- Final DOCX has 3 original media files plus 1 latest run screenshot: pass
- `npm run lint`: pass
- `npm run build`: pass

Security notes:
- No secrets committed.
- `.env.local` not printed.
- No GitHub push.
- No Vercel deployment.

### 2026-05-24 - Remove "系统填写" From Delivered DOCX Labels

Changed files:
- `src/lib/reports/template-preserving-docx.ts`
- `src/lib/reports/docx-preservation-validator.ts`
- `src/lib/ai/prompts.ts`
- `src/lib/agent/prompts.ts`
- `app/tasks/[id]/workbench.tsx`
- `app/tasks/[id]/task-detail-actions.tsx`
- `AGENTS.md`
- `docs/workflows/lab-docx-delivery-workflow.md`
- `docs/skills-usage.md`
- `docs/agent-samples/001-template-preserving-docx-fill/*`
- `docs/agent-samples/002-real-run-screenshot-workflow/e2e-test-result.md`

What changed:
- Delivered DOCX labels no longer include the words `系统填写`.
- Exported fill labels now use concise labels such as `【代码】`, `【运行结果】`, `【运行截图】`, `【结果分析】`, `【问题及思考】`, and `【截图缺失】`.
- Preservation validation now accepts the concise labels instead of requiring `【系统填写】`.
- Website copy and workflow documentation were updated to say generated content is inserted without adding `系统填写` to the final document.

Why:
- User review of the exported document showed that `【系统填写：运行截图】` and `【系统填写：问题及思考】` looked too artificial in the final teacher-template document.

Configuration impact:
- No new environment variables.
- No new npm dependencies.

Data/schema impact:
- No Supabase schema change.
- Existing `task-files` and `task_outputs.report_json.screenshots` conventions remain unchanged.

Verification:
- Fresh website export saved to `C:\Users\87808\Desktop\大数据2404张毅198-无系统填写.docx`: pass
- Exported DOCX package contains `【代码】`, `【运行截图】`, and `【问题及思考】`: pass
- Exported DOCX package does not contain `系统填写`: pass
- `npm run samples:check`: pass
- `npm run samples:run -- --mode=local-fixture 014-sy2-sectioned-doc-preservation-workflow`: pass
- `npm run samples:run -- --mode=local-fixture --all`: pass, with `008-docx-template-edge-cases` still partial by design
- `npm run lint`: pass
- `npm run build`: pass

Security notes:
- No secrets committed.
- `.env.local` not printed.
- No GitHub push.
- No Vercel deployment.

### 2026-05-24 - Add sy2 High-Quality DOCX Delivery Sample

Changed files:
- `docs/agent-samples/014-sy2-sectioned-doc-preservation-workflow/*`
- `src/lib/samples/sample-regression.ts`
- `docs/agent-samples/README.md`
- `docs/agent-samples/sample-regression-plan.md`
- `docs/workflows/lab-docx-delivery-workflow.md`
- `AGENTS.md`
- `docs/website-change-log.md`
- `WEBSITE_CHANGE_LOG.md`

What changed:
- Added sample `014-sy2-sectioned-doc-preservation-workflow` from the accepted `sy2.doc` website delivery.
- Stored the original `sy2.doc` template and the refreshed accepted DOCX artifact `大数据2404张毅198.docx`.
- Added a local-fixture replay check that validates original snippets, generated labels, screenshot media, and the absence of `系统填写` in the delivered DOCX.
- Documented the paragraph-marker workflow: code under `实验代码`, real screenshot plus explanation under `实验结果与分析`, and reflection under `问题及思考`.

Why:
- The `sy2.doc` delivery is a high-value successful example of preserving teacher-provided content while filling only the intended answer areas. It should guide future DOC/DOCX workflow behavior.

Configuration impact:
- No new environment variables.
- No new npm dependencies.

Data/schema impact:
- No Supabase schema change.
- No Storage bucket change.

Verification:
- `npm run samples:run -- --mode=local-fixture 014-sy2-sectioned-doc-preservation-workflow`: pass
- `npm run samples:check`: pass
- `npm run samples:run -- --mode=local-fixture --all`: pass, with `008-docx-template-edge-cases` still partial by design
- `npm run lint`: pass
- `npm run build`: pass

Security notes:
- No secrets committed.
- `.env.local` not printed.
- No GitHub push.
- No Vercel deployment.

### 2026-05-23 - sy2.doc Paragraph-Marker Original-Template Fill

Changed files:
- `src/lib/reports/task-block-detector.ts`
- `src/lib/reports/template-preserving-docx.ts`
- `src/lib/reports/docx-preservation-validator.ts`
- `AGENTS.md`
- `docs/workflows/lab-docx-delivery-workflow.md`
- `docs/agent-samples/001-template-preserving-docx-fill/e2e-test-result.md`
- `docs/website-change-log.md`

What changed:
- Added paragraph-marker DOCX fill detection for templates without tables.
- Added `sectioned_lab_report` fill mode for `实验代码`, `实验结果与分析`, and `问题及思考` markers.
- The website now appends generated code under the code marker, inserts real command-output screenshots under the result/screenshot marker, and fills reflection under the problem/thinking marker.
- Added preservation-validator allowance for explicit placeholder phrases such as `XXXXX` and `********` when they appear in a fillable reflection placeholder.
- Clarified the workflow rule: original-format preservation means original teacher content and structure remain immutable; appended system content may naturally add pages and must not consume or overwrite source content.
- Ran a real authenticated website flow for `sy2.doc` and exported `C:\Users\87808\Desktop\sy2_website_full_flow_export.docx`.

Why:
- `sy2.doc` is a paragraph-marker teacher template, not a table template. A single generic append point or table-cell fill could not satisfy “code under code marker, screenshot under result marker, reflection under problem marker” while preserving original content.

Configuration impact:
- No new environment variables.
- No new npm dependencies.
- Uses the existing local LibreOffice Portable conversion path for `.doc -> .docx` baseline.

Data/schema impact:
- No Supabase schema change.
- Existing `task-files` and `task_outputs.report_json.screenshots` conventions remain unchanged.

Verification:
- Website task id: `95410bd3-612c-4b25-8de5-603015f90a7a`
- Exported DOCX: `C:\Users\87808\Desktop\sy2_website_full_flow_export.docx`
- Validation folder: `C:\Users\87808\Desktop\sy2-website-validation\`
- Original key snippets preserved: course report title, `教学与研究部 制`, `指导老师`, `实验名称：栈的应用`, `一、实验要求`, `二、实验目的`, `三、实验内容及原理`, `四、实验设备及实验步骤`, `五、实验步骤`, `实验代码`, `实验结果与分析`, and `问题及思考`.
- Exported DOCX contains original media plus the generated real screenshot media.
- Rendered page count changed from 4 to 7 because full generated code was appended; original content was not deleted or rewritten.

Security notes:
- No secrets committed.
- `.env.local` not printed.
- No GitHub push.
- No Vercel deployment.

### 2026-05-23 - Universal Original Document Preservation Workflow Default

Changed files:
- `AGENTS.md`
- `docs/skills-usage.md`
- `docs/workflows/lab-docx-delivery-workflow.md`
- `.agents/skills/lab-docx-delivery-workflow/SKILL.md`
- `.agents/skills/lab-docx-delivery-workflow/references/docx-preservation-rules.md`
- `docs/agent-samples/001-template-preserving-docx-fill/README.md`
- `docs/agent-samples/001-template-preserving-docx-fill/preservation-rules.md`
- `docs/agent-samples/001-template-preserving-docx-fill/workflow-pattern-candidate.json`
- `src/lib/reports/docx-preservation-validator.ts`
- `src/lib/reports/template-preserving-docx.ts`
- `app/api/tasks/[id]/export-docx/route.ts`

What changed:
- Promoted the `sy.doc` success rule into the default DOC/DOCX workflow: all original document content is immutable by default, not only named sections such as `项目任务书`, `项目计划`, and `填表说明`.
- Added `originalDocumentPolicy = immutable_except_explicit_fill_cells` to patched DOCX export metadata.
- Strengthened preservation validation to sample snippets from the beginning, middle, end, and known section labels across the document.
- Documented the only allowed replacement exception: placeholder/instruction text may be replaced only inside a reliably identified fillable answer area and only when the source document explicitly says that placeholder text should be removed before submission.

Why:
- Future DOC/DOCX deliveries must preserve every teacher-provided section, table, note, label, media item, and layout choice by default while only appending system-generated evidence or answers in the correct fillable location.

Configuration impact:
- No new environment variables.
- No new dependencies.

Data/schema impact:
- No Supabase schema change.
- Existing `task-files` and `task_outputs.report_json` conventions remain unchanged.

Verification:
- `npm run lint`: pass
- `npm run build`: pass
- `npm run samples:check`: pass

Security notes:
- No secrets committed.
- `.env.local` not printed.
- No GitHub push.
- No Vercel deployment.

### 2026-05-23 - sy.doc Website Full Flow Original-Template Export Verification

Changed files:
- `src/lib/reports/doc-to-docx-converter.ts`
- `src/lib/reports/task-block-detector.ts`
- `src/lib/reports/template-preserving-docx.ts`
- `docs/agent-samples/001-template-preserving-docx-fill/e2e-test-result.md`
- `docs/website-change-log.md`
- `WEBSITE_CHANGE_LOG.md`

What changed:
- Added LibreOffice Portable `soffice.com` discovery so local `.doc` files can be converted to a `.docx` baseline without a system-wide LibreOffice install.
- Added table-cell targeting for teacher templates that contain `?????????` and `?????` rows.
- Added `screenshot_only_table` fill behavior: the implementation/result cell receives only the real run screenshot and Chinese caption, while the problem/thinking cell receives only the reflection text.
- The red prompt text in the implementation/result cell is removed during table-cell fill, while `?????`, `????`, `????`, cover fields, and other original content remain preserved.
- Ran the actual website flow with `sy.doc + sy1.csv`: login, create task, upload task book and dataset, parse document, analyze, run real Python code, generate command-output screenshot, save report draft, and export DOCX through `/api/tasks/[id]/export-docx?mode=patch_original_docx`.

Why:
- The user-provided template explicitly asks for screenshot-form results with text explanation, not pasted code blocks. The export must fill the existing table instead of generating a new report.

Configuration impact:
- No new environment variables.
- No new npm dependencies.
- LibreOffice Portable is installed locally at `C:\Users\87808\Apps\LibreOfficePortableExtracted\App\libreoffice\program\soffice.com` and is used when available for `.doc -> .docx` baseline conversion.

Data/schema impact:
- No Supabase schema change.
- Existing `task-files` and `task_outputs.report_json.screenshots` conventions remain unchanged.

Verification:
- Website task id: `d067b88a-48ff-4566-a825-294a45a8618d`
- Exported DOCX: `C:\Users\87808\Desktop\sy_website_full_flow_export.docx`
- Validation result: `C:\Users\87808\Desktop\sy-website-validation\validation-ascii.json`
- PDF render check: original baseline 9 pages, exported DOCX 9 pages.
- Key snippets preserved: `??????`, `????`, `????`, `?????`, task title, `?????????`, `?????`, `????`, `??????`.
- Screenshot media and relationship present in exported DOCX.
- `npm run lint`: pass
- `npm run build`: pass

Security notes:
- No secrets committed.
- `.env.local` not printed.
- No GitHub push.
- No Vercel deployment.

### 2026-05-23 - Strict DOC/DOCX Template-Preserving Export Gate

Changed files:
- `app/api/tasks/[id]/export-docx/route.ts`
- `src/lib/reports/doc-to-docx-converter.ts`
- `src/lib/ai/prompts.ts`
- `src/lib/agent/prompts.ts`
- `app/tasks/[id]/task-detail-actions.tsx`
- `AGENTS.md`
- `docs/skills-usage.md`
- `docs/workflows/lab-docx-delivery-workflow.md`
- `docs/agent-samples/001-template-preserving-docx-fill/*`

What changed:
- Added a safe `.doc` to `.docx` conversion gate using LibreOffice/soffice when available.
- Blocked silent fallback from an uploaded original task book to `generated_report_docx`.
- Kept standard `.docx` on the template-preserving patch path.
- If `.doc` conversion is unavailable or fails, export now returns a Chinese error asking for a standard `.docx` instead of producing a fake preserved document.
- Strengthened report prompts so inserted DOCX content defaults to Chinese.
- Clarified UI and docs that generated DOCX is a non-original-format mode.

Why:
- Real E2E with `sy.doc + sy1.csv` showed that generated fallback can produce a new English report instead of filling the original teacher task book.

Configuration impact:
- No new environment variables.
- No new dependencies.
- LibreOffice/soffice is optional; without it, `.doc` original-format export stops safely.

Data/schema impact:
- No Supabase schema change.
- Existing `task-files` and `task_outputs.report_json` conventions remain unchanged.

Verification:
- `npm run lint`: pass
- `npm run build`: pass
- local LibreOffice availability check: unavailable on this machine, so `.doc` conversion will stop with the safe Chinese error.

Security notes:
- No secrets committed.
- `.env.local` not printed.
- No GitHub push.
- No Vercel deployment.

### 2026-05-23 - DOC/DOCX Original Format Preservation Hardening

Changed files:
- `AGENTS.md`
- `docs/skills-usage.md`
- `src/lib/reports/task-block-detector.ts`
- `src/lib/reports/docx-preservation-validator.ts`
- `src/lib/reports/template-preserving-docx.ts`
- `app/api/tasks/[id]/export-docx/route.ts`
- `app/tasks/[id]/workbench.tsx`
- `docs/agent-samples/001-template-preserving-docx-fill/*`
- `docs/workflows/lab-docx-delivery-workflow.md`
- `docs/website-change-log.md`
- `WEBSITE_CHANGE_LOG.md`

What changed:
- Added explicit DOC/DOCX original-format preservation rules.
- Split task-block detection into a dedicated module and record insertion point evidence.
- Added post-patch DOCX preservation validation using original key snippets and system-fill label checks.
- Tightened `.doc` / non-standard `.docx` behavior so text extraction does not imply original-format-preserving export.
- Changed missing screenshot export text to a hard `【截图缺失】` marker.
- Added Workbench copy clarifying original-template export and missing-screenshot behavior.

Why:
- Real deliverables must fill the teacher's original task book instead of rebuilding a different report.

Configuration impact:
- No new environment variables.
- No new dependencies.

Data/schema impact:
- No Supabase schema change.
- Existing `task-files` and `task_outputs.report_json` conventions remain unchanged.

Verification:
- `npm run lint`: pass
- `npm run build`: pass

Security notes:
- No secrets committed.
- `.env.local` not printed.
- No GitHub push.
- No Vercel deployment.

## Project Identity

- Project name: Lab Report Assistant
- Product goal: a vertical AI workflow system for student lab tasks, not a generic chatbot.
- Core workflow: analyze -> plan -> generate-code -> run-code -> debug-once -> generate-report -> evaluate -> save-report -> export-docx.
- Current local-first rule: fix and verify locally before pushing to GitHub or deploying to Vercel.

## Tech Stack

- Framework: Next.js App Router
- Frontend: React 19, TypeScript, Tailwind CSS 4
- Backend: Next.js Route Handlers
- Auth and data: Supabase Auth, Postgres, Storage
- Supabase clients: `@supabase/ssr`, `@supabase/supabase-js`
- AI provider: Moonshot / Kimi through OpenAI-compatible chat completions
- Document export: `docx`
- Document ingestion: `mammoth` for docx, `word-extractor` for doc/fallback extraction, direct text read for txt/md
- Validation: `zod`
- Runtime requirement: Node.js >= 20.9.0

## Package Scripts

```bash
npm install
npm run dev
npm run lint
npm run build
npm run samples:check
npm run start
```

Current `dev` script:

```bash
next dev --webpack
```

## Environment Variables

Real values must live only in `.env.local` or deployment environment settings. Do not commit real secrets.

Required local variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
MOONSHOT_API_KEY=
MOONSHOT_BASE_URL=https://api.moonshot.ai/v1
MOONSHOT_MODEL=kimi-k2.5
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Security rules:

- Never commit `.env.local`.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` in frontend code.
- Never expose `MOONSHOT_API_KEY` in frontend code.
- `NEXT_PUBLIC_*` variables are browser-visible by design.
- Do not print real API keys in logs, docs, screenshots, or chat.

## Supabase Configuration

Current intended services:

- Auth: email/password login and registration
- Database: tasks, task inputs, task files, task runs, task steps, task outputs, profiles, billing logs
- Storage bucket: `task-files`
- Local auth depends on correct cookie/session handling through Supabase SSR helpers.

Manual Supabase Dashboard checklist for local development:

- Site URL can be `http://localhost:3000` during local development.
- Redirect URLs should include local ports used by development:
  - `http://localhost:3000/**`
  - `http://127.0.0.1:3000/**`
  - `http://localhost:3001/**`
  - `http://127.0.0.1:3001/**`
  - `http://localhost:3103/**`
  - `http://127.0.0.1:3103/**`
- Production redirect should include the Vercel site URL when deployment resumes.

## Important Pages

Do not break these pages without explicitly recording why:

- `/`
- `/demo`
- `/auth`
- `/tasks`
- `/tasks/new`
- `/tasks/[id]`
- `/tasks/[id]/analysis`

## Important APIs

Core task APIs:

- `GET /api/tasks`
- `POST /api/tasks`
- `GET /api/tasks/[id]`
- `POST /api/tasks/[id]/analyze`
- `POST /api/tasks/[id]/confirm-analysis`
- `POST /api/tasks/[id]/generate-code`
- `POST /api/tasks/[id]/run-code`
- `POST /api/tasks/[id]/generate-report`
- `POST /api/tasks/[id]/save-report`
- `POST /api/tasks/[id]/export-docx`
- `POST /api/tasks/[id]/parse-document`

Possible or future workflow APIs:

- `POST /api/tasks/[id]/debug-code`
- `POST /api/tasks/[id]/agent/run`
- `POST /api/tasks/[id]/agent/trace`

## Current Architecture Notes

Frontend pages should handle:

- user input
- file upload display
- file role selection
- document parse preview
- task analysis confirmation
- code/stdout/stderr display
- report preview/edit/export controls

API routes should handle:

- auth checks
- task ownership checks
- Supabase reads/writes
- AI calls
- document parsing workflow entry points
- report export

Agent layer should gradually concentrate in `src/lib/agent` and handle:

- task analysis
- planning
- code generation
- run/debug orchestration
- report generation
- evaluation
- trace capture

Runner layer is a future boundary for real code execution and could move to Docker Worker, Render, Railway, or VPS.

Data layer is Supabase Auth, Postgres, RLS assumptions, and Storage.

## Document Ingestion Workflow

Current intended workflow:

1. infer file role
2. user selects the task-book file
3. detect file type
4. extract raw text
5. normalize text
6. structure document with Moonshot
7. save parse result
8. hand off to normal analyze workflow

Supported text extraction in the first version:

- docx
- doc
- txt
- md

Not supported in the first version:

- pdf text extraction
- image OCR
- csv/xlsx dataset parsing as task-book text
- source code parsing as task-book text

File roles:

- `task_book`: experiment task book
- `report_template`: report template
- `dataset`: data file
- `screenshot`: screenshot/image material
- `source_code`: existing code
- `reference`: reference material
- `unknown`: unknown type

Important boundary:

- `src/lib/files.ts` handles upload-time lightweight text extraction/fallback.
- `src/lib/agent/document-ingestion/*` handles the formal document-ingestion workflow.
- `analyze` should prefer document-ingestion results when available, but still keep fallback behavior for old tasks or tasks without parse-document.

## Local Development Rule

Before pushing or deploying, verify locally:

1. `npm run lint`
2. `npm run build`
3. `npm run dev`
4. open `/auth`
5. login with a local test account
6. refresh `/tasks` and confirm session persists
7. open `/tasks/new`
8. create a task
9. upload a document when relevant
10. open `/tasks/[id]/analysis`
11. parse selected task-book document when relevant
12. confirm analysis and enter `/tasks/[id]`

Do not push to GitHub or deploy to Vercel until the local path is stable.

## Change History

### 2026-05-22 - Fix Download Filename ByteString Error

Changed files:

- `src/lib/http/download-headers.ts`
- `app/api/tasks/[id]/export-docx/route.ts`
- `src/lib/utils.ts`
- `src/lib/samples/sample-regression.ts`
- `docs/agent-samples/013-download-filename-encoding/*`
- `docs/website-change-log.md`
- `WEBSITE_CHANGE_LOG.md`

What changed:

- Added a shared download header helper for binary download responses.
- `Content-Disposition` now uses an ASCII `filename` fallback plus UTF-8 percent-encoded `filename*`.
- DOCX export no longer writes raw Chinese download names directly into headers.
- DOCX export encodes `X-Export-Fallback-Reason` before putting it in a response header.
- POST export decodes the encoded fallback reason back into the JSON response.
- Added a user-friendly ByteString error fallback message.
- Added sample `013-download-filename-encoding` to validate Chinese filenames, spaces, and path separators.

Why:

- Real authenticated E2E showed `Cannot convert argument to a ByteString...` during DOCX download. The likely root was raw non-ASCII text in download-related response headers.

Configuration impact:

- No new environment variables.
- No dependency changes.

Data/schema impact:

- No Supabase schema change.
- No Storage bucket change.

Verification:

- `npm run samples:check`: pass
- `npm run samples:run -- --mode=local-fixture 013-download-filename-encoding`: pass
- `npm run samples:run -- --mode=local-fixture --all`: pass, with `008-docx-template-edge-cases` still partial
- `npm run lint`: pass
- `npm run build`: pass
- Manual Chinese DOCX download E2E: not run in browser during this pass

Security notes:

- No secrets committed.
- `.env.local` was not printed.
- No GitHub push.
- No Vercel deployment.

### 2026-05-22 - Fix Screenshot Evidence Propagation Across Run-Code, Trace, Quality Gate, Report, and DOCX Export

Changed files:

- `src/lib/screenshots/evidence.ts`
- `src/lib/tasks/task-runner.ts`
- `src/lib/agent/workflow-orchestrator.ts`
- `src/lib/agent/quality-evaluation.ts`
- `app/api/tasks/[id]/agent/trace/route.ts`
- `app/api/tasks/[id]/export-docx/route.ts`
- `src/lib/agent/prompts.ts`
- `src/lib/samples/sample-regression.ts`
- `docs/agent-samples/012-run-code-screenshot-trace-export-consistency/*`

What changed:

- Added canonical screenshot evidence normalization and merge helpers.
- `run-code` now persists screenshots inside `run_result` as well as `report_json.screenshots`.
- Agent trace `run-code` steps include screenshot artifacts for first runs and debug reruns.
- Agent trace `generate-screenshot` now references screenshots generated inside `run-code` instead of showing an empty skipped step.
- `/api/tasks/[id]/agent/trace` enriches saved trace responses with screenshot artifacts from existing task outputs.
- quality evaluation now reads screenshots from explicit input, run results, trace artifacts, and report JSON.
- `export-docx` now reads canonical screenshot evidence from report JSON, run results, and trace artifacts before deciding whether screenshots are missing.
- report generation prompt input now includes a screenshot evidence summary.
- Added sample `012-run-code-screenshot-trace-export-consistency` to prevent the run-code/trace/quality/export screenshot mismatch from regressing.

Why:

- Real authenticated E2E showed that `run-code` generated a real screenshot, but quality/export/trace still treated screenshots as missing because each layer read a different evidence shape.

Configuration impact:

- No new dependencies.
- No new environment variables.

Data/schema impact:

- No Supabase schema change.
- Existing `task_outputs.report_json.screenshots` remains the primary screenshot metadata location.
- Existing `task_outputs.report_json.agent_trace` artifacts are reused and enriched in responses.

Verification:

- `npm run samples:check`: pass
- `npm run samples:run -- --mode=local-fixture 002-real-run-screenshot-workflow`: pass
- `npm run samples:run -- --mode=local-fixture 004-python-file-io-lab`: pass
- `npm run samples:run -- --mode=local-fixture 011-csv-dataset-doc-export-workflow`: pass
- `npm run samples:run -- --mode=local-fixture 012-run-code-screenshot-trace-export-consistency`: pass
- `npm run samples:run -- --mode=local-fixture --all`: pass, with `008-docx-template-edge-cases` still partial
- `npm run lint`: pass
- `npm run build`: pass
- Manual screenshot E2E: not run in browser during this pass

Security notes:

- No secrets committed.
- `.env.local` was not printed.
- No Supabase schema migration.
- No GitHub push.
- No Vercel deployment.

### 2026-05-22 - Fix Real E2E Blockers: DOCX Export Fallback, Legacy Error Display, and CSV Dataset Context

Changed files:
- `app/api/tasks/[id]/export-docx/route.ts`
- `app/tasks/[id]/analysis/page.tsx`
- `app/tasks/[id]/analysis/analysis-panel.tsx`
- `app/tasks/[id]/workbench.tsx`
- `app/tasks/[id]/task-detail-actions.tsx`
- `src/lib/agent/quality-evaluation.ts`
- `src/lib/agent/workflow-orchestrator.ts`
- `src/lib/agent/prompts.ts`
- `src/lib/ai/prompts.ts`
- `src/lib/tasks/context-builder.ts`
- `src/lib/tasks/task-runner.ts`
- `src/lib/datasets/csv.ts`
- `src/lib/samples/sample-regression.ts`
- `src/lib/samples/sample-schema.ts`
- `docs/agent-samples/011-csv-dataset-doc-export-workflow/*`
- `.github/workflows/regression.yml`

What changed:
- Added `auto` DOCX export behavior: use `patch_original_docx` when a safe `.docx` template exists, otherwise fall back to `generated_report_docx`.
- Split quality evaluation semantics so pre-export checks no longer block on `docxOriginalStructurePreserved`, which can only be confirmed after export.
- Fixed screenshot requirement handling so real screenshot metadata or an explicit planned `【截图缺失】` marker satisfies the screenshot gate without contradictory flags.
- Replaced positive English check labels in blocking issues with concrete Chinese failure reasons.
- Improved API error summarization so legacy UI paths do not render raw JSON as the user-facing error.
- Prevented CSV dataset files from being selected as task-book parse targets by default.
- Added CSV dataset preview/context support and ensured Python runners copy dataset files into the temp working directory under the original safe filename.
- Updated code/report prompts to require exact dataset filenames and standard-library `csv` handling.
- Added regression sample `011-csv-dataset-doc-export-workflow` for task-book + CSV dataset + generated DOCX fallback.

Why:
- Real authenticated E2E showed that DOCX export, legacy error display, and CSV dataset handling were blocking practical use.

Configuration impact:
- No new env vars.
- No new dependencies.
- CI regression now includes sample 011.

Data/schema impact:
- No Supabase schema change.
- Dataset preview metadata uses existing `task_files.metadata`.
- Existing `task-files` bucket and `task_outputs.report_json.screenshots` remain unchanged.

Verification:
- `npm run samples:check`: pass
- `npm run samples:run -- --mode=local-fixture 011-csv-dataset-doc-export-workflow`: pass
- `npm run samples:run -- --mode=local-fixture 006-python-data-analysis-lab`: pass
- `npm run samples:run -- --mode=local-fixture 008-docx-template-edge-cases`: partial by design
- `npm run samples:run -- --mode=local-fixture --all`: pass, with 008 partial
- `npm run lint`: pass
- `npm run build`: pass
- Manual DOC+CSV E2E: not run in browser this turn

Security notes:
- No secrets committed.
- `.env.local` was not printed.
- No Supabase schema migration.
- No GitHub push.
- No Vercel deployment.

### 2026-05-22 - E2E Hardening, Remaining Sample Replay, Security Audit, and CI Regression Preparation

Changed files:
- `src/lib/samples/sample-regression.ts`
- `docs/agent-samples/006-python-data-analysis-lab/input-files/main.py`
- `docs/agent-samples/006-python-data-analysis-lab/verification-notes.md`
- `docs/agent-samples/008-docx-template-edge-cases/input-files/README.md`
- `docs/agent-samples/008-docx-template-edge-cases/verification-notes.md`
- `docs/agent-samples/009-failed-run-recovery/input-files/main.py`
- `docs/agent-samples/009-failed-run-recovery/input-files/fixed_main.py`
- `docs/agent-samples/009-failed-run-recovery/verification-notes.md`
- `docs/agent-samples/sample-regression-plan.md`
- `docs/internal-audit/manual-e2e-checklist.md`
- `docs/internal-audit/security-audit.md`
- `docs/roadmap/github-actions-regression-plan.md`
- `docs/roadmap/runner-architecture.md`
- `docs/skills-usage.md`
- `.github/workflows/regression.yml`
- `docs/website-change-log.md`
- `WEBSITE_CHANGE_LOG.md`

What changed:
- Added a manual authenticated E2E checklist for `/auth -> /tasks/new -> /tasks/[id] -> agent/run -> trace -> export-docx`.
- Expanded local fixture replay for `006-python-data-analysis-lab` with a real CSV analysis Python fixture and command-output screenshot evidence.
- Expanded local fixture replay for `009-failed-run-recovery` with a real failing first run, a single fixed debug-once run, trace output, and command-output screenshot evidence.
- Added an explicit partial replay path for `008-docx-template-edge-cases`; it is intentionally not marked as passed until binary DOCX fixtures and patch validation are implemented.
- Updated the security audit with API auth/ownership coverage, Storage path boundaries, service-role constraints, RLS dashboard checks, and runner isolation risk.
- Added a GitHub Actions regression workflow for lint, build, samples:check, and local-fixture sample replay without requiring secrets.
- Clarified that `docs/website-change-log.md` is the canonical change log and root `WEBSITE_CHANGE_LOG.md` is only a convenience mirror.
- Reconfirmed that runner production isolation remains a documented future step, not a v5 implementation.

Why:
- To stabilize the local product workflow before push/deploy, and to turn previously skipped samples into honest replay results.

Configuration impact:
- No new dependencies.
- No new environment variables.
- Added `.github/workflows/regression.yml`; it runs local checks only and does not deploy.

Data/schema impact:
- No Supabase schema change.
- Existing `task-files` bucket convention remains unchanged.
- Existing `task_outputs.report_json.screenshots` convention remains unchanged.

Verification:
- `npm run samples:check`: pass
- `npm run samples:run -- --mode=local-fixture 006-python-data-analysis-lab`: pass
- `npm run samples:run -- --mode=local-fixture 008-docx-template-edge-cases`: partial
- `npm run samples:run -- --mode=local-fixture 009-failed-run-recovery`: pass
- `npm run samples:run -- --mode=local-fixture --all`: pass with 008 reported as partial
- `npm run lint`: pass
- `npm run build`: pass
- manual authenticated E2E: not run; requires a real logged-in browser session

Security notes:
- No secrets committed.
- `.env.local` was not printed.
- Service-role usage remains server-only.
- Manual Supabase dashboard verification is still required for RLS and Storage policies.
- No GitHub push and no Vercel deployment.

### 2026-05-22 - Workbench Agent Run UI, Trace Console, DOCX Export Bridge, Browser Actions, and Sample Replay Expansion

Changed files:
- `app/tasks/[id]/workbench.tsx`
- `app/api/tasks/[id]/export-docx/route.ts`
- `app/api/tasks/[id]/run-code/route.ts`
- `src/lib/screenshots/browser-page-screenshot.ts`
- `src/lib/screenshots/screenshot-storage.ts`
- `src/lib/screenshots/types.ts`
- `src/lib/tasks/task-runner.ts`
- `src/lib/samples/sample-regression.ts`
- `docs/agent-samples/004-python-file-io-lab/input-files/main.py`
- `docs/agent-samples/005-python-oop-lab/input-files/main.py`
- `docs/agent-samples/007-frontend-basic-lab/input-files/index.html`
- `docs/agent-samples/007-frontend-basic-lab/input-files/style.css`
- `docs/agent-samples/007-frontend-basic-lab/input-files/script.js`
- `docs/agent-samples/010-no-screenshot-required/input-files/main.py`
- `docs/website-change-log.md`

What changed:
- Workbench now calls `/api/tasks/[id]/agent/run` for the main full workflow instead of relying on the old `/run-agent-workflow` entry.
- Workbench now includes a real Trace console powered by `/api/tasks/[id]/agent/trace`, showing step status, duration, summaries, artifacts, errors, warnings, and quality score.
- Workbench adds explicit controls for starting full workflow, rerunning full workflow, rerunning code only, regenerating screenshots only, refreshing Trace, and exporting DOCX.
- DOCX export is bridged through a POST wrapper over the existing quality-gated `export-docx` endpoint, while the actual download link remains the existing GET endpoint.
- Browser page screenshot runner now supports actions: click, fill, press, waitForSelector, wait, and screenshot.
- Browser page screenshot runner now supports multi-screenshot output metadata while preserving the existing single-screenshot API.
- `frontend_browser` run-code can pass browser actions through to the runner.
- 004, 005, 007, and 010 samples now have local fixture files.
- `samples:run` local-fixture can replay 004 Python file IO, 005 Python OOP, 007 frontend basic with two browser screenshots, and 010 no-screenshot-required.

Why:
- To turn the previously backend-heavy workflow into a product-visible Workbench loop: run the agent workflow, inspect real trace, see quality gate status, generate real screenshot evidence, and bridge to DOCX export.

Configuration impact:
- No new dependencies.
- No new environment variables.
- No package script changes.

Data/schema impact:
- No Supabase schema change.
- Existing `task-files` bucket convention remains unchanged.
- Existing `task_outputs.report_json.screenshots` remains the screenshot metadata location.
- Trace/quality continue to use existing `task_outputs.report_json` fields.

Verification:
- `npm run samples:check`: pass
- `npm run samples:run -- --mode=local-fixture 004-python-file-io-lab`: pass
- `npm run samples:run -- --mode=local-fixture 005-python-oop-lab`: pass
- `npm run samples:run -- --mode=local-fixture 007-frontend-basic-lab`: pass, generated initial and after-click browser screenshots
- `npm run samples:run -- --mode=local-fixture 010-no-screenshot-required`: pass, no screenshot required and no missing-screenshot penalty
- `npm run samples:run -- --mode=local-fixture --all`: pass for 002/003/004/005/007/010; 006/008/009 remain explicitly skipped
- `npm run lint`: pass
- `npm run build`: pass

Security notes:
- No secrets committed.
- `.env.local` was not printed.
- Browser screenshot context still does not reuse Supabase login cookies.
- User package scripts are still not executed for browser screenshots.
- No GitHub push and no Vercel deployment.

### 2026-05-22 - Product Workflow Closure: Agent Run, Quality Gate, Sample Replay, Trace, and Security Audit

Changed files:
- `src/lib/agent/workflow-orchestrator.ts`
- `src/lib/agent/quality-evaluation.ts`
- `app/api/tasks/[id]/agent/run/route.ts`
- `app/api/tasks/[id]/agent/trace/route.ts`
- `app/api/tasks/[id]/export-docx/route.ts`
- `src/lib/samples/sample-schema.ts`
- `src/lib/samples/sample-regression.ts`
- `docs/agent-samples/002-real-run-screenshot-workflow/*`
- `docs/internal-audit/current-state-audit.md`
- `docs/internal-audit/security-audit.md`
- `.agents/skills/*`
- `AGENTS.md`
- `docs/skills-usage.md`
- `.gitignore`

What changed:
- `/api/tasks/[id]/agent/run` now executes an orchestrated workflow when called with `{ "dryRun": false }`, instead of only returning a skeleton.
- Agent workflow results now persist trace and quality metadata in `task_outputs.report_json.agent_trace` and `task_outputs.report_json.quality`.
- `/api/tasks/[id]/agent/trace` now returns the latest persisted trace and quality payload.
- `evaluateTaskOutput()` now derives quality checks from generated code, real run results, screenshot metadata, report text, and DOCX mode.
- `export-docx` now runs a quality gate before export and validates service-role Storage reads stay under `task-files/{userId}/{taskId}/...`.
- `002-real-run-screenshot-workflow` is now a standard replay sample.
- `samples:run -- --mode=local-fixture 002-real-run-screenshot-workflow` runs real Python, captures stdout/stderr/exitCode/runtime, generates `command_output_screenshot`, and writes local artifacts.
- `samples:run -- --mode=local-fixture 003-browser-page-screenshot-workflow` continues to generate a real Playwright browser screenshot.
- Current state and security audits were added under `docs/internal-audit/`.

Why:
- To move the site from individually working modules toward a trustworthy, traceable, regression-tested lab delivery workflow without changing Supabase schema or deploying.

Configuration impact:
- No new environment variables.
- No new dependencies.
- `.tmp/` is ignored for local sample replay artifacts.

Data/schema impact:
- No Supabase schema change.
- Trace and quality use existing `task_outputs.report_json`.
- Screenshot metadata still uses existing `task_outputs.report_json.screenshots`.
- Storage convention remains `task-files/{userId}/{taskId}/...`.

Verification:
- `npm run samples:check`: pass
- `npm run samples:run -- --mode=local-fixture 002-real-run-screenshot-workflow`: pass
- `npm run samples:run -- --mode=local-fixture 003-browser-page-screenshot-workflow`: pass
- `npm run samples:run -- --mode=local-fixture --all`: pass for 002/003, skipped for 004-010
- `npm run lint`: pass
- `npm run build`: pass
- secret scan: no real hardcoded keys found; results are variable names/placeholders, Supabase migration grants, and a package-lock false positive

Security notes:
- No secrets committed.
- `.env.local` was not printed.
- service role remains server-only.
- Python child processes use a small environment whitelist, but production must still move execution to a real worker sandbox.
- Service-role Storage reads now validate current-user/current-task path boundaries before DOCX source/screenshot downloads.
- No GitHub push and no Vercel deployment.

### 2026-05-22 - Browser Screenshot Sample Replay and Agent Run Execution Gate

Changed files:
- `src/lib/samples/sample-regression.ts`
- `app/api/tasks/[id]/agent/run/route.ts`
- `src/lib/tasks/task-runner.ts`
- `.gitignore`
- `docs/agent-samples/003-browser-page-screenshot-workflow/*`
- `docs/website-change-log.md`

What changed:
- `npm run samples:run -- 003-browser-page-screenshot-workflow` now performs a real local replay of the static HTML browser screenshot sample.
- The replay generates a real PNG and writes `artifacts/browser-page-screenshot.png`, `artifacts/actual-screenshots.json`, and `artifacts/actual-run-result.json`.
- `npm run samples:run -- --all` runs supported replay samples and clearly marks unsupported future samples as skipped.
- `/api/tasks/[id]/agent/run` now defaults to a safe dry run, but can execute the existing production `runAgentWorkflow` path when the request body includes `{ "dryRun": false }`.
- Unknown sample ids and unsupported-only `samples:run` selections now fail explicitly instead of returning a false pass.
- Sample replay metadata uses project-relative artifact paths, and local `docs/agent-samples/**/artifacts/` output is ignored by Git.
- Python run-code now launches child processes with a small environment whitelist instead of forwarding the full server environment.
- Python safety checks now block direct `os.environ` / `os.getenv` access patterns so generated code cannot print server secrets as stdout evidence.

Why:
- To remove the two remaining foundation gaps: `samples:run` being only a placeholder, and `/agent/run` being only a skeleton.

Configuration impact:
- No new environment variables.
- No new dependency.

Data/schema impact:
- No Supabase schema change.
- No change to `task-files`.
- No change to `task_outputs.report_json.screenshots`.

Verification:
- `npm run samples:run -- 003-browser-page-screenshot-workflow`: pass
- `npm run samples:run -- --all`: pass for 003, skipped for not-yet-implemented replays
- `npm run samples:check`: pass
- `npm run lint`: pass
- `npm run build`: pass

Security notes:
- No secrets committed.
- `.env.local` was not printed or added to docs.
- Python child processes no longer inherit full `process.env`.
- Local sample artifacts are ignored and do not store absolute user-machine paths.
- No GitHub push and no Vercel deployment.

### 2026-05-22 - Roadmap, Sample Library, Skills, and Agent Workflow Foundation

Changed files:
- `AGENTS.md`
- `package.json`
- `app/api/tasks/[id]/agent/run/route.ts`
- `app/api/tasks/[id]/agent/trace/route.ts`
- `src/lib/agent/workflow-types.ts`
- `src/lib/agent/agent-trace.ts`
- `src/lib/agent/quality-evaluation.ts`
- `src/lib/agent/workflow-orchestrator.ts`
- `src/lib/samples/sample-schema.ts`
- `src/lib/samples/sample-loader.ts`
- `src/lib/samples/sample-regression.ts`
- `docs/roadmap/*`
- `docs/agent-samples/README.md`
- `docs/agent-samples/sample-schema.json`
- `docs/agent-samples/sample-regression-plan.md`
- `docs/agent-samples/003-browser-page-screenshot-workflow/*`
- `docs/agent-samples/004-python-file-io-lab/*`
- `docs/agent-samples/005-python-oop-lab/*`
- `docs/agent-samples/006-python-data-analysis-lab/*`
- `docs/agent-samples/007-frontend-basic-lab/*`
- `docs/agent-samples/008-docx-template-edge-cases/*`
- `docs/agent-samples/009-failed-run-recovery/*`
- `docs/agent-samples/010-no-screenshot-required/*`
- `.agents/skills/browser-page-screenshot-workflow/SKILL.md`
- `.agents/skills/sample-library-regression-workflow/SKILL.md`
- `.agents/skills/report-quality-evaluation-workflow/SKILL.md`
- `.agents/skills/task-runner-boundary-workflow/SKILL.md`
- `.agents/skills/supabase-storage-metadata-workflow/SKILL.md`
- `.agents/skills/multi-agent-lab-delivery-workflow/SKILL.md`
- `docs/skills-usage.md`
- `docs/website-change-log.md`

What changed:
- Added roadmap docs for evidence chain stability, sample-library quality, one-click agent workflow, runner separation, and CI regression.
- Added AI/Skill/Workflow division and automation boundary docs.
- Added standard sample library README, JSON schema, regression plan, and sample skeletons from 003 to 010.
- Added repository-level project skills for browser screenshots, sample regression, report quality, runner boundaries, Supabase metadata, and multi-agent delivery.
- Added workflow type inference, agent trace, quality evaluation, and orchestrator skeleton types.
- Added read-only/stub Agent API endpoints for `/api/tasks/[id]/agent/run` and `/api/tasks/[id]/agent/trace`.
- Added `samples:check` and `samples:run` scripts. The current checker is structural; `samples:run` is a placeholder for future replay.

Why:
- To turn the current lab delivery flow into a repeatable, testable, skill-assisted, multi-agent workflow system without disrupting the working Python, screenshot, and DOCX paths.

Configuration impact:
- No new environment variables.
- Added `tsx` as a devDependency for running TypeScript sample regression scripts.

Data/schema impact:
- No Supabase schema change.
- No change to the `task-files` Storage bucket convention.
- No change to `task_outputs.report_json.screenshots`; the new docs and types continue to rely on that metadata location.

Verification:
- `npm run samples:check`: pass
- `npm run lint`: pass
- `npm run build`: pass
- local browser test: not required for these skeleton/docs changes

Security notes:
- No secrets committed.
- `.env.local` was not printed or added to docs.
- No GitHub push and no Vercel deployment.

### 2026-05-22 - Browser Page Screenshot Workflow

Changed files:
- `package.json`
- `package-lock.json`
- `app/api/tasks/[id]/run-code/route.ts`
- `app/api/tasks/[id]/export-docx/route.ts`
- `app/tasks/[id]/workbench.tsx`
- `src/lib/screenshots/browser-page-screenshot.ts`
- `src/lib/screenshots/screenshot-storage.ts`
- `src/lib/screenshots/types.ts`
- `src/lib/tasks/task-runner.ts`
- `src/lib/reports/template-preserving-docx.ts`
- `docs/skills-usage.md`
- `docs/agent-samples/003-browser-page-screenshot-workflow/*`
- `docs/website-change-log.md`

What changed:
- Added `browser_page_screenshot` for real Chromium-rendered webpage screenshots.
- Extended `/api/tasks/[id]/run-code` with `runMode = "frontend_browser"` while keeping Python default behavior unchanged.
- Added a safe static preview runner that writes frontend files to a temporary directory, serves them on localhost, blocks external network requests, and captures a PNG with Playwright.
- Extended screenshot Storage metadata to support command-output and browser-page screenshot types.
- Updated DOCX export to preserve original DOCX patch mode and carry screenshot type/source/description metadata.
- Added a minimal workbench button for frontend-like tasks: `生成真实网页效果截图`.

Configuration impact:
- Added `playwright` as a project dependency.
- Local machines may need `npx playwright install chromium` before browser screenshots can run.
- No new environment variables.

Data/schema impact:
- No Supabase schema change.
- Uses existing `task_outputs.report_json.screenshots` JSON metadata and existing `task-files` Storage bucket.

Verification:
- `npm run lint`: pass
- `npm run build`: pass
- static browser screenshot smoke: pass
- server workflow-level browser screenshot run on existing local task: pass
- Storage PNG download check: pass
- DOCX media/label check: pass

Security notes:
- No secrets committed.
- `.env.local` was not printed or added to docs.
- Browser screenshot context does not reuse Supabase login cookies.
- User-provided package scripts are not executed.
- No GitHub push and no Vercel deployment.

### 2026-05-22 - Real Run Screenshot E2E Verification and Minimal Fixes

Changed files:
- `app/tasks/[id]/workbench.tsx`
- `app/api/tasks/[id]/export-docx/route.ts`
- `src/lib/reports/screenshot-requirements.ts`
- `docs/agent-samples/002-real-run-screenshot-workflow/*`
- `docs/website-change-log.md`

What changed:
- Verified the real-run-screenshot workflow locally with a standard DOCX task.
- Confirmed `run-code` can generate real `command_output_screenshot` PNG evidence from stdout/stderr/exit code/runtime.
- Confirmed screenshots upload to Supabase Storage and metadata is saved in `task_outputs.report_json.screenshots`.
- Confirmed `patch_original_docx` export can insert the real PNG under the task requirement while preserving original task text.
- Fixed workbench state so the one-click agent flow immediately shows `已生成真实运行截图` after screenshot generation.
- Fixed Supabase Storage export object keys by using an ASCII-safe `storage_file_name` while preserving the Chinese download filename.
- Added screenshot negation detection so phrases such as `无截图要求` and `不需要截图` do not force screenshot generation.

Configuration impact:
- No new environment variables.
- No deployment configuration change.

Data/schema impact:
- No Supabase schema change.
- Uses existing Storage bucket `task-files` and existing JSON metadata fields.

Verification:
- `npm run lint`: pass
- `npm run build`: pass
- local browser test: pass for standard DOCX screenshot task, no-screenshot task, negative screenshot phrase task, and failed run-code task

Security notes:
- No secrets committed.
- `.env.local` was not printed or added to docs.
- No GitHub push and no Vercel deployment.

### 2026-05-22 - Lab DOCX Delivery Workflow and Project Skill Draft

Changed files:
- `AGENTS.md`
- `docs/skills-usage.md`
- `docs/workflows/lab-docx-delivery-workflow.md`
- `.agents/skills/lab-docx-delivery-workflow/*`
- `docs/website-change-log.md`

What changed:
- Added the long-term `lab-docx-delivery-workflow` for preserving original task-book DOCX files while filling answers below task blocks.
- Added a repository-level custom skill draft under `.agents/skills/lab-docx-delivery-workflow/`.
- Updated skill usage guidance with searched repositories, recommended skill order, and install/reference decisions.
- Added AGENTS rules requiring original DOCX preservation, real runtime evidence, real screenshots or `【截图缺失】`, and pre-export preservation checks.

Configuration impact:
- No runtime configuration change.
- The project skill is a draft; current Codex sessions may need restart or explicit SKILL.md reading to use it.

Data/schema impact:
- No Supabase schema change.

Verification:
- `npm run lint`: pass
- `npm run build`: pass
- local browser test: not required; documentation and skill draft only

Security notes:
- No secrets committed.
- `.env.local` was not printed or added to docs.
- No GitHub push and no Vercel deployment.

### 2026-05-22 - Real Run Screenshot Workflow

Changed files:
- `AGENTS.md`
- `docs/skills-usage.md`
- `docs/agent-samples/001-template-preserving-docx-fill/screenshot-requirement-rules.md`
- `docs/agent-samples/002-real-run-screenshot-workflow/*`
- `package.json`
- `package-lock.json`
- `app/api/tasks/[id]/export-docx/route.ts`
- `app/tasks/[id]/page.tsx`
- `app/tasks/[id]/workbench.tsx`
- `src/lib/ai/prompts.ts`
- `src/lib/reports/screenshot-requirements.ts`
- `src/lib/reports/template-preserving-docx.ts`
- `src/lib/screenshots/*`
- `src/lib/tasks/task-runner.ts`
- `src/lib/validators/parsed-requirement.ts`

What changed:
- Added screenshot requirement detection keywords and explicit `needs_screenshot` support.
- Added `command_output_screenshot` generation from real run-code evidence.
- Uploaded generated PNG evidence to Supabase Storage under the existing `task-files` bucket.
- Saved screenshot metadata in existing `task_outputs.report_json.screenshots`.
- Workbench now shows minimal screenshot status when a task requires screenshots.
- Template-preserving DOCX export can insert PNG screenshot evidence; if unavailable, it keeps the visible missing-screenshot note.

Configuration impact:
- Added `sharp` as a direct dependency for server-side SVG-to-PNG rendering. It was already present transitively in the lockfile.

Data/schema impact:
- No Supabase schema change.
- Screenshot metadata uses existing JSON payload columns.

Verification:
- `npm run lint`: pass
- `npm run build`: pass
- local browser test: partial; dev server started, existing task page returned a task-detail `TypeError: fetch failed`, so full authenticated E2E needs a fresh login/task pass

Security notes:
- No secrets committed.
- `.env.local` was not printed or added to docs.
- No GitHub push and no Vercel deployment.

### 2026-05-21 - Template-Preserving DOCX Export Rule

Changed files:
- `AGENTS.md`
- `package.json`
- `package-lock.json`
- `app/api/tasks/[id]/export-docx/route.ts`
- `app/tasks/[id]/task-detail-actions.tsx`
- `app/tasks/[id]/workbench.tsx`
- `src/lib/reports/template-preserving-docx.ts`
- `src/lib/reports/screenshot-requirements.ts`
- `docs/agent-samples/001-template-preserving-docx-fill/*`

What changed:
- Added `patch_original_docx` export mode as the default DOCX delivery path.
- Kept `generated_report_docx` as an explicit legacy mode, labeled as rebuilding the document.
- Standard `.docx` exports now try to patch only `word/document.xml` and preserve package resources such as styles, headers, footers, numbering, and media.
- If the source DOCX is non-standard/corrupt or no safe insertion point is found, export stops with a Chinese error instead of outputting a format-damaging document.
- Added screenshot requirement detection. If screenshots are required but missing, the export records `screenshotMissing=true` and inserts a missing-screenshot note instead of faking evidence.

Configuration impact:
- Added `jszip` as a direct dependency because DOCX patching needs stable zip package access. The package was already present transitively through `docx`.

Data/schema impact:
- No Supabase schema change.
- Export metadata is stored in existing `task_outputs.report_json`.

Verification:
- `npm run lint`: pass
- `npm run build`: pass
- local browser test: pending

Security notes:
- No secrets committed.
- `.env.local` was not printed or added to docs.
- No GitHub push and no Vercel deployment.

### 2026-05-21 - Document Ingestion E2E Local Fixes

Changed files:
- `src/lib/agent/document-ingestion/extract-text.ts`
- `src/lib/agent/document-ingestion/analyze-document.ts`
- `src/lib/agent/document-ingestion/types.ts`
- `src/lib/agent/document-ingestion/document-workflow.ts`
- `src/lib/tasks/context-builder.ts`
- `src/lib/tasks/task-runner.ts`
- `src/lib/tasks/repository.ts`
- `app/api/tasks/[id]/analyze/route.ts`
- `app/tasks/[id]/analysis/analysis-panel.tsx`
- `docs/agent-samples/000-document-ingestion-workflow/*`

What changed:
- Non-standard `.docx` files now fall back from `mammoth` to `word-extractor`.
- Document structure parsing now extracts JSON, normalizes aliases, coerces loose array values, and falls back to deterministic structured task data if model JSON is unusable.
- Analyze can read `metadata.parsed_text` and document-ingestion context before older fallbacks.
- Local DB compatibility added for missing `task_outputs.docx_url` and older task status/run type constraints.

Verification:
- `npm run lint`: pass
- `npm run build`: pass before docs update; rerun required after final changes
- Local browser test: `888.docx -> parse-document -> Moonshot structure -> Supabase writeback -> analyze -> confirm -> workbench` passed

Security notes:
- No secrets committed.
- `.env.local` was not printed or added to docs.
- No GitHub push and no Vercel deployment.

### 2026-05-21 - Created This Tracking Document

- Added this document as the central record for website changes, configuration, and technical stack.
- Purpose: keep future Codex sessions aligned on what changed, how the site is configured, and what must be checked after changes.
- No business code changed in this entry.
- No secrets were added.

## Future Update Template

When the website changes, add a new entry here using this format:

```md
### YYYY-MM-DD - Short Change Title

Changed files:
- `path/to/file`

What changed:
- ...

Why:
- ...

Configuration impact:
- none / describe env, Supabase, Vercel, storage, or API changes

Data/schema impact:
- none / describe migration or metadata changes

Verification:
- `npm run lint`: pass/fail/not run
- `npm run build`: pass/fail/not run
- local browser test: pass/fail/not run

Security notes:
- no secrets committed / describe risk or mitigation
```
