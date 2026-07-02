---
name: coreblow-phase4-parity
description: CoreBlow Phase 4 OpenClaw parity workflow. Use when implementing parity batches in CoreBlow from the local OpenClaw reference.
---

# CoreBlow Phase 4 Parity

Use this skill for CoreBlow Phase 4 parity work.

## Required Context

- Repo: `/Users/febrinanda/coreblow`
- Default reference: `/Users/febrinanda/openclaw-refs/openclaw`
- Use `/Users/febrinanda/openclaw-main` only for app/native CLI behavior.
- Use `/Users/febrinanda/openclaw-refs/clawhub` only for registry/marketplace behavior.

## First Actions

Always resume from disk state, not chat memory.

Run and inspect:

```bash
pwd
git status --short
git log -1 --oneline
node -e 'const m=require("./scripts/parity/openclaw-parity-matrix.json"); for (const d of ["src/plugins","src/commands","src/gateway","src/agents","extensions/discord"]) { const r=m.matrix.find(x=>x.domain===d); console.log(d, r?.counts); }'
```

## Rules

- Work one domain per batch.
- Check false gaps before editing.
- Read upstream file before editing.
- Check CoreBlow equivalent behavior before porting.
- Check every import and dependency before editing.
- Do not blind-copy OpenClaw.
- Adapt to CoreBlow-native naming and architecture.
- Keep public names `CoreBlow`, `coreblow`, `corehub`, `corebot`, and `acp`.
- Do not introduce public `OpenClaw`, `clawhub`, `clawbot`, or `acpx` names unless explicitly required for compatibility.
- Keep `PHASE4_CLAUDE_IMPLEMENTATION_PLAN.md` untracked.
- Do not use `git commit --no-verify`.
- If the only commit blocker is the known pre-existing production audit issue, use `SKIP=pnpm-audit-prod git commit -m "..."`

## Batch Shape

Prefer coherent batches:

- Small clean batch: 2-8 small files with complete deps.
- Infra batch: one dependency cluster, planned before editing.
- False-gap audit batch: classify and document, no source churn unless needed.
- Test batch: add or adapt tests after source behavior exists.

For files over 300 lines, use chunked writes. For tiny files, do not discuss chunked-write reminders.

## Required Gates

Before commit:

```bash
git diff --check
corepack pnpm exec tsgo --noEmit
corepack pnpm check
corepack pnpm audit:parity:matrix
```

Include `scripts/parity/openclaw-parity-matrix.json` in the commit if it changes.

## Final Report

Report:

- commit hash and message
- files changed
- gap movement by domain
- gates run
- blockers or next recommended batch
