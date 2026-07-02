# CoreBlow Phase 4 Remaining Implementation Plan for Claude

Purpose: finish the remaining Phase 4 OpenClaw parity work in CoreBlow using disk-backed references, CoreBlow-native architecture, batch execution, scoped tests per batch, and full gates only at landing.

## 0. Non-Negotiable Guardrails

- Work from `/Users/febrinanda/coreblow`.
- Use `/Users/febrinanda/openclaw-refs/openclaw` as the default current broad OpenClaw reference for Phase 4 parity. It is newer than `/Users/febrinanda/openclaw-main`.
- Use `/Users/febrinanda/openclaw-main` only when app/native CLI behavior is specifically needed.
- Use `/Users/febrinanda/openclaw-refs/clawhub` only for registry/web/package marketplace behavior.
- Treat reference trees as valid disk source even if `git -C <ref> ...` says `not a git repository`.
- Preserve CoreBlow-native public names: `CoreBlow`, `coreblow`, `corebot`, `corehub`, `acp`.
- Do not introduce public `clawbot`, `clawhub`, or `acpx` names unless Febri explicitly asks for compatibility aliases.
- Do not copy OpenClaw code blindly. Read CoreBlow target first, read OpenClaw counterpart second, then translate behavior into CoreBlow OOP/DI boundaries.
- Do not edit security-focused CODEOWNERS surfaces as drive-by cleanup.
- Do not change versions, publish, push, switch branches, stash, or alter worktrees unless Febri explicitly asks.
- Use scoped commits. `scripts/committer` is currently absent, so use manual scoped `git add` + `SKIP=pnpm-audit-prod git commit ...`.
- Known baselines are not regressions: 115 circular dependency pairs, 38 pre-existing TSC errors, 1 pending group-policy contract suite, migration-debt test stubs.

## 1. Verified Disk Snapshot on 2026-06-26

Commands run from `/Users/febrinanda/coreblow`:

```sh
git status --short
git log -6 --oneline
pnpm audit:parity:matrix
```

Current HEAD:

```text
9f34f80f6 P4 parity: add core runtime SDK facades
f55106380 P4 parity: add command and config SDK facades
3653d1051 P4 parity: add plugin runtime utility facades
f5e7de8c2 P4 parity: add channel runtime SDK facades
9b4554045 P4 parity: add plugin SDK utility runtimes
86a8f6e2e P4 parity: add approval SDK runtimes
```

Current parity matrix after refresh:

```text
rows=272
partial=29
intentionally_different=48
done=195
```

Current summary from `scripts/parity/openclaw-parity-matrix.json`:

```text
cb_source_files=7926
oc_source_files=8443
source_parity_both=6128
source_cb_exclusive=1798
source_missing_from_cb=2315
test_files_cb=4869
test_files_oc=5246
tests_both_covered=3455
tests_gap_oc_has_cb_missing=1546
tests_cb_exclusive=1356
export_files_with_gaps=71
test_scenario_files_with_gaps=40
```

Reference package versions found on disk:

```text
/Users/febrinanda/openclaw-main/package.json: openclaw 2026.3.27
/Users/febrinanda/openclaw-refs/openclaw/package.json: openclaw 2026.5.17
/Users/febrinanda/openclaw-refs/clawhub/package.json: clawhub
```

## 2. Remaining Partial Domains

Use this as prioritization, but refresh before every new batch because counts can change.

```text
P0 src/agents             srcGap=388 testGap=316
P0 src/plugins            srcGap=207 testGap=139
P0 extensions/discord     srcGap=209 testGap=50
P0 src/commands           srcGap=141 testGap=113
P0 src/plugin-sdk         srcGap=151 testGap=61
P1 src/auto-reply         srcGap=100 testGap=79
P1 src/gateway            srcGap=76  testGap=90
P1 extensions/telegram    srcGap=101 testGap=55
P1 src/cli                srcGap=76  testGap=52
P1 src/infra              srcGap=80  testGap=46
P1 extensions/whatsapp    srcGap=78  testGap=41
P1 extensions/slack       srcGap=70  testGap=39
P1 extensions/matrix      srcGap=71  testGap=35
P1 extensions/browser     srcGap=53  testGap=37
P1 extensions/memory-core srcGap=42  testGap=38
P1 src/config             srcGap=50  testGap=30
P2 src/channels           srcGap=48  testGap=30
P2 src/cron               srcGap=40  testGap=30
P2 extensions/feishu      srcGap=51  testGap=18
P2 src/secrets            srcGap=31  testGap=38
P2 extensions/imessage    srcGap=35  testGap=28
P2 extensions/msteams     srcGap=31  testGap=27
P2 src/security           srcGap=15  testGap=34
P2 extensions/xai         srcGap=28  testGap=17
P2 extensions/google      srcGap=26  testGap=16
P2 src/logging            srcGap=19  testGap=16
P2 src/shared             srcGap=24  testGap=10
P2 src/media              srcGap=16  testGap=16
P2 extensions/openai      srcGap=19  testGap=11
```

## 3. Phase 4 Execution Strategy

Work in large but coherent batches. Do not try to close all domains in one patch.

Recommended order:

1. Finish `src/plugin-sdk` P0 facade/runtime gaps first because many extension/provider rows depend on stable SDK entrypoints.
2. Close `src/plugins` P0 loader/runtime/registration gaps that are unlocked by SDK work.
3. Close `src/commands` P0 command-helper and CLI-facing parity gaps that depend on plugin surfaces.
4. Close `src/agents` P0 in sub-batches only after SDK/plugins command contracts are stable.
5. Close `extensions/discord` P0 after channel/runtime SDK surfaces are stable.
6. Move through P1 domains by dependency order: `src/config`, `src/infra`, `src/auto-reply`, `src/gateway`, then messaging extensions.
7. Close P2 domains last, unless a P2 helper is required by a P0/P1 batch.

Each batch should aim to reduce one matrix row or one tightly connected family inside a row. Avoid cross-domain patches unless imports force it.

## 4. Standard Batch Loop

Start every batch with:

```sh
git status --short
pnpm audit:parity:matrix
node scripts/audit-oc-parity.mjs --oc-root=/Users/febrinanda/openclaw-refs/openclaw --module=<domain> --json > /tmp/coreblow-<domain-slug>-audit.json
```

Inspect the target row:

```sh
DOMAIN=src/plugin-sdk node - <<'NODE'
const m=require('./scripts/parity/openclaw-parity-matrix.json');
const row=m.matrix.find(r=>r.domain===process.env.DOMAIN);
console.log(JSON.stringify(row,null,2));
NODE
```

For each candidate file:

1. Read existing CoreBlow file or nearest equivalent.
2. Read OpenClaw counterpart from `/Users/febrinanda/openclaw-refs/openclaw`.
3. Check actual local exports with `rg -n "^export "`.
4. Implement CoreBlow-native behavior. Do not export symbols that do not exist unless properly implemented.
5. Add/update package exports and `scripts/lib/plugin-sdk-entrypoints.json` when adding public `coreblow/plugin-sdk/*` entrypoints.
6. Add focused tests that prove the new facade/runtime behavior.

Scoped gates per batch:

```sh
pnpm test -- <new-or-touched-test-paths>
pnpm tsgo
git diff --check
pnpm check
pnpm build
pnpm audit:parity:matrix
```

Commit per coherent batch:

```sh
git status --short
git diff --stat
git diff --check
git add <exact touched files>
git diff --cached --check
SKIP=pnpm-audit-prod git commit -m "P4 parity: add <batch description>"
git status --short
```

`SKIP=pnpm-audit-prod` is expected because the commit hook currently hits a known production audit advisory.

## 5. Next Recommended Batch: `src/plugin-sdk` Runtime and Channel Facades

Why first: `src/plugin-sdk` is P0 and already has recent successful batches. Closing it further reduces public API gaps and unblocks plugin/extension work.

Current `src/plugin-sdk` matrix row:

```text
sharedSourcePaths=288
coreBlowOnlySourcePaths=118
openClawOnlySourcePaths=151
sharedTestPaths=42
coreBlowOnlyTestPaths=22
openClawTestGaps=61
```

Start with low-risk, dependency-light candidates:

```text
src/plugin-sdk/channel-route.ts
src/plugin-sdk/channel-lifecycle.core.ts
src/plugin-sdk/channel-streaming.ts
src/plugin-sdk/runtime-logger.ts
src/plugin-sdk/tool-payload.ts
src/plugin-sdk/text-autolink-runtime.ts
src/plugin-sdk/web-content-extractor.ts
src/plugin-sdk/document-extractor.ts
src/plugin-sdk/messaging-targets.ts
src/plugin-sdk/direct-dm-access.ts
```

Avoid or defer until dependencies are confirmed:

```text
src/plugin-sdk/acpx.ts
src/plugin-sdk/channel-secret-basic-runtime.ts
src/plugin-sdk/channel-secret-runtime.ts
src/plugin-sdk/channel-secret-tts-runtime.ts
src/plugin-sdk/runtime-fetch.ts
src/plugin-sdk/reply-reference.ts
src/plugin-sdk/session-visibility.ts
```

Reason for deferral: these either risk reintroducing OpenClaw public naming, depend on missing CoreBlow secret/runtime modules, or need deeper behavioral translation.

Useful inspection commands:

```sh
rg -n "^export " src/plugin-sdk src/channels src/routing src/shared src/auto-reply src/plugins
rg -n "^export " /Users/febrinanda/openclaw-refs/openclaw/src/plugin-sdk
for f in channel-route.ts channel-lifecycle.core.ts channel-streaming.ts runtime-logger.ts tool-payload.ts text-autolink-runtime.ts web-content-extractor.ts document-extractor.ts messaging-targets.ts direct-dm-access.ts; do
  test -f "src/plugin-sdk/$f" || echo "missing CB src/plugin-sdk/$f"
  test -f "/Users/febrinanda/openclaw-refs/openclaw/src/plugin-sdk/$f" && echo "OC has $f"
done
```

Expected tests for this batch:

```text
src/plugin-sdk/channel-runtime-facades.test.ts
src/plugin-sdk/content-tool-facades.test.ts
```

Keep tests narrow. Prove exported functions/types are wired to real CoreBlow behavior, not placeholder exports.

## 6. Follow-Up Batch Families

### Batch B: `src/plugin-sdk` Provider and Web Facades

Candidates:

```text
src/plugin-sdk/provider-catalog-runtime.ts
src/plugin-sdk/provider-enable-config.ts
src/plugin-sdk/provider-model-id-normalize.ts
src/plugin-sdk/provider-model-types.ts
src/plugin-sdk/provider-selection-runtime.ts
src/plugin-sdk/provider-stream-family.ts
src/plugin-sdk/provider-stream-shared.ts
src/plugin-sdk/provider-transport-runtime.ts
src/plugin-sdk/provider-web-fetch-contract.ts
src/plugin-sdk/provider-web-fetch.ts
src/plugin-sdk/provider-web-search-config-contract.ts
src/plugin-sdk/provider-web-search-contract-fields.ts
src/plugin-sdk/provider-web-search-contract.ts
```

Gate with focused provider/web SDK tests, then full batch gates.

### Batch C: `src/plugin-sdk` Test Helper and Contract Surfaces

Candidates:

```text
src/plugin-sdk/test-helpers/*
src/plugin-sdk/test-fixtures.ts
src/plugin-sdk/test-helpers.ts
src/plugin-sdk/test-node-mocks.ts
```

Only port helpers that are useful for CoreBlow tests. Mark intentionally different where OpenClaw helper names encode OpenClaw-only behavior.

### Batch D: `src/plugins` Runtime and Loader Parity

Start after SDK Batch A/B. Candidate families:

```text
src/plugins/activation-*
src/plugins/active-runtime-registry.ts
src/plugins/api-facades.ts
src/plugins/api-lifecycle.ts
src/plugins/bundled-channel-*
src/plugins/channel-*
src/plugins/config-*
```

Gate with:

```sh
pnpm test -- src/plugins/<new-tests>
pnpm tsgo
pnpm check
pnpm build
pnpm audit:parity:matrix
```

### Batch E: `src/commands` Command Helper Parity

Start after plugin loader/API facades are stable. Candidate families:

```text
src/commands/channel-setup/*
src/commands/channels/*
src/commands/auth-choice.*
src/commands/daemon-*
src/commands/commitments.ts
```

Do not change CLI branding from CoreBlow to OpenClaw.

### Batch F: `src/agents` Runtime Contracts

Break into smaller sub-batches because this row is large:

```text
auth-profile runtime contracts
agent runtime config and metadata
turn-engine parity helpers
transport stream helpers
tool/runtime contract helpers
```

Do not fight the whole row at once. The row has `srcGap=388` and `testGap=316`.

### Batch G: Extension Rows

After SDK/plugins/channel contracts are stable, address extension rows:

```text
extensions/discord
extensions/telegram
extensions/whatsapp
extensions/slack
extensions/matrix
extensions/browser
extensions/memory-core
```

For each extension:

1. Read its CoreBlow package manifest and local API barrels first.
2. Keep runtime dependencies in the extension package, not root, unless core truly uses them.
3. Avoid `workspace:*` in runtime dependencies.
4. Keep production imports on `coreblow/plugin-sdk/*` or local barrels.

## 7. Landing Gates

Run only when ready to land a complete Phase 4 tranche, not after every tiny edit:

```sh
pnpm check
pnpm test
pnpm build
pnpm audit:parity:matrix
git diff --check
```

If `pnpm test` shows the known abnormal Vitest setup duration in the thousands of seconds, stop and diagnose test setup before treating the failure list as a code regression. Capture:

```sh
npx vitest run --config vitest.unit.config.ts 2>&1 | grep "FAIL " | head -20
```

## 8. Definition of Done for Phase 4

Phase 4 can be called complete only when:

- All P0 rows are either `done` or documented as `intentionally_different` with rationale and gate.
- P1 rows required for v1.0 behavior are `done` or intentionally different.
- Remaining P2 rows are either closed or explicitly deferred with matrix notes.
- `scripts/parity/openclaw-parity-matrix.json` is refreshed.
- Scoped tests for every batch passed.
- Landing gates passed, or any failing baseline is documented as pre-existing with exact evidence.
- Worktree is clean after final commit.

## 9. Final Report Template

Use this format after each batch:

```text
Batch complete:
- Commit: <sha> <message>
- Row(s): <domain> <old counts> -> <new counts>
- Tests: <commands and pass/fail>
- Gates: tsgo/check/build/matrix <pass/fail>
- Remaining: <next recommended batch>
- Notes: <intentional differences or blockers>
```
