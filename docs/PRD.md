# Product Requirements Document (PRD): CoreBlow Sovereign Agent-OS

**Document Version:** 2.1.2 (Sovereign Hybrid OOP/DOP Microkernel Baseline)<br />
**Status:** Production Certified (Stages 1–6 Complete | Stage 7 Active)<br />
**Product Canonical URLs:** [https://coreblow.com](https://coreblow.com) | [https://github.com/coreblow](https://github.com/coreblow)<br />
**Marketplace Registry:** [https://coreblow.com/corehub](https://coreblow.com/corehub)<br />
**Documentation Portal:** [https://docs.coreblow.com](https://docs.coreblow.com)

---

## 1. Executive Summary & Vision

### 1.1 Product Vision
**CoreBlow** is a sovereign, open-source **Enterprise Autonomous Agent Operating System (Agent-OS)** engineered to run self-learning, multi-agent autonomous workflows across enterprise communication channels, local hardware, and distributed cloud backends.

Modern autonomous agent platforms suffer from four structural failure modes:
1. **Stateless Fragility & Amnesia:** Basic ReAct wrappers treat conversations as transient message arrays, dropping multi-day workflows, user preferences, and learned tool recovery patterns across sessions.
2. **Static Skill Decay ("Skill Rot"):** Traditional agents cannot synthesize new procedural skills from their own error-recovery trajectories or automatically roll back broken skills when workflows change.
3. **The Lethal Trifecta:** Combining host shell/filesystem access, untrusted public channel ingress, and autonomous tool execution without cryptographic trust zones exposes users to prompt injection and credential exfiltration.
4. **Monolithic Dependency Bloat:** Bundling dozens of niche chat SDKs and native binaries into the core runtime inflates memory usage, slows startup, and expands the attack surface.

CoreBlow solves these challenges through a **Hybrid Object-Oriented Programming (OOP) + Data-Oriented Programming (DOP) Microkernel** paired with the **CoreHub On-Demand Application Ecosystem (`https://coreblow.com/corehub`)**.

### 1.2 CoreBlow Sovereign Architecture Pillars

```
   ┌───────────────────────────────────────────────────────────────────────┐
   │                     CoreBlow Sovereign Agent-OS                       │
   └───────────────────────────────────────────────────────────────────────┘
                                       │
         ┌─────────────────────────────┼─────────────────────────────┐
         ▼                             ▼                             ▼
  OOP Stateful Supervision      DOP Stateless Hot Paths      Autonomous Intelligence
  • ServiceRegistry Lifecycle   • Pure SSE Provider Engine   • Cory 4-Layer Memory & Wiki
  • CoreHub 7-Pillar Sandbox    • 6-Tier Decision Router     • Cory EvoLoop Skill Distiller
  • WAL Session Ledger          • 3-Stage Compaction         • Multi-Agent War Room & DAG
  • Cryptographic Trust Zones   • Pre-LLM Security Hook      • Universal Workspace Importer
```

---

## 2. Core Pillars & Innovations

### 2.1 Cory Built-in Memory, Knowledge Scribes & Browsable Memory Wiki (`src/memory/`)
CoreBlow ships with **Cory (`cory-memory` & `cory-knowledge-scribe`)**, a zero-config, offline-first memory and knowledge architecture:
- **Four-Layer Canonical Markdown Memory (`src/memory/cory.ts`):** Separates *Identity Memory* (`USER.md`), *Durable Workspace Memory* (`MEMORY.md`), *Episodic Daily Summaries* (`daily/<YYYY-MM-DD>.md`), and *Active Constraints* (`CONSTRAINTS.md`), indexed by a self-healing SQLite WAL + BM25 lexical engine (`cory-search.sqlite`) with `< 2ms` retrieval latency.
- **Knowledge Scribes & Browsable Memory Wiki (`src/memory/knowledge-scribe.ts`):** Automatically compiles durable decisions, constraints, and learned skills into human-readable, cross-linked Markdown Wiki topic pages (`~/.coreblow/memory/wiki/`) with a read-only audit panel.
- **Zero-Stall Prepared Compaction:** Pre-computes context summaries in the background while pinning the user's `activeHumanRequest` and deterministic `toolDefinitionsHash` so prompt caches never invalidate across compactions.

### 2.2 Cory EvoLoop: Autonomous Skill Synthesizer & Self-Learning Engine (`src/learning/`)
CoreBlow continuously improves from real execution experience without external Python sidecars:
- **DOP Trajectory Distillation (`src/learning/dop-skill-distiller.ts`):** Automatically extracts reusable `SKILL.md` V2 procedures whenever an agent overcomes tool friction (*Failed Step $\rightarrow$ Recovery $\rightarrow$ Verification Pass*) or receives an explicit operator workflow rule.
- **Bayesian Wilson-Score Fitness Ledger:** Tracks invocations, successes, and turns saved using the Wilson lower-bound confidence interval ($z = 1.28$), automatically promoting proven skills (`candidate -> canary -> verified_active`) and rolling back regressing versions (`fitnessScore < 0.40`).
- **Immutable Per-Skill Locks & 3-Gate Zero-Trust Security:** Operators can lock mission-critical skills (`locked: true` / `SKILL_LOCKED`) against mutation or deprecation, while Zone 0 public-channel blocking and AST/regex static scanning quarantine unsafe code before activation.

### 2.3 Collective Multi-Agent War Room & Adaptive 6-Tier Decision Router (`src/agents/war-room/`, `src/providers/`)
- **Multi-Agent War Room (`src/agents/war-room/war-room-service.ts`):** Lead Agents decompose complex objectives across specialist subagents (`architect`, `coder`, `auditor`, `researcher`, `security`) tracked on a shared **Kanban DAG Board** (`backlog -> in_progress -> review -> verified`), complete with **Sibling Thread Forking**, **Child Approval Relay**, and **Collective Skill Mesh** sharing.
- **Adaptive 6-Tier Decision Router (`src/providers/decision-router.ts`):** Deterministically routes tasks across `fast`, `deep`, `local`, `coding`, `vision`, and `decision` tiers with **Daybreak Quota-Window Failover**—automatically switching to fallback cloud providers or local inference (`ollama` / `vllm`) when rate-limit windows approach exhaustion.

### 2.4 CoreHub 7-Pillar On-Demand Marketplace (`src/plugins/`)
- **Lean Microkernel by Default:** Essential capabilities (`cory-memory`, `cory-skill-synthesizer`, `war-room-orchestrator`, `cory-knowledge-scribe`, `telegram`, `whatsapp`, `slack`, `webhooks`, `browser`, `acp`) boot in `< 1ms` while 15+ community channels are distributed as cryptographically signed `.coreblow-plugin.tgz` packages via `https://coreblow.com/corehub`.
- **Atomic Staging, Consent Ledger & Instant Rollback:** Every CoreHub package verifies SHA-256 integrity, enforces explicit capability consent (`network`, `filesystem`, `shell`, `credentials`, `webhook`), isolates runtime faults, and supports one-command version rollback.

---

## 3. Product Requirements & Capability Matrix

| Capability | Requirement Description | Implementation Surface | Priority | Status |
| :--- | :--- | :--- | :---: | :---: |
| **Hybrid Microkernel** | Sub-millisecond `ServiceRegistry` boot with strict OOP lifecycle and DOP hot paths. | `src/gateway/service-registry.ts`, `src/gateway/microkernel-services.ts` | P0 | ✅ Certified |
| **Zero-SDK Provider Engine** | Pure DOP OpenAI-compatible SSE streaming covering 17+ cloud and local AI providers. | `src/providers/dop-openai-stream.ts` | P0 | ✅ Certified |
| **Cory Built-in Memory** | 4-layer Markdown truth + SQLite WAL/BM25 lexical search with Zone 0 write protection. | `src/memory/cory.ts` | P0 | ✅ Certified |
| **Cory EvoLoop** | Closed-loop trajectory skill distillation, Bayesian Wilson fitness, auto-rollback & skill locks. | `src/learning/` | P0 | ✅ Certified |
| **6-Tier Decision Router** | Deterministic task classification + Daybreak quota-window failover to fallback/local AI. | `src/providers/decision-router.ts` | P0 | ✅ Certified |
| **Multi-Agent War Room** | Lead routing, Kanban DAG task board, sibling thread forking & child approval relay. | `src/agents/war-room/` | P0 | ✅ Certified |
| **CoreHub App Store** | 7-pillar on-demand plugin packaging, SHA-256 verification, consent gate & rollback. | `src/plugins/app-store-runtime.ts` | P0 | ✅ Certified |
| **Knowledge Scribes & Wiki** | Browsable Markdown Memory Wiki + Zero-Stall Prepared Compaction preserving user intent. | `src/memory/knowledge-scribe.ts` | P0 | ✅ Certified |
| **Universal Importer** | Preview-first workspace profile importer with automatic API key/secret redaction. | `src/migration/universal-agent-importer.ts` | P1 | ✅ Certified |
| **Autonomous PR & Chat Views** | Chat-native Git/PR workflow engine + interactive DOP plugin cards in chat. | `src/agents/pr-workflow/`, `src/plugins/chat-views/` | P0 | ✅ Certified |
| **Sovereign Local TTS** | Native Apple Silicon MLX voice synthesis (`RTF <= 0.4`) and desktop companion. | `src/tts/sovereign-voice-companion.ts`, `apps/macos-mlx-tts/` | P1 | ✅ Certified |
| **Sovereign Release Certifier** | Automated 12-service GA readiness gate, brand purity scanner & SHA-256 release manifest. | `src/infra/release/sovereign-release-certifier.ts` | P0 | ✅ Certified |

---

## 4. Security & Threat Mitigation: Neutralizing The Lethal Trifecta

CoreBlow systematically neutralizes **The Lethal Trifecta** (*Untrusted Channel Ingress + Host Execution + Autonomous Agency*) across all layers:
1. **Cryptographic Trust Zones (`Zone 0` Public Untrusted, `Zone 1` Authenticated User, `Zone 2` System Operator):** Untrusted public channels are strictly blocked from mutating `USER.md`, `MEMORY.md`, `CONSTRAINTS.md`, Memory Wiki pages, or EvoLoop learned skills.
2. **Pre-LLM Call Interceptor (`evaluatePreLlmCallHook`):** Pure DOP security gate that inspects outbound prompt payloads prior to model invocation, blocking prompt injection markers, secret exfiltration patterns, and token budget overruns.
3. **Automated Secret Redaction (`redactSensitiveText`):** Strips raw API keys, bearer tokens, and credentials from logs, outbound chat messages, synthesized skills, and imported workspace bundles.
4. **Bounded Execution & Emergency Kill-Switch:** Hard 120-second ACP worker thread timeouts and hardware/UI emergency kill-switches prevent runaway autonomous loops.
