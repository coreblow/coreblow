---
name: coreblow-phase4-parity
description: Use for CoreBlow Phase 4 OpenClaw parity implementation. Enforces disk-state resume, parity matrix checks, false-gap checks, CoreBlow-native naming, gates, and commit rules.
---

# CoreBlow Phase 4 Parity

Use this skill for CoreBlow Phase 4 parity batches.

## Context

- Repo: `/Users/febrinanda/coreblow`
- Default reference: `/Users/febrinanda/openclaw-refs/openclaw`
- Use `/Users/febrinanda/openclaw-main` only for app/native CLI behavior.
- Use `/Users/febrinanda/openclaw-refs/clawhub` only for registry/marketplace behavior.
- Allowed untracked local files:
  - `.claude/`
  - `.agents/`
  - `PHASE4_CLAUDE_IMPLEMENTATION_PLAN.md`

## First Actions

Always resume from disk state, not chat memory.

Run:

```bash
pwd
git status --short
git log -1 --oneline
node - <<'NODE'
const fs = require("fs");
const m = JSON.parse(fs.readFileSync("scripts/parity/openclaw-parity-matrix.json", "utf8"));
for (const domain of ["src/plugins", "src/commands", "src/gateway", "src/agents", "extensions/discord"]) {
  const row = m.matrix.find((entry) => entry.domain === domain);
  if (row) console.log(domain, row.counts);
}
NODE
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
- Do not edit or commit `.claude/`, `.agents/`, or `PHASE4_CLAUDE_IMPLEMENTATION_PLAN.md` unless explicitly asked.
- Do not use `git commit --no-verify`.
- If the only commit blocker is the known pre-existing production audit issue, use `SKIP=pnpm-audit-prod git commit -m "..."`

## Batch Shape

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

Report only:

- commit hash and message
- files changed
- gap movement by domain
- gates run
- blockers or next recommended batch
