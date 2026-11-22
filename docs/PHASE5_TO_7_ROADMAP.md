# CoreBlow Sovereign Agent-OS Master Roadmap (Stages 1–9)

**Document Version:** 2.1.2 (Sovereign Hybrid OOP/DOP Microkernel & Evolution Edition)<br />
**Date:** November 6, 2026<br />
**Status:** Stages 1–6 Certified Complete (100% Passing) | Stage 7 Active | Stages 8–9 Scheduled<br />
**Product Canonical URLs:** [https://coreblow.com](https://coreblow.com) | [https://github.com/coreblow](https://github.com/coreblow)<br />
**Marketplace Registry:** [https://coreblow.com/corehub](https://coreblow.com/corehub)<br />
**Documentation Portal:** [https://docs.coreblow.com](https://docs.coreblow.com)

---

## 1. Executive Vision & Sovereign Architecture

**CoreBlow** is an original, sovereign, open-source **Enterprise Autonomous Agent Operating System (Agent-OS)** engineered from the ground up around a **Hybrid Object-Oriented Programming (OOP) + Data-Oriented Programming (DOP) Microkernel**.

Rather than shipping a bloated monolith or relying on fragile external sidecars, CoreBlow unifies:
1. **OOP Stateful Supervision (`ServiceRegistry`):** Deterministic lifecycle control (`start()`, `stop()`, `health()`), fault-isolated plugin sandboxes, mutex-gated SQLite WAL storage, and multi-agent War Room orchestration.
2. **DOP Stateless Hot-Path Pipelines:** Immutable `Readonly<T>` data contracts, pure functional prompt compilation, zero-SDK OpenAI-compatible SSE streaming, Bayesian Wilson-score skill distillation, and deterministic 6-tier model routing.
3. **CoreHub On-Demand Ecosystem (`https://coreblow.com/corehub`):** A 7-pillar cryptographically verified App Store architecture where community channels and specialized extensions are installed atomically on demand (`corehub:@coreblow/*`) without polluting the core kernel footprint.

```mermaid
flowchart TD
    subgraph S1_4 ["Stages 1–4: Hybrid OOP/DOP Microkernel & CoreHub Foundation (COMPLETE)"]
        S1["Stage 1: Channel Tiering & 15 CoreHub .tgz Artifacts"]
        S2["Stage 2: Pure DOP Zero-SDK Provider Streaming Engine & Cory Memory"]
        S3["Stage 3: Thematic Plugin-SDK Barrels & 0.56ms Microkernel Boot"]
        S4["Stage 4: Root Dependency Purge (89 -> 54 Direct Packages) & Cockpit E2E"]
        S1 --> S2 --> S3 --> S4
    end

    subgraph S5_6 ["Stages 5–6: Autonomous Self-Learning & Collective Intelligence (COMPLETE)"]
        S5["Stage 5: Cory EvoLoop Skill Synthesizer & Bayesian Wilson Fitness Ledger"]
        S6["Stage 6: Multi-Agent War Room, Kanban DAG, 6-Tier Decision Router & Daybreak Failover"]
        S4 --> S5 --> S6
    end

    subgraph S7_9 ["Stages 7–9: Knowledge Wiki, Ecosystem Migration & Open-Source GA (ACTIVE / NEXT)"]
        S7["Stage 7: Cory Knowledge Scribes, Browsable Memory Wiki, Zero-Stall Compaction & Universal Importer"]
        S8["Stage 8: Autonomous Git/PR Workflow Engine, Native Chat Views & Sovereign Local Companion"]
        S9["Stage 9: Universal Open-Source Release Certification & CoreBlow v2.0.0 GA Tagging"]
        S6 --> S7 --> S8 --> S9
    end
```

---

## 2. Master Milestone Matrix (Stages 1–9)

| Stage | Milestone Name | Primary Modules | Status | Certification Evidence |
| :--- | :--- | :--- | :---: | :--- |
| **Stage 1** | **CoreHub 7-Pillar Runtime & Channel Externalization** | `src/plugins/extension-tier-policy.ts`, `src/plugins/app-store-runtime.ts` | ✅ **COMPLETE** | 15/15 `.coreblow-plugin.tgz` SHA-256 artifacts certified; atomic staging, consent ledger & rollback active. |
| **Stage 2** | **Unified DOP Provider Engine & Cory Built-in Memory** | `src/providers/dop-openai-stream.ts`, `src/memory/cory.ts` | ✅ **COMPLETE** | 17 zero-SDK providers via pure SSE stream parser; 4-layer Markdown + SQLite WAL/BM25 (`< 2ms` recall). |
| **Stage 3** | **Thematic Plugin-SDK Consolidation & Microkernel Wiring** | `src/plugin-sdk/*`, `src/gateway/microkernel-services.ts` | ✅ **COMPLETE** | `0.56ms` kernel boot latency, `0` eager on-demand loads, 8 core native services registered. |
| **Stage 4** | **Root Dependency Purge & Cockpit Storefront E2E** | `package.json`, `ui/src/`, `src/plugins/cockpit-storefront-model.ts` | ✅ **COMPLETE** | Purged 35 heavy vendor SDKs (`89 -> 54` deps); verified Cockpit UI E2E via headless Chromium CDP. |
| **Stage 5** | **Cory EvoLoop: Autonomous Skill Synthesizer & Self-Learning** | `src/learning/dop-skill-distiller.ts`, `src/learning/skill-synthesizer-service.ts` | ✅ **COMPLETE** | 94/94 unit & adversarial tests passed; Bayesian Wilson fitness scoring, 3-Gate Zero-Trust scanner & auto-rollback. |
| **Stage 6** | **Collective Multi-Agent War Room & Adaptive Decision Router** | `src/agents/war-room/`, `src/providers/decision-router.ts` | ✅ **COMPLETE** | 205/205 tests passed; 6-tier task routing, Daybreak quota failover, Kanban DAG, sibling thread forking & `SKILL_LOCKED`. |
| **Stage 7** | **Cory Knowledge Scribes, Memory Wiki & Universal Importer** | `src/memory/knowledge-scribe.ts`, `src/migration/universal-agent-importer.ts` | ✅ **COMPLETE** | 243/243 tests passed; Browsable Memory Wiki, Zero-Stall Prepared Compaction, and 6-format Universal Importer with secret redaction. |
| **Stage 8** | **Autonomous Git/PR Orchestrator & Interactive Plugin Views** | `src/agents/pr-workflow/`, `src/plugins/chat-views/`, `src/tts/sovereign-voice-companion.ts` | ✅ **COMPLETE** | 253/253 tests passed; 5-gate PR pre-flight engine, XSS-safe multi-surface chat views, and `RTF <= 0.4` sovereign voice guard. |
| **Stage 9** | **Universal Open-Source Release & CoreBlow v2.0.0 GA** | `src/infra/release/sovereign-release-certifier.ts`, `docs/ARCHITECTURE.md` | ✅ **COMPLETE** | 249/249 unified regression tests passed; 12-service Sovereign Release Certifier, SHA-256 GA manifest & 100% brand purity. |

---

## 3. Detailed Stage Specifications

### 3.1 Stages 1–4: Hybrid OOP/DOP Microkernel, Cory Memory & CoreHub Foundation (COMPLETE)
- **High-Concurrency WAL Storage & Reversible Compaction (`src/infra/storage/`, `src/agents/compaction/`):**
  - Non-blocking Write-Ahead Logging (WAL) session ledger supporting 50+ concurrent ACP subagents.
  - 3-stage reversible compaction with `@governance(immutable)` protection and `~/.coreblow/scratchpad/` pointer offloading.
- **Cory Built-in Memory (`src/memory/cory.ts`):**
  - Offline-first 4-layer canonical Markdown architecture (`USER.md`, `MEMORY.md`, `CONSTRAINTS.md`, `daily/<YYYY-MM-DD>.md`) backed by a self-healing SQLite WAL + FTS5/BM25 index (`cory-search.sqlite`).
  - Session-frozen startup snapshots preserve LLM prompt caches while mid-session writes persist immediately to disk.
- **CoreHub 7-Pillar App Store & Dependency Purge (`src/plugins/`):**
  - Externalized 15 community channels (`discord`, `matrix`, `twitch`, `feishu`, `line`, `zalo`, `zalouser`, `qqbot`, `mattermost`, `nextcloud-talk`, `synology-chat`, `tlon`, `nostr`, `irc`, `msteams`) to `https://coreblow.com/corehub` and removed 35 leaked SDK packages from root `package.json`.

### 3.2 Stage 5: Cory EvoLoop — Autonomous Skill Synthesizer (`src/learning/`) (COMPLETE)
- **Pure DOP Trajectory Distillation (`src/learning/dop-skill-distiller.ts`):**
  - Automatically synthesizes structured `SKILL.md` V2 procedures from verified *Friction $\rightarrow$ Recovery $\rightarrow$ Verification Pass* tool trajectories and explicit operator rules.
  - Computes Bayesian Wilson lower-bound confidence scores ($z = 1.28$, 80% confidence) and moving-average turns saved.
- **OOP Lifecycle & 3-Gate Zero-Trust Defense (`src/learning/skill-synthesizer-service.ts`):**
  - Enforces Zone 0 (public channel) write blocking, static AST/regex dangerous code scanning (`eval`, `Function()`, child process injection, raw credentials), and revision snapshotting (`~/.coreblow/skills/.revisions/`).
  - Automatically promotes proven skills (`candidate -> canary -> verified_active`) and rolls back regressing versions (`fitnessScore < 0.40`).

### 3.3 Stage 6: Collective Multi-Agent War Room & Adaptive Decision Router (COMPLETE)
- **Adaptive 6-Tier Decision & Quota-Window Router (`src/providers/decision-router.ts`):**
  - Deterministically classifies every task across 6 specialized tiers (`fast`, `deep`, `local`, `coding`, `vision`, `decision`) and supports full `AgentProfileRoute` overrides.
  - **Daybreak Quota Failover:** Monitors 5-hour/daily provider token windows and rate-limit cooldowns, seamlessly switching (`daybreakSwitched: true`) to fallback cloud models or zero-cost local inference (`ollama` / `vllm`) without dropping active turns.
- **Multi-Agent War Room & Kanban Orchestrator (`src/agents/war-room/war-room-service.ts`):**
  - Coordinates Lead Agents and specialist subagents (`architect`, `coder`, `auditor`, `researcher`, `security`) inside shared War Rooms with deterministic Kanban DAG task transitions (`backlog -> in_progress -> review -> verified`).
  - Supports **Sibling Thread Forking**, **Child Subagent Approval Relay**, and **Collective Skill Mesh** (auto-injecting verified EvoLoop skills across all specialists).
- **EvoLoop Hardening (`src/learning/`):**
  - Adds immutable per-skill locks (`locked: boolean` / `SKILL_LOCKED`), background `prepareAheadCompaction()`, and the pure DOP `evaluatePreLlmCallHook()` security/budget interceptor.

### 3.4 Stage 7: Cory Knowledge Scribes, Browsable Memory Wiki & Universal Importer (ACTIVE)
- **Cory Knowledge Scribes & Memory Wiki (`src/memory/knowledge-scribe.ts`):**
  - Automatically distills multi-session architectural decisions, workflows, and constraints into a browsable, cross-linked Markdown **Memory Wiki** (`~/.coreblow/memory/wiki/<slug>.md`) alongside a read-only `USER.md` / `MEMORY.md` / `CONSTRAINTS.md` audit panel.
- **Zero-Stall Prepared Compaction:**
  - Pre-computes context compaction artifacts in the background while pinning the user's `activeHumanRequest` and maintaining a deterministic `toolDefinitionsHash` so repeated compactions never lose task intent or invalidate prompt caches.
- **Universal Workspace Profile Importer (`src/migration/universal-agent-importer.ts`):**
  - One-command preview-first importer (`coreblow-bundle`, `standard-agents-md`, `claude-code`, `cursor`, `codex`, `windsurf`) that ingests rules, memories, MCP server definitions, and skills while automatically redacting raw API keys/tokens (`[REDACTED_SECRET]`) and quarantining unsafe skills.

### 3.5 Stage 8: Autonomous Git/PR Workflow Engine, Interactive Chat Views & Sovereign Companion (PLANNED)
- **Chat-Native Git & Pull Request Orchestrator (`src/agents/pr-workflow/`):**
  - Enables any CoreBlow War Room or channel session to inspect diffs, run pre-flight verification gates (`vitest`, `tsgo`, `oxlint`), create branches, and draft structured Pull Requests directly from chat with operator approval gates.
- **Interactive Plugin Views in Chat (`src/plugins/chat-views/`):**
  - Standardized DOP schema allowing core services and CoreHub plugins to render rich interactive status cards, Kanban boards, and approval prompts across Web Cockpit UI and messaging channels.
- **Sovereign Local Voice & Desktop Companion (`apps/macos/`, `apps/macos-mlx-tts/`):**
  - Sub-0.4 RTF local Apple Silicon MLX speech synthesis and menu-bar companion integration for zero-cloud-cost voice and desktop workflows.

### 3.6 Stage 9: Production Release Engineering & CoreBlow v2.0.0 Sovereign GA (PLANNED)
- **100% Brand Sovereignty & Codebase Purity Audit:**
  - Automated static verification ensuring zero legacy/competitor identifiers across all packages, manifests, CLI help text, and documentation.
- **Universal Open-Source Distribution:**
  - One-line installer (`curl -fsSL https://coreblow.com/install.sh | sh`), Docker Compose production stack with persistent WAL volumes, and signed CoreHub artifact catalog release (`v2.0.0 GA`).
