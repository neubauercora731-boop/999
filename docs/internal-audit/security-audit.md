# Security Audit

Date: 2026-05-22

Scope: local code review for Supabase Auth, task ownership, Storage path boundaries, trace safety, and runner risks. This audit did not log in to the Supabase dashboard and did not inspect live RLS policy definitions.

## API Matrix

| API | Auth check | Ownership check | Service role usage | Notes |
|---|---:|---:|---:|---|
| `GET /api/tasks` | yes | user-scoped list | no | Uses current Supabase user. |
| `POST /api/tasks` | yes | creates for current user | no | Does not trust a client-provided `user_id`. |
| `GET /api/tasks/[id]` | yes | yes, via `getTaskDetail(..., user.id, id)` | no | Returns only the current user's task detail. |
| `POST /api/tasks/[id]/parse-document` | yes | yes | server-side only where needed | File parsing is task-scoped. |
| `POST /api/tasks/[id]/analyze` | yes | yes | no | AI call uses server-side Moonshot key only. |
| `POST /api/tasks/[id]/confirm-analysis` | yes | yes | no | Stores confirmed analysis for owned task. |
| `POST /api/tasks/[id]/generate-code` | yes | yes | no | Uses current task context. |
| `POST /api/tasks/[id]/run-code` | yes | yes | server-side only for screenshot artifact upload | Runner must not expose secrets to child processes. |
| `POST /api/tasks/[id]/generate-report` | yes | yes | no | Report prompt must use real evidence only. |
| `POST /api/tasks/[id]/save-report` | yes | yes | no | Saves report for owned task. |
| `POST /api/tasks/[id]/export-docx` | yes | yes | yes, server-side Storage download/upload | Checks source/screenshot paths under `task-files/{userId}/{taskId}/...`. |
| `POST /api/tasks/[id]/agent/run` | yes | yes | no direct client exposure | Orchestrator is task-owner scoped. |
| `GET /api/tasks/[id]/agent/trace` | yes | yes | no | Returns trace metadata for the current user's task. |

## Storage Boundary

Current intended bucket: `task-files`.

Server-written screenshot paths use:

```text
{userId}/{taskId}/screenshots/{timestamp}-{fileName}.png
```

DOCX export outputs use:

```text
{userId}/{taskId}/outputs/{timestamp}-{fileName}.docx
```

Security requirement:

- Storage paths must remain user/task scoped.
- Server-side reads using service role must verify task ownership first.
- Export must reject screenshot/source paths outside `task-files/{userId}/{taskId}/...`.
- Signed URLs, if returned later, should be short-lived and not written into logs as long-lived evidence.

## RLS And Dashboard Verification

Manual Supabase dashboard verification is still required. Do not claim production RLS is verified until the dashboard or migrations are inspected.

Tables/buckets to verify:

- `tasks`
- `task_inputs`
- `task_files`
- `task_runs`
- `task_steps`
- `task_outputs`
- `profiles`
- `billing_logs`
- Storage bucket `task-files`

Expected policy direction:

- users can read/write only their own task rows
- storage objects are isolated by `userId/taskId`
- server-only metadata writes cannot be overwritten by unrelated users
- public anonymous access to task artifacts is disabled unless through short-lived signed URLs

## Runner Risk

The Python and browser runners are currently local-first. They are useful for development verification but are not a production sandbox.

Current mitigations:

- Python child processes receive a small environment whitelist instead of full `process.env`.
- Browser screenshots use isolated contexts and do not reuse Supabase login cookies.
- Browser screenshot runner does not execute user `npm install` or `npm run dev`.

Remaining production risk:

- blacklist-based code checks are not a sandbox
- Chromium/Python workloads are heavy for normal web route handlers
- production should move execution to an isolated Docker/VM worker

## Secret Handling

No secrets should be present in:

- frontend source
- trace metadata
- report JSON
- screenshots
- generated DOCX
- documentation
- terminal logs copied into docs

The following must remain server-only:

- `SUPABASE_SERVICE_ROLE_KEY`
- `MOONSHOT_API_KEY`
- Supabase cookies/session tokens
- `.env.local`

## Findings

- No Supabase schema change was made in this hardening pass.
- No GitHub push or Vercel deployment was performed.
- The main remaining security blocker is manual dashboard verification of RLS and Storage policies.
- The main production architecture risk is runner isolation, documented as future work rather than implemented in this pass.
