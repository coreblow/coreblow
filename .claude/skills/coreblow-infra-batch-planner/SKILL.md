---
name: coreblow-infra-batch-planner
description: Plan larger CoreBlow Phase 4 infrastructure batches before editing files such as manifest, hook-types, agents, gateway, or Discord clusters.
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

## Planning First

Do not edit first. Build a dependency map.

For the proposed cluster:

1. List upstream files and line counts.
2. List imports for each file.
3. Mark which imports exist in CoreBlow.
4. Identify missing dependencies.
5. Identify false gaps.
6. Propose the smallest coherent batch.

## Batch Risk Levels

- Low: all deps exist, behavior isolated, tests simple.
- Medium: touches shared types or runtime flow.
- High: touches loader, registry, manifest, sessions, gateway server, or published API.

## Required Plan Output

Before editing, report:

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
