---
name: coreblow-infra-batch-planner
description: Use before editing large CoreBlow Phase 4 infrastructure clusters such as manifest, hook-types, agents, gateway, command status, or Discord internals.
---

# CoreBlow Infra Batch Planner

Use this skill before editing large or dependency-heavy Phase 4 clusters.

Examples:

- `src/plugins/manifest*`
- `src/plugins/hook-types.ts`
- `src/plugins/compat/registry.ts`
- `src/agents`
- `src/gateway` infra
- `extensions/discord`
- command status infrastructure

## Plan Before Editing

Build a dependency map first:

1. List upstream files and line counts.
2. List imports for each file.
3. Mark which imports exist in CoreBlow.
4. Identify missing dependencies.
5. Identify false gaps.
6. Propose the smallest coherent batch.

## Required Plan Output

```text
Batch name:
Domain:
Files:
Dependencies:
Missing deps:
False gaps:
Risk:
Tests:
Gates:
Commit scope:
Rollback risk:
```

## Editing Rules

- Use chunked writes for files over 300 lines.
- Keep one domain per batch unless a dependency crosses domains.
- Add tests proportional to risk.
- Avoid root dependency/package changes unless explicitly approved.
- Do not use `--no-verify`.
- Use `SKIP=pnpm-audit-prod` only for the known unrelated audit blocker.
