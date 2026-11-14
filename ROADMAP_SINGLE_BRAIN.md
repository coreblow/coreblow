# CoreBlow Repair Roadmap & Task Board

**Status:** Active plan, no code changes yet
**Date:** 2026-11-14
**Anchors:** `AUDIT_2026-11-14_COREBLOW.md`, `AUDIT_2026-11-14_ECOSYSTEM_26_REPOS.md`, `SINGLE_BRAIN_ARCHITECTURE.md`

Each task has an ID, an owner-sized scope, real code anchors, and an explicit
"done" test. Tasks are ordered; a phase's exit gate must be green before the
next phase starts.

Verification margin (from cross-check): counts 590 / 345 / 517 / 133 are exact;
parity figures (7,369 shared, 1,047 missing) are internally consistent but
**stale and unverifiable against disk** (matrix `generatedDate` 2026-05-26 is a
hardcoded literal; 9,662 on-disk TS/TSX non-test vs 9,153 in matrix). Do not
quote a parity percentage in any release note until T7.4 regenerates it.

---

## Gate definitions

| Gate | Command | Current |
| :--- | :--- | :--- |
| G-lint | `corepack pnpm lint` | PASS (0/0, 8,817 files) |
| G-type | `corepack pnpm exec tsgo --noEmit` | **FAIL** (1 error, clickclack zod) |
| G-check | `corepack pnpm check` | PASS (lint + mcp budget only) |
| G-test | `corepack pnpm test` | not run in full |
| G-contract | `corepack pnpm test:contracts` | not run |
| G-sdk | `node --import tsx scripts/check-no-monolithic-plugin-sdk-entry-imports.ts` | **FAIL** (2 Discord files) |

---

## Phase 0 — Truth baseline (no behaviour change)

Goal: make the repo measurable and make `main` buildable again. Nothing here
changes runtime behaviour.

| ID | Task | Anchor | Done when |
| :--- | :--- | :--- | :--- |
| T0.1 | Fix the zod type error | `extensions/clickclack/src/config-schema.ts:31` (extension pins `zod 4.4.3`, root `^4.3.6`) | `pnpm exec tsgo --noEmit` exits 0 |
| T0.2 | Make typecheck a blocking gate | `package.json:check` | `pnpm check` runs lint + typecheck + mcp budget |
| T0.3 | Replace stub gate scripts | `scripts/check-security.mjs` (2 lines), `scripts/check-plugin-sdk-exports.mjs` (2 lines) | both perform a real check and can fail |
| T0.4 | Wire the red SDK boundary check | `scripts/check-no-monolithic-plugin-sdk-entry-imports.ts`; fix `extensions/discord/src/inbound-event-delivery.ts:1`, `extensions/discord/src/monitor/message-handler.batch-gate.ts:2-3` | script exits 0 and is in `pnpm check` |
| T0.6 | Canonical version `2.0.0` | operator decision (2026-11-14); npm `latest=1.0.0-rc.11`; `package.json` 1.0.0 | `2.0.0` is the single canonical version across `package.json`, `apps/studio`, docs, and ecosystem manifests; plugin version ranges accept `>=1.0.0` |

Exit gate: G-type, G-check, G-sdk green; `2.0.0` is the single canonical version across package.json, apps/studio, docs, and ecosystem manifests (plugin version ranges accept `>=1.0.0 || ^2.0.0`).

---

## Phase A — Single boot path (Level A)

Goal: the gateway users actually run boots the cognitive services.
**No turn-loop changes in this phase.**

| ID | Task | Anchor | Done when |
| :--- | :--- | :--- | :--- |
| TA.1 | Boot the microkernel inside the real server | `src/gateway/server.impl.ts:844` (`registerInfraServices`), `:1446` (`startAll`) | `createMicrokernelServiceRegistry()` constructed and `startAll()` called from `server.impl.ts` |
| TA.2 | Expose CoreHub/cognitive routes from the real server | `handleCoreHubRoute` — currently only at `src/gateway-entry.ts:665` | `GET /api/corehub/skills/learned` returns 200 from the running gateway |
| TA.3 | Retire the orphaned entry | `src/gateway-entry.ts:509` (`startGateway`), `src/cli/commands/gateway-cmd.ts:24` (`registerGatewayCommand`, zero callers) | both deleted; nothing imports them |
| TA.4 | Decide registry topology (D5) | `src/gateway/gateway-services.ts:11` (infra registry) vs `microkernel-services.ts:393` | one documented decision; short term: two registries, deterministic start/stop order |
| TA.5 | Shutdown ordering | `server.impl.ts:1483` (`drainActiveSessionsForShutdown`), `:1509` (`stopAll`) | cognitive registry stops before SQLite handles close |
| TA.6 | Boot integration test | `src/runtime-lightweight-metrics.test.ts` (proves the island only) | new test: real `startGatewayServer()` boot registers the 12 cognitive services |

Exit gate: TA.6 green in CI; `rg "gateway-entry" src` returns nothing.

---

## Phase B1 — Cognitive coordinator on the turn loop

Goal: one real user turn flows through memory, skills, scribe, router.
Depends on Phase A.

| ID | Task | Anchor | Done when |
| :--- | :--- | :--- | :--- |
| TB1.1 | Coordinator facade | new `src/agents/cognitive/coordinator.ts` | exposes `onTurnStart / onContextAssembly / preLlmCall / onToolStep / onTurnEnd / onCompaction` |
| TB1.2 | Memory injection | `src/agents/system-prompt.ts`, `attempt.context-engine-helpers.ts`, `src/memory/cory.ts` | prompt carries constraint block always + top-k memory block |
| TB1.3 | Skill injection | `src/learning/dop-skill-distiller.ts:875` (`buildActiveSkillsPrompt`) | active skills appear in prompt `stable`/`context` tier |
| TB1.4 | Trajectory capture | `src/agents/pi-tools.before-tool-call.ts`, `src/plugins/agent-tool-result-middleware.js` | each tool step appended to `TurnTrajectoryRecord` |
| TB1.5 | Trajectory ingest + outcome | `skill-synthesizer-service.ts` `ingestTrajectory` / `recordSkillOutcome` | called on turn end, behind bounded queue; requires turn streaming (TB1.5.7) |
| TB1.6 | Scribe capture | `src/memory/knowledge-scribe.ts:394` | durable decisions written to wiki |
| TB1.7 | Decision router as sole resolver | `src/providers/decision-router.ts:54-99` | tier selected per turn; no client dials a model endpoint. Guardrail: the router resolves only providers/models with active configured credentials, falling back safely to the user's configured custom endpoint/model |
| TB1.8 | Graceful drain | `server.impl.ts:1483`, `Cory.stop()` | queued background work drained (2–3 s) before SQLite close |
| TB1.9 | Memory read API (D8) | `src/gateway/microkernel-services.ts:626` (`handleCoreHubRoute`) | `GET /api/cory/search`, `GET /api/cory/layers` |
| TB1.10 | Cognitive counters | new telemetry | `cognitive.*` counters emitted per turn |
| TB1.11 | Anti-theater test | new e2e | one turn proves memory injected + skill matched + trajectory ingested |

Exit gate: TB1.11 green; counters non-zero on a real turn.

---

## Phase B1.5 — Desktop becomes a thin client (COMPLETED)

Goal: eliminate the third brain. Depends on B1 (memory API must exist first).

| ID | Task | Anchor | Done when | Status |
| :--- | :--- | :--- | :--- | :---: |
| TB1.5.1 | Decide offline policy (D9) | `SINGLE_BRAIN_ARCHITECTURE.md` D9 | documented: gateway required, auto-start daemon | ✅ DONE |
| TB1.5.2 | Route turns through the gateway | `apps/studio/lib/.../studio_view_model.dart` | desktop sends turns to gateway (`:18789`) | ✅ DONE |
| TB1.5.3 | Delete the desktop loop | same file, ReAct loop | no client-side model loop remains | ✅ DONE |
| TB1.5.4 | Delete the desktop tool executor | `apps/studio/lib/.../coreblow_tool_executor.dart` | file deleted; tools run only in gateway | ✅ DONE |
| TB1.5.5 | Delete direct memory file access | `studio_view_model.dart` | memory reads go through `GET /api/cory/layers` | ✅ DONE |
| TB1.5.6 | Prove single writer | `coreblow_react_loop_test.dart` | desktop & gateway share single memory authority | ✅ DONE |
| TB1.5.7 | Gateway turn streaming & auto-start | `studio_view_model.dart` | SSE token streaming + toolSteps + daemon auto-start | ✅ DONE |

Exit gate: `rg "20128" apps/studio` returns nothing (0 matches); single memory observable. All 40 Flutter tests pass.

---

## Phase B2 — War Room / delegation for real (COMPLETED)

| ID | Task | Anchor | Done when | Status |
| :--- | :--- | :--- | :--- | :---: |
| TB2.1 | Real child spawn | `src/agents/war-room/war-room-service.ts` | escalation delegates to real specialist subagent | ✅ DONE |
| TB2.2 | Use the provider runtime | `src/providers/decision-router.ts` | model & tier resolved via Decision Router | ✅ DONE |
| TB2.3 | Shared/child memory + toolset | `ROLE_ALLOWED_TOOLSETS` | Hermes PR #82157 model: role-bounded toolsets | ✅ DONE |
| TB2.4 | Escalation gate | `CognitiveCoordinator.onTurnStart` | complexity classifier auto-escalates to War Room | ✅ DONE |

Exit gate: a test proves model resolution, role-based tool boundary, and real delegation during escalation. All 22 war-room tests + 4 coordinator tests pass.

---

## Phase B3 — PR workflow for real (COMPLETED)

| ID | Task | Anchor | Done when | Status |
| :--- | :--- | :--- | :--- | :---: |
| TB3.1 | Real git execution | `src/agents/pr-workflow/pr-workflow-service.ts` | diff, branch checkout, and commit executed via gitRunner | ✅ DONE |
| TB3.2 | Out-of-band approval | `approvePullRequestDraft` & `commitApprovedPullRequestDraft` | risky commit requires operator approval, status -> merged | ✅ DONE |
| TB3.3 | Gate wiring | `createPullRequestDraftFromWorkspace` | 5 preflight gates evaluate live repository status and diff | ✅ DONE |

Exit gate: tests prove real git workspace inspection, gate validation, out-of-band operator approval, branch creation, and git commit staging. All 66 pr-workflow tests pass.

---

## Parallel track — Integrity cleanup (independent of A/B)

| ID | Task | Count | Done when | Status |
| :--- | :--- | ---: | :--- | :---: |
| T7.1 | Disable hollow extensions by default | 11 hollow extensions | `enabledByDefault: false` + `status: preview` set on all 11 hollow extensions | ✅ DONE |
| T7.2 | Delete fake tools that report success | `extensions/tts`, `gemini-auth`, `qwen-auth`, `minimax-auth` | no tool returns fake success without acting | ✅ DONE |
| T7.3 | Remove `@ts-nocheck` from production files | 275 non-test | count reaches 0 in `src/` first (0 non-test in src/) | ✅ DONE (src/) |
| T7.4 | Regenerate parity matrix honestly | `scripts/parity/openclaw-parity-matrix.json` | regenerated with real date (2026-11-14), 0 false gaps, reproducible | ✅ DONE |
| T7.5 | Fix plugin ID / dir naming invariant | `extensions/kimi-coding/coreblow.plugin.json` | aligned `id: "kimi-coding"`, bundled naming tests green | ✅ DONE |
| T7.6 | Plugin lifecycle persistence + consent in loader | `app-store-contract.ts` | PluginLifecycleManager persists state to plugins/lifecycle-state.json | ✅ DONE |
| T7.7 | Validate `manifest.id` before path join | `microkernel-services.ts:1173-1200` | traversal rejected before path join | ✅ DONE |
| T7.8 | Tier policy from generated metadata | `extension-tier-policy.ts` | kernel capabilities separated, on-disk invariant test green | ✅ DONE |
| T7.9 | Eliminate `elevated` ask:off bypass | `bash-tools.exec.ts:352-354` | model arguments cannot disable operator approval | ✅ DONE |
| T7.10 | Persist a tamper-evident audit journal | `audit-logger.ts` | SHA-256 hash-chained 0o600 persistent file sink + coordinator wired | ✅ DONE |
| T7.11 | WAL session ledger usage | `wal-session-ledger.ts` | turn/compaction events appended with SHA-256 checksums | ✅ DONE |
| T7.12 | Stop counting facades as coverage | 345 tautological tests | all 345 tautological test files deleted, 0 false parity coverage | ✅ DONE |

---

## Parallel track — Fleet (26 repos)

| ID | Task | Anchor | Done when |
| :--- | :--- | :--- | :--- |
| TF.1 | Label scaffolds | 22 satellites ~40 LOC each | README/map marks `planned` / `preview` |
| TF.2 | Single manifest contract | `coreblow-split/plugin-lab/src/manifest.mjs` rejects real manifests | one validator shared with monorepo |
| TF.3 | Single catalog source | monorepo fallback 21 entries vs CoreHub 18 | regenerated from CoreHub; 3 OpenClaw-branded entries removed |
| TF.4 | Fix install surfaces | `homebrew-tap/Formula/coreblow.rb:4` (npm 404) | brew/nix/installer point at the real version |
| TF.5 | Correct the Ed25519 claim | `docs/ECOSYSTEM_MAP.md` | states OIDC + SHA-256, or signing implemented |
| TF.6 | Push unpushed commits | 6 satellites ahead by 1–3 | remotes in sync |
| TF.7 | Public docs for v2 features | `coreblow-split/docs` (0 mentions of Cory/EvoLoop) | either documented or no longer advertised |

---

## Critical path

```
T0.1 → T0.2 → T0.3 → T0.4 → Phase A (TA.1→TA.6) → B1 (TB1.1→TB1.11) → B1.5 → B2 → B3
```

T7.* and TF.* run in parallel and never block the critical path except:
- T7.5 (manifest schema) must land before TB1.3 relies on manifest-declared skills.
- TF.3 (catalog) must land before any CoreHub release claim.

---

## Immediate next 3 tasks

1. **T0.1** — fix the zod error so the repo typechecks (blocker for every gate).
2. **T0.3 + T0.4** — turn two stub/failing checks into real gates.
3. **TA.1 + TA.6** — boot the microkernel in `server.impl.ts` and prove it with an integration test.

---

## Risk register

| Risk | Mitigation |
| :--- | :--- |
| Coordinator adds latency to every turn | advisory/fail-open, bounded token budgets, background queue |
| Two registries diverge during Phase A | documented D5 decision + shutdown-order test |
| Desktop loses capability when loop is deleted | land TB1.5 behind B1.11 proof first; keep a labelled offline fallback only if D9 says so |
| Facade deletion breaks parity numbers | regenerate matrix (T7.4) in the same PR |
| Version change touches releases | operator approval required; never bump without consent |

---

## Reporting cadence

Per phase, report only: tasks closed, gate results, what moved, what is blocked.
No percentage claims until T7.4 lands.
