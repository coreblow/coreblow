---
name: coreblow-batch-verifier
description: Use after another agent commits a CoreBlow Phase 4 batch. Verifies disk state, gates, matrix counts, and returns landing-ready/not-yet/blocked.
---

# CoreBlow Batch Verifier

Use this skill after a Phase 4 batch is reported complete.

## Verify

Run:

```bash
git status --short
git log -1 --oneline
git show --stat --oneline --no-renames HEAD
git diff --check
corepack pnpm exec tsgo --noEmit
```

If the batch claims full gates, also run:

```bash
corepack pnpm check
corepack pnpm audit:parity:matrix
```

## Matrix Counts

```bash
node - <<'NODE'
const fs = require("fs");
const m = JSON.parse(fs.readFileSync("scripts/parity/openclaw-parity-matrix.json", "utf8"));
for (const domain of ["src/plugins", "src/commands", "src/gateway", "src/agents", "extensions/discord"]) {
  const row = m.matrix.find((entry) => entry.domain === domain);
  if (row) console.log(domain, row.counts);
}
NODE
```

## Verdict

Use one of:

- `landing-ready`
- `not yet`
- `blocked`

Mention current HEAD, dirty files, gate results, gap movement, and exact next step.
