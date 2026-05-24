# GitHub and Vercel Release Checklist

This checklist prepares Lab Report Assistant for GitHub and Vercel without losing the local runnable version.

## 1. Local Backup First

Before pushing or deploying, create a local backup outside the repository:

- Safe source backup without secrets.
- Private `.env.local` backup marked `DO_NOT_UPLOAD`.
- Optional git bundle for history restore.

Current backup convention:

```text
C:\Users\87808\Desktop\lab-report-assistant-backups\<timestamp>\
```

## 2. Required Local Verification

Run:

```bash
npm run samples:check
npm run samples:run -- --mode=local-fixture --all
npm run lint
npm run build
```

Expected status:

- `samples:check`: pass
- `samples:run --all`: pass, with `008-docx-template-edge-cases` partial by design
- `lint`: pass
- `build`: pass

## 3. GitHub Readiness

Check before pushing:

- `.env.local` is ignored and not tracked.
- `.vercel/` is ignored and not tracked.
- Root-level user DOC/DOCX/PDF files are ignored.
- Real DOC/DOCX regression artifacts stay local-only and are ignored for the public GitHub repository.
- `README.md` is readable UTF-8.
- `.github/workflows/regression.yml` runs lint, build, sample checks, and privacy-safe local fixture replay without secrets.

Useful commands:

```bash
git status --short
git ls-files .env.local .vercel/project.json
git check-ignore -v .env.local .vercel
```

## 4. Vercel Environment Variables

Configure these in Vercel Project Settings:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
MOONSHOT_API_KEY
MOONSHOT_BASE_URL
MOONSHOT_MODEL
NEXT_PUBLIC_SITE_URL
```

Do not commit real values.

## 5. Vercel Runtime Boundary

The web app can deploy to Vercel as the product UI and API entry layer.

Local-first features that need production hardening:

- Python runner
- Playwright/Chromium browser screenshots
- LibreOffice `.doc -> .docx` conversion

For production-grade heavy execution, use a separate Worker layer:

```text
Next.js on Vercel
  -> create task / show state / export downloads
Runner Worker
  -> Python / Playwright / LibreOffice / artifacts
Supabase
  -> task metadata / Storage task-files
```

Recommended worker targets: Docker Worker, VPS, Render, Railway.

## 6. Suggested Release Flow

1. Run the local verification commands.
2. Push to a GitHub feature branch.
3. Open a PR.
4. Let GitHub Actions run.
5. Connect the repo to Vercel and create a Preview Deployment.
6. Configure Vercel environment variables.
7. Test `/auth`, `/tasks`, upload, analysis, workbench, and export DOCX on preview.
8. Promote to production only after the preview E2E passes.
