---
name: multi-agent-lab-delivery-workflow
description: Use this skill when coordinating multiple agents for roadmap, implementation, QA, sample library, browser screenshots, DOCX export, security, and report quality work.
---

# Multi-Agent Lab Delivery Workflow

Use this workflow for large changes that touch multiple project boundaries.

## Architecture Agent

- read `AGENTS.md`
- read `docs/website-change-log.md`
- preserve current core workflow
- check new architecture against runner and evidence boundaries

## Sample Library Agent

- standardize `docs/agent-samples`
- maintain sample schema
- add sample skeletons
- update sample regression notes

## Skill Agent

- create or update `.agents/skills/*/SKILL.md`
- keep skill bodies concise
- move long details into docs
- write failure lessons back into skills

## Implementation Agent

- implement `workflow-types.ts`
- implement `agent-trace.ts`
- implement `quality-evaluation.ts`
- implement `workflow-orchestrator.ts`
- implement sample check scripts

## Browser Screenshot Agent

- apply Playwright screenshot rules
- validate static HTML MVP
- plan React/Next.js runner boundary
- prevent fake screenshots

## DOCX Agent

- protect `patch_original_docx`
- preserve cover and teacher requirements
- keep screenshot insertion and missing-marker rules

## QA Agent

- run `npm run samples:check`
- run `npm run lint`
- run `npm run build`
- check no secrets
- check no push and no deploy
- update `docs/website-change-log.md`
