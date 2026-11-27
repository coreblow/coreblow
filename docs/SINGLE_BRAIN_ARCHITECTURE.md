# Single-Brain Architecture — Decision Record

**Status:** Implemented & Active (CoreBlow v2.6.0 Production Baseline)
**Scope:** CoreBlow monorepo (`src/`, `apps/desktop/`, `apps/android/`, `apps/shared/`, `ui/`)

This document records the ratified Single-Brain architecture that unifies every CoreBlow surface behind one Gateway authority (`src/gateway/server.impl.ts`).

---

## 1. Unified Single-Brain Topology

All client surfaces act as thin clients routing turns through the single Gateway microkernel:

```text
 [CoreBlow Desktop]   [Web UI (ui/)]   [Android]   [Telegram / Discord / CLI / ACP]
   (apps/desktop/)     (thin client)   (thin client)       (channel adapters)
         │                   │               │                     │
         └───────────────────┴───────────────┴─────────────────────┘
                                     ▼
        ┌─────────────────────────────────────────────────────────────┐
        │  ONE GATEWAY  (src/gateway/server.impl.ts, port 18789)      │
        │           │                                                 │
        │           ▼                                                 │
        │  ONE TURN ENGINE (src/agents/pi-embedded-runner/attempt.ts) │
        │           │                                                 │
        │           ▼                                                 │
        │  ONE COGNITIVE COORDINATOR (src/agents/cognitive/)          │
        │   • 3-Tier Auto-Bypass Router (tier-router.ts)              │
        │   • Cory Dialectic Memory (SQLite WAL + FTS5 + user model)  │
        │   • EvoLoop Skill Synthesis · Knowledge Scribe              │
        │   • CoreFlow Orchestrator · Deterministic PR 5-Gate         │
        │   • 75 Built-In Native MCP Tools                            │
        └─────────────────────────────────────────────────────────────┘
```

### Core Architectural Principles

1. **Single core, thin clients:** One Gateway core serves every entry point; platform differences live in the client surface (`apps/desktop/`, `apps/android/`, `ui/`), not in duplicate agent loops.
2. **Ordered prompt tiers:** `stable` (identity/tools/skills) → `context` (workspace files) → `volatile` (memory/profile/timestamp), where `stable` never mutates mid-turn.
3. **6 active execution backends:** `local`, `vm_isolate`, `docker` (`--read-only` + `--tmpfs`), `ssh`, Daytona & E2B `PersistentSandboxSession` (`src/sandbox/persistent-session.ts`), plus optional `corebox` (`bwrap`). Unimplemented cloud backends (`modal`, `vercel`) fail closed with `*_NOT_IMPLEMENTED`.

---

## 2. Non-Negotiable Invariants

1. **Single memory writer:** Cory (`src/memory/`) is the sole writer of `~/.coreblow/memory` (SQLite WAL + FTS5 + `dialectic-user-model.ts`). All clients read/write via Gateway API, never via direct file access.
2. **Advisory, not blocking:** Cognitive service failures fail open (skip + telemetry counter), never crashing a user turn.
3. **Graceful drain:** Async `onTurnEnd` work (`ingestTrajectory`, Knowledge Scribe) is queued and drained cleanly before `server.impl.ts` closes SQLite handles.
4. **3-Tier Auto-Bypass & CoreFlow:** Lightweight Q&A and small non-sensitive edits (`<= 2` files, `< 50` LOC) bypass CoreFlow at Tier 0; medium edits run Tier 1 verified single-agent (0-token Gates 1–4); large, sensitive, or untrusted edits run Tier 2 isolated CoreFlow with diff-only Gate 5 and a hard 2-retry circuit breaker.
5. **Single provider resolver:** The adaptive 6-tier decision router resolves models for every entry point with credential guardrails and Daybreak quota failover.
6. **Subagents are children:** CoreFlow delegation spawns child agents with shared or per-child memory and toolset boundaries, never a parallel independent loop.

---

## 3. Ratified Decisions (Active in v2.6.0)

| ID | Decision | Resolution |
| :--- | :--- | :--- |
| D5 | Gateway Service Registry Topology | Dual-registry bootstrap (Infra + 12-Service Cognitive Microkernel side-by-side, coordinated shutdown). |
| D6 | Desktop Thin-Client Binding | `apps/desktop/` (sole cross-platform Electron app) connects directly to Gateway (`:18789`), eliminating duplicate client-side agent loops. |
| D7 | Canonical Agent-Turn Endpoint | Gateway (`:18789`) is the single canonical agent-turn authority. |
| D8 | Memory Read API Shape | `GET /api/cory/search` + `GET /api/cory/layers` served by Gateway HTTP (`src/gateway/microkernel-services.ts`). |
| D9 | Desktop Gateway Supervision | Desktop auto-supervises local `coreblow gateway` when offline and connects over authenticated local RPC/WebSocket. |
| D10 | CoreFlow & Route Compatibility | Canonical CoreFlow branding (`CoreFlowOrchestratorService`, `/api/corehub/coreflow/*`) with backward-compatible `/api/corehub/war-room/*` route aliases. |
