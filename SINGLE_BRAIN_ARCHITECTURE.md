# Single-Brain Architecture — Decision Record

**Status:** Accepted direction (pending sign-off on open decisions D5–D9)
**Date:** 2026-11-14
**Scope:** CoreBlow monorepo (`src/` + `apps/studio/`)

This document records the decision to collapse CoreBlow's three divergent
cognitive centers into one. It consolidates three independent analyses:
the repository audit, the desktop/gateway split review, and the
"platform-agnostic core" pattern used by the reference self-improving agent
architecture.

---

## 1. Problem — Split-Brain Syndrome

CoreBlow currently has **three centers of logic**, not one:

| # | Center | Code | What it does | Wired to user traffic? |
| :-: | :--- | :--- | :--- | :---: |
| 1 | Legacy turn engine | `src/agents/pi-embedded-runner/run.ts` | chat + tool loop; used by `src/gateway/server.impl.ts` (CLI, Docker, channels) | **Yes** |
| 2 | Sovereign microkernel | `src/gateway/microkernel-services.ts` + `src/gateway-entry.ts` | Cory, EvoLoop, War Room, Scribe, PR, decision router | **No** (orphaned entry) |
| 3 | Desktop loop | `apps/studio/` (`studio_view_model.dart`, `coreblow_tool_executor.dart`) | own ReAct loop, own tool executor, direct file access | **Yes** (desktop only) |

### 1.1 Precise nature of the memory split

The desktop does **not** keep a separate memory database. It reads and seeds
the same `~/.coreblow/memory/*.md` files that Cory owns (`USER.md`,
`MEMORY.md`, `CONSTRAINTS.md`), and keeps only UI state in
`~/.coreblow/studio-state.json`.

The split is therefore **subtler and more dangerous than "two stores"**:

1. Desktop writes to `MEMORY.md` directly, **bypassing Cory's SQLite/BM25
   index** — so agent recall can silently disagree with the files on disk.
2. Desktop runs its own model loop to a custom endpoint
   (`127.0.0.1:20128/v1/chat/completions`), so decisions diverge even when
   files are shared.
3. Desktop has its own `readFile`/`writeFile`/`patchFile` executor that
   **bypasses gateway approval, sandbox, and audit**.

### 1.2 Root cause (verified, not speculative)

- `src/gateway-entry.ts:530` is the intended unified boot path (microkernel +
  legacy server + channels). Its only caller,
  `src/cli/commands/gateway-cmd.ts:24` (`registerGatewayCommand`), is **never
  invoked**.
- The CLI gateway command was re-wired during the subcommand refactor to
  `src/cli/gateway-cli/run.ts` → `startGatewayServer`
  (`src/gateway/server.impl.ts`), skipping `startGateway` entirely.
- The cognitive services were built as self-contained `GatewayService`s with
  HTTP/MCP surfaces and unit tests, but the **turn-integration seam** (memory
  injection, trajectory ingest, skill injection) was never built.

---

## 2. Target — one brain, many thin clients

```
 [Studio macOS]   [Web Cockpit]   [Telegram / Discord / CLI / ACP]
  (thin client)    (thin client)          (channel adapters)
        │                │                        │
        └────────────────┼────────────────────────┘
                         ▼
        ┌───────────────────────────────────────────────┐
        │  ONE GATEWAY  (src/gateway/server.impl.ts)     │
        │           │                                    │
        │           ▼                                    │
        │  ONE TURN ENGINE (pi-embedded-runner/attempt.ts)│
        │           │                                    │
        │           ▼                                    │
        │  ONE COGNITIVE COORDINATOR                      │
        │   Cory · EvoLoop · Decision Router             │
        │   Knowledge Scribe · War Room · PR Workflow    │
        └───────────────────────────────────────────────┘
```

The pattern mirrors the reference architecture's stated principle:
**one core serves every entry point; platform differences live in the entry
point, not the agent.** The same applies to the prompt system: an ordered
`stable → context → volatile` tier structure, where `stable`
(identity/tools/skills) never mutates mid-turn.

---

## 3. The decision

Make the gateway the single brain. Every surface — desktop, web, channels,
CLI, ACP — becomes a thin client that sends a turn to the gateway and renders
the reply.

### Phase ordering (each depends on the previous)

| Phase | Work | Depends on | Risk |
| :--- | :--- | :--- | :---: |
| **A** | Boot `createMicrokernelServiceRegistry()` in `server.impl.ts`; wire `handleCoreHubRoute`; retire `gateway-entry.ts` + `gateway-cmd.ts`; add boot-integration test | — | Low |
| **B1** | Add `CognitiveCoordinator` to the turn loop (memory/skill injection, trajectory ingest, scribe, decision router); add memory read API; graceful drain | A | Low |
| **B1.5** | Demote `apps/studio/` to a thin client: delete its ReAct loop + `coreblow_tool_executor.dart` + direct file reads; route turns through the gateway | B1 | Medium |
| **B2** | War Room escalation + real subagent spawn (shared/child memory + per-child toolset) | B1 | Medium |
| **B3** | PR workflow: real git execution + out-of-band approval | B2 | Medium-high |

### Non-negotiable invariants

1. **Single memory writer.** Cory is the only writer of `~/.coreblow/memory`.
   All clients read/write via gateway API, never via direct file access.
2. **Advisory, not blocking.** Any cognitive service failure is fail-open
   (skip + counter), never a turn failure.
3. **Prompt tiers.** `stable` (identity/tools/skills) → `context` (files) →
   `volatile` (memory/profile/timestamp). `stable` never mutates mid-turn.
4. **Graceful drain.** Async `onTurnEnd` work (`ingestTrajectory`, scribe) is
   queued and drained (2–3 s timeout) before `server.impl` closes and before
   Cory shuts down its SQLite connection.
5. **Measurable.** `cognitive.*` counters plus one end-to-end test proving a
   real turn flows through the coordinator — the anti-"green but never runs"
   gate.
6. **Single provider resolver.** The decision router resolves models for every
   entry point; no client dials a model endpoint directly.
7. **Subagents are children.** War Room/delegation spawns child agents with
   shared or per-child memory + toolset boundaries; never a parallel loop.

---

## 4. Open decisions (defaults recommended)

| ID | Question | Recommended default |
| :--- | :--- | :--- |
| D5 | Level A: run infra registry + cognitive registry side by side, or merge into one `ServiceRegistry`? | Side by side first (safer); merge later |
| D6 | Desktop short-term: keep its loop but use gateway memory API, or migrate its loop to the gateway now? | Migrate the loop now (B1.5), no interim second loop |
| D7 | Canonical agent-turn endpoint? | Gateway RPC (`:18789`). The `:20128` custom endpoint becomes a gateway-configured provider, never a direct client dial |
| D8 | Memory read API shape for clients? | `GET /api/cory/search` (top-k) + `GET /api/cory/layers` |
| D9 | Offline desktop? | Explicit exception labeled "bypasses gateway policy" (like the reference `--local` mode), not a default path |

---

## 5. Out of scope (separate tracks)

- Version reconciliation (1.0.0 vs 2.0.0 vs rc) — see audit.
- Facade files, tautological tests, `@ts-nocheck` cleanup — see audit.
- 26-repository fleet remediation — see satellite audit.

## 6. References

- `AUDIT_2026-11-14_COREBLOW.md`
- `AUDIT_2026-11-14_ECOSYSTEM_26_REPOS.md`
