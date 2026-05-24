---
name: task-runner-boundary-workflow
description: Use this skill when modifying Python runners, browser runners, task execution, screenshot generation, debug-once behavior, or future worker separation.
---

# Task Runner Boundary Workflow

Use this workflow when changing code execution or evidence generation.

## Boundary

- AI can generate code and explain errors.
- Runner code proves whether execution happened.
- Runner code captures stdout, stderr, exitCode, and runtime.
- Runner code creates artifact metadata.
- Runner failure must be recorded honestly.

## Future Runner Types

- Python runner
- Browser runner
- DOCX export runner
- Docker worker
- Render/Railway worker
- VPS worker

## Forbidden

- Say "run succeeded" when `exitCode` is not 0.
- Use AI descriptions instead of screenshots.
- Use fake stdout instead of real stdout.
- Loop debug attempts indefinitely.
- Put service-role keys in frontend code.

## Current Boundary

- Local-first Python/browser runners are acceptable for development verification.
- Python child processes use a small environment whitelist, but this is not a production sandbox.
- Production should move heavy runners to Docker/VM workers rather than relying on Next.js route handlers.
