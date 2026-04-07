# Implementation Plan: FULL PARITY — Target 32,143 LOC

## Angka Sebenarnya OpenClaw (REVISED)

| Subsistem | Implementasi | Test | **Total** |
|:---|---:|---:|---:|
| Auth Profiles | 3,020 | 2,067 | **5,087** |
| Bash Registry & Tools | 4,222 | 3,390 | **7,612** |
| Subagent/Orphan | 7,744 | 11,700 | **19,444** |
| **TOTAL** | **14,986** | **17,157** | **32,143** |

---

## Gap Analysis: CoreBlow vs OpenClaw

| Subsistem | OpenClaw | CoreBlow Saat Ini | **Gap** |
|:---|---:|---:|---:|
| Auth Profiles (impl) | 3,020 | 2,419 | **-601** |
| Auth Profiles (test) | 2,067 | 503 | **-1,564** |
| Bash (impl) | 4,222 | 0 | **-4,222** |
| Bash (test) | 3,390 | 0 | **-3,390** |
| Subagent (impl) | 7,744 | 0 | **-7,744** |
| Subagent (test) | 11,700 | 0 | **-11,700** |
| **TOTAL** | **32,143** | **2,922** | **-29,221** |

---

## Fase A: Auth Profiles — CLOSE THE GAP (-2,165 LOC)

### A1: Implementasi Gap (-601 LOC)

Auth Profiles CoreBlow (2,419 LOC) vs OpenClaw (3,020 LOC). Yang kurang:

| File | LOC yang Kurang | Detail |
|:---|:---:|:---|
| `store.ts` | +108 | OpenClaw 593 vs CoreBlow 485 — missing: `loadAuthProfileStoreForSecretsRuntime()`, timing debug logging, `OPENCLAW_AUTH_STORE_READONLY` env guard, OAuth file merge (`mergeOAuthFileIntoStore`), read-only mode support |
| `usage.ts` | +411 | OpenClaw 700 vs CoreBlow 289 — missing: `resolveNextProfileWithRotation()`, `recordProfileAttempt()`, `resolveProviderProfileChain()`, `resolveApiKeyFromProfile()`, `resolveTokenFromProfile()`, profile chain fallback logic, attempt/success/failure lifecycle hooks |
| `order.ts` | +11 | OpenClaw 208 vs CoreBlow 197 — minor differences |
| `oauth.ts` | +167 | OpenClaw 482 vs CoreBlow 315 — missing: codex refresh fallback, OAuth state persistence, enterprise URL handling, multi-tenant support |
| **Subtotal** | **+601** | |

### A2: Test Gap (-1,564 LOC)

OpenClaw auth test files:

| File | LOC | Coverage |
|:---|:---:|:---|
| `credential-state.test.ts` | ~300 | Token expiry edge cases, keyRef validation, null handling |
| `display.test.ts` | ~150 | Masking, formatting all credential types |
| `oauth.test.ts` | ~400 | Token exchange, refresh flow, error handling, retries |
| `oauth.fallback-to-main-agent.test.ts` | ~200 | Main-agent OAuth inheritance |
| `oauth.openai-codex-refresh-fallback.test.ts` | ~200 | Codex-specific refresh fallback |
| `order.test.ts` | ~250 | Order resolution, alias normalization, edge cases |
| `session-override.test.ts` | ~200 | Override CRUD, expiry, pruning, concurrent sessions |
| `state-observation.test.ts` | ~150 | Event emission, listener lifecycle |
| **CoreBlow has** | **503** | **Need +1,564 more** |

#### [NEW] Test files yang perlu ditambah/expand:

| File | LOC Target | Tests Target |
|:---|:---:|:---:|
| Expand `auth-profiles.test.ts` | +500 | +30 tests (deeper edge cases) |
| `auth-oauth.test.ts` | ~400 | ~25 tests (token exchange, refresh, expiry) |
| `auth-store-persistence.test.ts` | ~350 | ~20 tests (save/load, legacy migration, cache) |
| `auth-usage-rotation.test.ts` | ~300 | ~18 tests (round-robin, chain resolution, attempt recording) |
| **Subtotal** | **+1,550** | **+93 tests** |

---

## Fase B: Bash Process Registry & Tools (-7,612 LOC)

### B1: Implementasi (4,222 LOC target)

| # | File | LOC | Fungsi |
|:---:|:---|:---:|:---|
| 1 | `bash-process-registry.ts` | 310 | ProcessSession, FinishedSession, addSession, appendOutput, drainSession, markExited, markBackgrounded, FD leak prevention, TTL sweeper |
| 2 | `bash-tools.ts` | 10 | Barrel exports |
| 3 | `bash-tools-exec.ts` | 650 | Main exec: executeBashCommand(), command parsing, env setup, timeout, output capture, signal forwarding, Docker wrapping |
| 4 | `bash-tools-exec-types.ts` | 80 | BashExecParams, BashExecResult, ExecHostMode, ApprovalState |
| 5 | `bash-tools-exec-runtime.ts` | 735 | Runtime context: CWD resolution, env injection, shell detection, timeout enforcement, process group mgmt, PTY-vs-pipe decision |
| 6 | `bash-tools-exec-host-shared.ts` | 400 | Output formatting, exit code interpretation, signal name mapping, stream merging, chunked output assembly |
| 7 | `bash-tools-exec-host-gateway.ts` | 355 | Gateway-mode exec: RPC command execution, session multiplexing, remote output streaming |
| 8 | `bash-tools-exec-host-node.ts` | 410 | Node-mode exec: child_process.spawn(), PTY allocation, pipe management, process group cleanup |
| 9 | `bash-tools-process.ts` | 665 | Poll-for-output, send-keys, supervisor mode, background job management, process group kill |
| 10 | `bash-tools-shared.ts` | 300 | Command sanitization, arg validation, CWD checks, env filtering, PATH manipulation |
| 11 | `bash-tools-exec-approval-request.ts` | 245 | Dangerous command detection, approval prompt, approval state tracking, auto-approve rules |
| 12 | `bash-tools-exec-approval-followup.ts` | 60 | Post-approval followup message |
| | **Subtotal** | **4,220** | |

### B2: Tests (3,390 LOC target)

| File | LOC Target | Tests |
|:---|:---:|:---:|
| `bash-registry.test.ts` | 500 | Session lifecycle, output buffering, FD cleanup, TTL sweeper |
| `bash-exec.test.ts` | 600 | Command parsing, env setup, timeout, Docker wrapping |
| `bash-exec-runtime.test.ts` | 500 | CWD resolution, env injection, shell detection, PTY decision |
| `bash-exec-approval.test.ts` | 400 | Dangerous command detection, approval flow, auto-approve |
| `bash-exec-path.test.ts` | 300 | PATH manipulation, executable resolution |
| `bash-process-supervisor.test.ts` | 400 | Poll-for-output, send-keys, background jobs |
| `bash-shared.test.ts` | 350 | Sanitization, validation, env filtering |
| `bash-pty.test.ts` | 340 | PTY allocation, fallback, cleanup |
| **Subtotal** | **3,390** | **~120 tests** |

---

## Fase C: Subagent Registry & Orphan Recovery (-19,444 LOC)

### C1: Implementasi (7,744 LOC target)

| # | File | LOC | Fungsi |
|:---:|:---|:---:|:---|
| 1 | `subagent-registry.ts` | 730 | Main registry, lifecycle listener, sweeper, init, restore |
| 2 | `subagent-registry-types.ts` | 65 | SubagentRunRecord type |
| 3 | `subagent-registry-memory.ts` | 5 | Singleton Map<string, SubagentRunRecord> |
| 4 | `subagent-registry-state.ts` | 60 | Persist/restore to/from disk |
| 5 | `subagent-registry-store.ts` | 130 | Store path resolution, atomic writes |
| 6 | `subagent-registry-helpers.ts` | 355 | Orphan detection, reconciliation, session status |
| 7 | `subagent-registry-queries.ts` | 280 | List/count/find runs by various criteria |
| 8 | `subagent-registry-lifecycle.ts` | 500 | Lifecycle controller: start/end transitions |
| 9 | `subagent-registry-run-manager.ts` | 445 | Run manager: waitForCompletion, steer restart |
| 10 | `subagent-registry-completion.ts` | 100 | Emit ended hook, resolve outcome |
| 11 | `subagent-registry-cleanup.ts` | 75 | Archive scheduling, attachments purge |
| 12 | `subagent-registry-read.ts` | 125 | Read-only run queries |
| 13 | `subagent-registry-runtime.ts` | 10 | Runtime init hook |
| 14 | `subagent-lifecycle-events.ts` | 50 | COMPLETE, ERROR, KILLED event types |
| 15 | `subagent-spawn.ts` | 850 | Session creation, tool injection, workspace setup |
| 16 | `subagent-control.ts` | 995 | Kill/steer/list, status queries, timeout, permissions |
| 17 | `subagent-announce.ts` | 640 | Completion formatting, outcome, summary generation |
| 18 | `subagent-announce-delivery.ts` | 580 | Message routing, retry w/ backoff, idempotency |
| 19 | `subagent-announce-dispatch.ts` | 105 | Announce routing to correct session/channel |
| 20 | `subagent-announce-output.ts` | 515 | Frozen result, transcript reading, summarization |
| 21 | `subagent-announce-queue.ts` | 240 | FIFO ordering, dedup, retry scheduling |
| 22 | `subagent-capabilities.ts` | 155 | Tool/model/workspace capability detection |
| 23 | `subagent-depth.ts` | 175 | Max nesting depth, recursion prevention |
| 24 | `subagent-attachments.ts` | 245 | File passing parent/child, cleanup, retention |
| 25 | `subagent-orphan-recovery.ts` | 315 | Orphan scan, resume, retry w/ backoff |
| 26 | `subagent-gateway.ts` | 10 | Gateway test helper |
| | **Subtotal** | **7,785** | |

### C2: Tests (11,700 LOC target)

| File | LOC Target | Tests |
|:---|:---:|:---:|
| `subagent-registry.test.ts` | 800 | Registry lifecycle, persist/restore, sweeper |
| `subagent-registry-lifecycle.test.ts` | 600 | Start/end transitions, retry, grace period |
| `subagent-registry-queries.test.ts` | 500 | List/count/find operations |
| `subagent-registry-cleanup.test.ts` | 400 | Archive, purge, attachments |
| `subagent-spawn.test.ts` | 700 | Session creation, tool injection, workspace |
| `subagent-control.test.ts` | 800 | Kill/steer/list, permissions, concurrent limits |
| `subagent-announce.test.ts` | 900 | Formatting, outcome resolution, delivery |
| `subagent-announce-delivery.test.ts` | 700 | Routing, retry, idempotency |
| `subagent-announce-output.test.ts` | 600 | Frozen result, transcript, summarization |
| `subagent-depth.test.ts` | 400 | Nesting depth, recursion prevention |
| `subagent-capabilities.test.ts` | 350 | Capability detection |
| `subagent-attachments.test.ts` | 400 | File passing, cleanup |
| `subagent-orphan-recovery.test.ts` | 500 | Scan, resume, retry, idempotent recovery |
| `subagent-registry.e2e.test.ts` | 1500 | End-to-end integration (nested, archive, steer-restart, lifecycle-retry-grace, persistence, context-engine) |
| `subagent-announce-queue.test.ts` | 450 | Queue ordering, dedup, scheduling |
| **Subtotal** | **~11,600** | **~350 tests** |

---

## Ringkasan Target FINAL

| Subsistem | Impl LOC | Test LOC | **Total** | vs OpenClaw |
|:---|---:|---:|---:|:---:|
| Auth Profiles | 3,020 | 2,067 | **5,087** | ≈5,087 ✅ |
| Bash Registry | 4,220 | 3,390 | **7,610** | ≈7,612 ✅ |
| Subagent/Orphan | 7,785 | 11,600 | **19,385** | ≈19,444 ✅ |
| **TOTAL** | **15,025** | **17,057** | **32,082** | ≈**32,143** ✅ |

## Status Saat Ini

| Subsistem | Status | Impl | Test | Total | Gap |
|:---|:---:|---:|---:|---:|---:|
| Auth Profiles | 🟡 50% | 2,419 / 3,020 | 503 / 2,067 | 2,922 / 5,087 | **-2,165** |
| Bash Registry | 🔴 0% | 0 / 4,222 | 0 / 3,390 | 0 / 7,612 | **-7,612** |
| Subagent/Orphan | 🔴 0% | 0 / 7,744 | 0 / 11,700 | 0 / 19,444 | **-19,444** |
| **TOTAL** | **9%** | **2,419** | **503** | **2,922 / 32,143** | **-29,221** |

## Execution Order

1. **Fase A2**: Close Auth Profiles gap (+2,165 LOC)
2. **Fase B1**: Bash impl files (+4,220 LOC)
3. **Fase B2**: Bash tests (+3,390 LOC)
4. **Fase C1**: Subagent impl files (+7,785 LOC)
5. **Fase C2**: Subagent tests (+11,600 LOC)

> [!IMPORTANT]
> Total sisa: **~29,221 LOC** yang harus ditulis untuk mencapai paritas 100% dengan OpenClaw.
