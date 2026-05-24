# Local Backup and Restore

The project keeps a local runnable backup before GitHub/Vercel release prep.

## Backup Layout

```text
C:\Users\87808\Desktop\lab-report-assistant-backups\<timestamp>\
  working-tree\
  working-tree-no-secrets.zip
  repo-history.bundle
  LOCAL_PRIVATE_ENV_DO_NOT_UPLOAD\
    .env.local
```

## What Is Safe To Upload

Safe:

- `working-tree-no-secrets.zip`
- Git repository source after reviewing `git status`

Do not upload:

- `LOCAL_PRIVATE_ENV_DO_NOT_UPLOAD`
- `.env.local`
- `.vercel`
- Supabase service role key
- Moonshot API key
- user task documents that are not intentional regression fixtures

## Restore Locally

1. Copy `working-tree` or unzip `working-tree-no-secrets.zip`.
2. Copy `LOCAL_PRIVATE_ENV_DO_NOT_UPLOAD\.env.local` into the restored project root.
3. Run:

```bash
npm install
npm run dev
```

4. Open:

```text
http://localhost:3000
```

## Restore Git History

If needed:

```bash
git clone C:\Users\87808\Desktop\lab-report-assistant-backups\<timestamp>\repo-history.bundle restored-lab-report-assistant
```
