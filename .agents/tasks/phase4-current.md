# Phase 4 Current Task

Use skills, in this order:

1. `coreblow-phase4-parity`
2. `coreblow-infra-batch-planner`

Read first:

- `.agents/goals/phase4-goal.md`
- `.agents/goals/phase4-state.json`

## Task

Implement the Discord REST client prerequisite batch.

The API wrappers are blocked by missing `internal/rest.ts`. `rest.ts` depends on:

- `internal/rest-body.ts` - already exists.
- `internal/rest-errors.ts` - already exists.
- `internal/rest-routes.ts` - already exists.
- `internal/rest-scheduler.ts` - already exists.
- `internal/schemas.ts` - missing, but root already has `typebox` and `extensions/discord` already imports `typebox` in existing production files, so this is not a new package dependency.

## Verify State First

Run:

```bash
git status --short
git log -1 --oneline
node - <<'NODE'
const fs = require("fs");
const m = JSON.parse(fs.readFileSync("scripts/parity/openclaw-parity-matrix.json", "utf8"));
for (const domain of ["extensions/discord", "src/plugin-sdk"]) {
  const row = m.matrix.find((entry) => entry.domain === domain);
  if (row) console.log(domain, row.counts);
}
NODE
```

Expected current state:

- HEAD: `e79e224eb P4 parity: update Discord REST scheduler matrix`
- `extensions/discord` srcGap: `163`
- `src/plugin-sdk` srcGap: `125`
- `extensions/discord` testGap: `50`

Allowed untracked:

- `.agents/`
- `.claude/`
- `PHASE4_CLAUDE_IMPLEMENTATION_PLAN.md`

## Target Files

Implement:

- `extensions/discord/src/internal/schemas.ts` (~36 lines)
- `extensions/discord/src/internal/rest.ts` (~322 lines)

Use upstream reference:

- `/Users/febrinanda/openclaw-refs/openclaw/extensions/discord/src/internal/schemas.ts`
- `/Users/febrinanda/openclaw-refs/openclaw/extensions/discord/src/internal/rest.ts`

## Requirements

- `rest.ts` is over 300 lines; use chunked writes.
- Do not add package dependencies or edit package config.
- Do not add `@ts-nocheck`, `ts-ignore`, lint disables, or broad `any`.
- Preserve CoreBlow-native naming.
- Adapt `userAgent` default if needed: avoid public `OpenClaw` branding in new CoreBlow code.
- Run gates before commit.

## After Rest Lands

Do not port API wrappers in this same batch unless `schemas.ts` + `rest.ts` compile cleanly and the batch remains small. Prefer a follow-up batch for:

- `api.webhooks.ts`
- `api.users.ts`
- `api.commands.ts`
- `api.interactions.ts`
- `api.messages.ts`
- `api.reactions.ts`
- `api.ts`

## Gates

Run before commit:

```bash
git diff --check
corepack pnpm exec tsgo --noEmit
corepack pnpm check
corepack pnpm audit:parity:matrix
```

Commit with:

```bash
SKIP=pnpm-audit-prod git commit -m "P4 parity: add Discord REST client"
```

Use `SKIP=pnpm-audit-prod` only because the known Baileys audit issue is unrelated.

Report final batch summary only.
