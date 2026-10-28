# Architecture & Security Blueprint: CoreBlow Agent-OS

**Document Version:** 1.0.0 (Production GA Baseline)<br />
**Status:** Production GA Certified (CoreBlow v1.0.0 GA Baseline)<br />
**Related Documents:** [PRD](/PRD)<br />
**Product Canonical URLs:** [https://coreblow.com](https://coreblow.com) | [https://github.com/coreblow](https://github.com/coreblow)<br />
**Documentation Portal:** [https://docs.coreblow.com](https://docs.coreblow.com)

---

## 1. Architectural Overview & System Topology

CoreBlow is designed as an industrial-grade, deterministic **Enterprise Autonomous Agent Operating System (Agent-OS)**. The codebase is organized into four distinct architectural layers with strict unidirectional dependency boundaries:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   LAYER 1: APPLICATION & EDGE LAYER                         │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌─────────────────┐  │
│  │  apps/macos   │ │   apps/ios    │ │ apps/android  │ │    Web UI       │  │
│  │ (Desktop App) │ │ (Mobile App)  │ │ (Mobile App)  │ │     (ui/)       │  │
│  └───────┬───────┘ └───────┬───────┘ └───────┬───────┘ └────────┬────────┘  │
│          │                 │                 │                  │           │
│          └─────────────────┼─────────────────┴──────────────────┘           │
│                            ▼                                                │
│                 Apple Silicon MLX TTS (apps/macos-mlx-tts, RTF <= 0.4)      │
└────────────────────────────┬────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│              LAYER 2: COMMUNICATION & GATEWAY LAYER (OpenClaw DNA)          │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ 142 Workspace & Channel Extensions (extensions/*)                     │  │
│  │ Discord | Slack | Telegram | WhatsApp | Matrix | Teams | Signal ...   │  │
│  └──────────────────────────────────┬────────────────────────────────────┘  │
│                                     ▼                                       │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Webhook Ingress Normalization & Routing (src/channels/, src/routing/) │  │
│  │ Pairing Guard & Trust Zone Verification                               │  │
│  │ Rate Limiting & Denial-of-Service Defense                             │  │
│  └──────────────────────────────────┬────────────────────────────────────┘  │
└─────────────────────────────────────┼───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│            LAYER 3: COGNITION & ORCHESTRATION LAYER (Hermes DNA)            │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Autonomous ReAct Cognitive Engine (src/agents/, src/agents/turn-engine)│  │
│  │ Strict JSON Schema Tool Execution & Parameter Validation              │  │
│  └──────────────────────────────────┬────────────────────────────────────┘  │
│                                     │                                       │
│          ┌──────────────────────────┴──────────────────────────┐            │
│          ▼                                                     ▼            │
│  ┌─────────────────────────────────┐   ┌─────────────────────────────────┐  │
│  │ Agent Control Protocol (ACP)    │   │ 3-Stage Dynamic Compaction      │  │
│  │ Parallel Worker Subagents       │   │ 1. Verbatim Pruning             │  │
│  │ Bounded Thread Execution Time   │   │ 2. Offload to ~/.coreblow/scratch│ │
│  │ Nonce-Signed Agent Envelopes    │   │ 3. Recursive Summarization      │  │
│  └─────────────────────────────────┘   │ (Immutable Governance Tags)     │  │
│                                        └─────────────────────────────────┘  │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                 LAYER 4: ENTERPRISE BACKBONE LAYER (CoreBlow)               │
│  ┌───────────────────────────────┐   ┌───────────────────────────────────┐  │
│  │ ServiceRegistry               │   │ True Zero Gap Plugin SDK Barrier  │  │
│  │ (start, stop, health lifecycle)│  │ (src/plugin-sdk/ isolated facade) │  │
│  └───────────────────────────────┘   └───────────────────────────────────┘  │
│  ┌───────────────────────────────┐   ┌───────────────────────────────────┐  │
│  │ CoreHub Package Resolution    │   │ Diagnostics & Self-Healing        │  │
│  │ (Signed manifests & grants)   │   │ (coreblow doctor runtime engine)  │  │
│  └───────────────────────────────┘   └───────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Layer-by-Layer Architectural Breakdown

### 2.1 Layer 1: Application and Edge Layer
The Application Layer provides native client surfaces and high-performance local edge acceleration:
- **Native Companion Apps:**
  - `apps/macos`: Native macOS SwiftUI application leveraging the modern `Observation` framework (`@Observable`, `@Bindable`) for deterministic state sync.
  - `apps/ios`: iOS mobile companion client providing background push synchronization and secure pairing authorization.
  - `apps/android`: Kotlin-based Jetpack Compose companion application connecting over secure WebSocket gateways.
  - `ui/`: Modern React/Vite web control center for real-time fleet observation, agent status tracking, and configuration management.
- **Apple Silicon Edge Inference (`apps/macos-mlx-tts`):**
  - Ultra-low-latency voice synthesis executing natively on Apple Silicon Neural Engine hardware and unified memory.
  - Achieves Real-Time Factor (RTF) <= 0.4 with zero outbound network calls, ensuring air-gapped sovereign speech generation.

### 2.2 Layer 2: Communication and Gateway Layer
Derived from OpenClaw battle-tested networking DNA, this layer unifies multi-channel communication:
- **142 Workspace & Channel Extensions (`extensions/*`):**
  - Modular channel connectors covering Slack, Discord, Telegram, WhatsApp Web, Matrix, Microsoft Teams, Signal, and email protocols.
  - Complete decoupling from core internals: extensions communicate exclusively through `coreblow/plugin-sdk/*`.
- **Webhook Normalization & Routing (`src/channels/`, `src/routing/`):**
  - Unifies disparate channel event payloads (mentions, direct messages, attachments, reaction events) into a standardized `InboundMessage` envelope.
  - Encapsulates channel routing rules, allowlists, and rate limits.
- **Pairing Guard Authorization:**
  - Enforces mandatory cryptographic pairing handshakes for newly joined contacts or public channels before any cognitive execution or tool evaluation is permitted.

### 2.3 Layer 3: Cognition and Orchestration Layer
Derived from Hermes advanced agentic cognition DNA, this layer drives autonomous reasoning:
- **Autonomous ReAct Cognitive Loop (`src/agents/`, `src/agents/turn-engine/`):**
  - Multi-turn Reasoning + Action loop operating with explicit step budgets, token tracking, and structured tool invocation.
  - Every tool definition is validated against rigid JSON schemas; model arguments undergo compile-time type verification before execution.
- **Agent Control Protocol (ACP) & Parallel Subagents (`src/acp/`):**
  - High-throughput protocol allowing primary agents to spawn, delegate, and monitor parallel subagents.
  - Subagents execute in isolated worker threads with strict CPU timeouts, memory caps, and nonce-verified message envelopes.
- **3-Stage Dynamic Context Compaction (`src/agents/compaction/`):**
  - Solves context window saturation without losing task-critical memory or security constraints:
    1. **Stage 1 (Verbatim Pruning):** Strips obsolete conversational filler, redundant tool schemas, and duplicate observation records.
    2. **Stage 2 (Virtual File Offloading):** Offloads bulky intermediate tool outputs (command traces, large JSON payloads, generated code blocks) to disk under `~/.coreblow/scratchpad/` and inserts a lightweight content hash reference into the prompt.
    3. **Stage 3 (Recursive Summarization):** Condenses historical turns using hierarchical summarization while mathematically preserving all blocks marked with **Immutable Governance Tags**.

### 2.4 Layer 4: Enterprise Backbone Layer
The foundation of the operating system ensuring stability, modularity, and operational integrity:
- **Deterministic ServiceRegistry (`src/gateway/service-registry.ts`):**
  - Industrial OOP lifecycle container managing every subsystem.
  - All services implement standardized `start(): Promise<void>`, `stop(): Promise<void>`, and `health(): ServiceHealth` contracts.
  - Enforces ordered boot sequences and graceful shutdown procedures.
- **True Zero Gap Plugin SDK (`src/plugin-sdk/`):**
  - Uncompromising architectural barrier separating core internals from extensions.
  - Prevents third-party plugins from creating illegal dependencies on internal functions, preserving long-term refactoring agility.
- **CoreHub Package Resolution (`src/plugins/`, `src/infra/corehub.ts`):**
  - Cryptographic verification of extension manifests, package integrity, and capability grants.
- **Integrated Diagnostics (`coreblow doctor`):**
  - Comprehensive pre-flight and runtime diagnostic suite validating token entropy, permissions, network bindings, and system limits.

---

## 3. Production Hardening & Security Guardrails

CoreBlow implements comprehensive technical guardrails aligned with the **OWASP Top 10 for Agentic AI Systems**:

```
                       SECURITY GUARDRAIL MATRIX
┌───────────────────────────────┬─────────────────────────────────────────────┐
│ Threat Vector                 │ CoreBlow Hardening Mechanism                │
├───────────────────────────────┼─────────────────────────────────────────────┤
│ ASI01: Prompt Injection       │ Cryptographic Context & Trust Zone Isolation│
│ ASI02: Information Leakage    │ Zero-Leak Redaction & Vaulted SecretRefs    │
│ ASI03: Supply Chain Risks     │ CoreHub Signed Manifests & Hash Auditing    │
│ ASI04: Insecure Output/Tools  │ Sandboxed File Boundaries & Schema Gates    │
│ ASI05: Privilege Escalation   │ Pairing Guard & Operator Scope RBAC         │
│ ASI06: Unbounded Loops        │ Step Budgets & Reversible Compaction Tags   │
│ ASI07: Memory Corruption      │ Immutable Governance Tag Preservation       │
│ ASI08: Denial of Service      │ ACP Worker Timeouts (CVE-2026-84288 Defense)│
│ ASI09: Inter-Agent Hijack     │ Nonce-Signed ACP Envelopes                  │
│ ASI10: Shadow Execution       │ Unified ServiceRegistry Thread Tracking     │
└───────────────────────────────┴─────────────────────────────────────────────┘
```

### 3.1 Cross-Channel Context Isolation (OWASP ASI01)
To prevent indirect prompt injection from public messaging channels into privileged cognitive memory:
1. **Trust Zone Demarcation:** Inbound messages are cryptographically tagged with their ingress source:
   - `Zone 0 (Public Ingress):` Discord public channels, Telegram groups, Slack public channels, public webhooks.
   - `Zone 1 (Authenticated Channel):` Paired 1-on-1 direct messages with authorized users.
   - `Zone 2 (Operator Ingress):` Authenticated CLI, local companion apps, or administrative tokens.
2. **Context Partitioning:** Zone 0 messages are wrapped in fenced delimiters (`<untrusted_channel_payload>`) with instruction-override neutralization filters. The model is forbidden from executing administrative or destructive tools when processing Zone 0 context without explicit operator confirmation.
3. **Memory Space Segregation:** Public channel sessions cannot read or write to private user memory spaces or shared enterprise vector stores.

### 3.2 CoreHub Extension Sandboxing (OWASP ASI04)
Third-party extensions are untrusted by default and governed by strict isolation rules:
1. **Manifest Validation:** Plugins must supply a signed `coreblow.plugin.json` declaring required capabilities (`contracts`, `providers`, `channels`, `tools`).
2. **Filesystem Boundary Defense:** Plugins are confined to their workspace directory using `src/infra/boundary-path.ts` and `src/infra/boundary-file-read.ts`. Path traversal attempts (`../../`) or symlink breakouts trigger immediate security termination.
3. **Import Barrier Enforcement:** Static analysis and runtime module resolution prevent plugins from loading Node.js native bindings or internal modules outside `coreblow/plugin-sdk/*`.

### 3.3 Reversible Compaction & Immutable Governance Tags (OWASP ASI06, ASI07)
During long-running multi-day sessions, context compaction risks stripping safety rules or prompt guardrails:
1. **Immutable Governance Tags:** All system-level instructions, enterprise security policies, and tool execution constraints are decorated with `@governance(immutable)` metadata.
2. **Mathematical Eviction Immunity:** The 3-stage compaction engine treats immutable tags as non-evictable. Compaction algorithms are mathematically constrained to only summarize or prune unpinned user messages and raw tool outputs.
3. **Reversible Scratchpad Offloading:** When intermediate tool artifacts are offloaded to `~/.coreblow/scratchpad/`, the compaction engine inserts a two-way pointer:
   ```
   [Offloaded Output: tool=git-diff ref=sha256:4a8b... size=142KB path=~/.coreblow/scratchpad/4a8b.dat]
   ```
   If a subsequent turn requires the full raw trace, the agent can invoke the built-in `expand_scratchpad_artifact` tool to selectively recall the data.

### 3.4 ACP Hardening & Denial of Service Defense (OWASP ASI08)
Autonomous subagent execution creates serious resource exhaustion and denial-of-service exposure (mitigating risks such as CVE-2026-84288):
1. **Worker-Thread Execution Timeouts:** Every ACP subagent session runs in a dedicated worker thread governed by an unyielding execution deadline (default: 120 seconds). When the deadline expires, the thread is forcefully terminated, active socket handles are closed, and resources are reclaimed.
2. **Deterministic Step Limits:** Agent loops enforce an upper bound on reasoning iterations (default: 25 turns per task). If an agent enters an infinite loop, the circuit breaker triggers and returns a structured failure report.
3. **Strict `trustedProxies` Deny-by-Default:** Gateway HTTP/WebSocket servers deny proxy headers (`X-Forwarded-For`, `X-Real-IP`) by default unless the connecting client matches an explicitly configured IP CIDR block in `trustedProxies`. This prevents IP spoofing and bypass of rate-limiting controls.

---

## 4. True Zero Gap Plugin SDK Specification

The `coreblow/plugin-sdk/*` boundary represents the contract between core architecture and extensions:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CoreBlow Monorepo Root                             │
├──────────────────────────────────────┬──────────────────────────────────────┤
│  CoreBlow Internals (Restricted)     │  Extensions Surface (Sandboxed)      │
│  src/gateway/                        │  extensions/discord/                 │
│  src/agents/                         │  extensions/slack/                   │
│  src/channels/                       │  extensions/telegram/                │
│  src/routing/                        │  extensions/speech-core/             │
│  src/infra/                          │  extensions/codex/                   │
│                                      │                                      │
│                  ▲                   │                  │                   │
│                  │                   │                  │                   │
│                  └───────────┐       │       ┌──────────┘                   │
│                              │       │       │                              │
│                      ┌───────┴───────┴───────▼──────┐                       │
│                      │      src/plugin-sdk/         │                       │
│                      │  (True Zero Gap Public API)  │                       │
│                      └──────────────────────────────┘                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.1 Strict Isolation Rules
1. **No Internal Imports:** Production code under `extensions/**` must never import `src/**` or `src/plugin-sdk-internal/**`.
2. **Local Barrel Routing:** Intra-extension module references must route through local barrels (`./api.ts` or `./runtime-api.ts`), never across extension boundaries.
3. **Zero Prototype Mutation:** Classes and runtime services are inherited or composed explicitly; prototype tampering is prohibited.

---

## 5. Architectural Quality Attributes & Verification

To maintain architectural integrity across continuous commits, every PR must pass the CoreBlow verification gates:
1. **TypeScript Type Safety:** `pnpm tsgo` (strict TypeScript validation with zero suppressions).
2. **Lint & Code Style:** `pnpm check` (Oxlint and Oxfmt enforcement).
3. **Parity Matrix Audit:** `pnpm audit:parity:matrix` (ground truth validation against upstream references without bloat).
4. **Colocated Test Suites:** `pnpm test` (Vitest with V8 coverage enforcement > 70%).
