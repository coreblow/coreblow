# CoreBlow Phase 4 Goal

## Objective

Reach 100% OpenClaw parity matrix closure for CoreBlow using an engineering pipeline:

- disk-state resume
- domain-scoped batches
- false-gap audit before editing
- dependency checks before editing
- CoreBlow-native adaptation
- repeatable gates
- committed parity matrix updates

## Current Operating Mode

Antigravity is the main worker. Codex is the verifier.

Antigravity should use 9Router-backed models for larger autonomous batches, but must still work in controlled domain batches.

## Repo And References

- Repo: `/Users/febrinanda/coreblow`
- Default reference: `/Users/febrinanda/openclaw-refs/openclaw`
- App/native CLI reference: `/Users/febrinanda/openclaw-main`
- Registry/marketplace reference: `/Users/febrinanda/openclaw-refs/clawhub`

## Allowed Untracked Local Tooling

These may exist untracked and must not be edited or committed unless explicitly requested:

- `.agents/`
- `.claude/`
- `PHASE4_CLAUDE_IMPLEMENTATION_PLAN.md`

## Current Known State

Last verified Antigravity/Codex flow:

- Current focus: `extensions/discord`
- Latest known HEAD after Discord work: `973593c3f P4 parity: add Discord security and voice utilities + plugin-sdk exports`
- Latest known `extensions/discord` count: `srcGap=191`, `testGap=50`

Always verify from disk before trusting these values.

## Resume Checklist

Run first:

```bash
pwd
git status --short
git log -1 --oneline
node - <<'NODE'
const fs = require("fs");
const m = JSON.parse(fs.readFileSync("scripts/parity/openclaw-parity-matrix.json", "utf8"));
for (const domain of ["extensions/discord", "src/gateway", "src/commands", "src/plugins", "src/agents", "src/plugin-sdk"]) {
  const row = m.matrix.find((entry) => entry.domain === domain);
  if (row) console.log(domain, row.counts);
}
NODE
```

If HEAD or counts differ from this file, trust disk.

## Batch Rules

- One domain per batch.
- Prefer 2-8 clean files per batch.
- For infra clusters, plan first and edit only after dependencies are mapped.
- Check false gaps before editing.
- Read upstream file before editing.
- Check CoreBlow equivalent behavior before porting.
- Check every import/dependency before editing.
- Replace `openclaw/plugin-sdk/*` with `coreblow/plugin-sdk/*` only when the CoreBlow subpath exists.
- Adapt OpenClaw/OpenClawConfig naming to CoreBlow/CoreBlowConfig where appropriate.
- Do not introduce public `OpenClaw`, `clawhub`, `clawbot`, or `acpx` names unless explicitly required for compatibility.
- Do not use `git commit --no-verify`.
- Use `SKIP=pnpm-audit-prod` only if the known production audit issue is the only commit blocker.

## Required Gates

Before commit:

```bash
git diff --check
corepack pnpm exec tsgo --noEmit
corepack pnpm check
corepack pnpm audit:parity:matrix
```

Include `scripts/parity/openclaw-parity-matrix.json` in the commit if it changes.

## Report Format

Report final batch summary only:

```text
Commit:
Files changed:
Files ported:
Gap movement:
Gates run:
Blockers:
Next recommended batch:
```

## Current Next Direction

Continue `extensions/discord` with dependency-unblocking clean batches.

Good next candidates to investigate:

- `target-parsing.ts`
- `conversation-identity.ts`
- `internal/components.ts`
- `internal/embeds.ts`
- `internal/schemas.ts`
- `internal/rest-routes.ts`

Skip until dependencies are ready:

- `delivery-retry.ts` unless `internal/discord.ts` is ready
- `component-custom-id.ts` unless `internal/discord.ts` is ready
- `internal/discord.ts` if it still re-exports many missing internal modules
