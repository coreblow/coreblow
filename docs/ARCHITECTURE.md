# Architecture and Security Blueprint: CoreBlow Agent-OS

**Document Version:** 2.1.3 (Production GA Baseline)<br />
**Status:** Production GA Certified (CoreBlow v2.1.3 GA Baseline)<br />
**Related Documents:** [PRD](/PRD)<br />
**Product Canonical URLs:** [https://coreblow.com](https://coreblow.com) | [https://github.com/coreblow](https://github.com/coreblow)<br />
**Documentation Portal:** [https://docs.coreblow.com](https://docs.coreblow.com)

---

## 1. Architectural Overview and System Topology

CoreBlow is designed as an industrial-grade, deterministic **Enterprise Autonomous Agent Operating System (Agent-OS)**. The codebase is organized into four distinct architectural layers with strict unidirectional dependency boundaries:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   LAYER 1: APPLICATION AND EDGE LAYER                       │
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
│              LAYER 2: COMMUNICATION AND GATEWAY LAYER (CoreBlow Native)     │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ 142 Workspace and Channel Extensions (extensions/*)                   │  │
│  │ Discord | Slack | Telegram | WhatsApp | Matrix | Teams | Signal ...   │  │
│  └──────────────────────────────────┬────────────────────────────────────┘  │
│                                     ▼                                       │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Webhook Ingress Normalization and Routing (src/channels/, src/routing)│  │
│  │ Pairing Guard and Trust Zone Verification                             │  │
│  │ Rate Limiting and Denial-of-Service Defense                           │  │
│  └──────────────────────────────────┬────────────────────────────────────┘  │
└─────────────────────────────────────┼───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│            LAYER 3: COGNITION AND ORCHESTRATION LAYER (CoreBlow Cognition)  │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Autonomous ReAct Cognitive Engine (src/agents/, src/agents/turn-engine)│  │
│  │ Strict JSON Schema Tool Execution and Parameter Validation            │  │
│  └──────────────────────────────────┬────────────────────────────────────┘  │
│                                     │                                       │
│          ┌──────────────────────────┴──────────────────────────┐            │
│          ▼                                                     ▼            │
│  ┌─────────────────────────────────┐   ┌─────────────────────────────────┐  │
│  │ Multi-Agent War Room and ACP    │   │ 3-Stage Dynamic Compaction      │  │
│  │ Parallel Worker Subagents       │   │ 1. Verbatim Pruning             │  │
│  │ Bounded Thread Execution Time   │   │ 2. Offload to ~/.coreblow/scratch│ │
│  │ Nonce-Signed Agent Envelopes    │   │ 3. Recursive Summarization      │  │
│  │ Kanban DAG Task Orchestration   │   │ (Immutable Governance Tags)     │  │
│  └─────────────────────────────────┘   └─────────────────────────────────┘  │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                 LAYER 4: ENTERPRISE BACKBONE LAYER (CoreBlow Sovereign)     │
│  ┌───────────────────────────────┐   ┌───────────────────────────────────┐  │
│  │ 12 Native Microkernel Services│   │ True Zero Gap Plugin SDK Barrier  │  │
│  │ (Deterministic Topology DAG)  │   │ (src/plugin-sdk/ isolated facade) │  │
│  └───────────────────────────────┘   └───────────────────────────────────┘  │
│  ┌───────────────────────────────┐   ┌───────────────────────────────────┐  │
│  │ CoreHub 7-Pillar App Store    │   │ Sovereign Release Certification   │  │
│  │ (Signed manifests and grants) │   │ (5 Readiness Gates and SHA-256)   │  │
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
Engineered with resilient, battle-tested networking architecture, this layer unifies multi-channel communication:
- **142 Workspace and Channel Extensions (`extensions/*`):**
  - Modular channel connectors covering Slack, Discord, Telegram, WhatsApp Web, Matrix, Microsoft Teams, Signal, and email protocols.
  - Complete decoupling from core internals: extensions communicate exclusively through `coreblow/plugin-sdk/*`.
- **Webhook Normalization and Routing (`src/channels/`, `src/routing/`):**
  - Unifies disparate channel event payloads (mentions, direct messages, attachments, reaction events) into a standardized `InboundMessage` envelope.
  - Encapsulates channel routing rules, allowlists, and rate limits.
- **Pairing Guard Authorization:**
  - Enforces mandatory cryptographic pairing handshakes for newly joined contacts or public channels before any cognitive execution or tool evaluation is permitted.

### 2.3 Layer 3: Cognition and Orchestration Layer
Engineered with advanced sovereign agentic cognition, this layer drives autonomous reasoning:
- **Autonomous ReAct Cognitive Loop (`src/agents/`, `src/agents/turn-engine/`):**
  - Multi-turn Reasoning + Action loop operating with explicit step budgets, token tracking, and structured tool invocation.
  - Every tool definition is validated against rigid JSON schemas; model arguments undergo compile-time type verification before execution.
- **Agent Control Protocol (ACP) and Parallel Subagents (`src/acp/`):**
  - High-throughput protocol allowing primary agents to spawn, delegate, and monitor parallel subagents.
  - Subagents execute in isolated worker threads with strict CPU timeouts, memory caps, and nonce-verified message envelopes.
- **3-Stage Dynamic Context Compaction (`src/agents/compaction/`):**
  - Solves context window saturation without losing task-critical memory or security constraints:
    1. **Stage 1 (Verbatim Pruning):** Strips obsolete conversational filler, redundant tool schemas, and duplicate observation records.
    2. **Stage 2 (Virtual File Offloading):** Offloads bulky intermediate tool outputs (command traces, large JSON payloads, generated code blocks) to disk under `~/.coreblow/scratchpad/` and inserts a lightweight content hash reference into the prompt.
    3. **Stage 3 (Recursive Summarization):** Condenses historical turns using hierarchical summarization while mathematically preserving all blocks marked with **Immutable Governance Tags**.

### 2.4 Layer 4: Enterprise Hybrid OOP and DOP Microkernel Backbone
The foundation of the operating system ensuring stability, modularity, and operational integrity through a strict **Hybrid Object-Oriented Programming (OOP) + Data-Oriented Programming (DOP)** boundary:
- **OOP Architectural Role:** Stateful services manage persistent lifecycle resources, operating system connections, socket listeners, timer loops, and database handles. All OOP kernel services implement the `GatewayService` contract (`name: string`, `start(): Promise<void>`, `stop(): Promise<void>`, `health(): ServiceHealth`) managed centrally by `ServiceRegistry`.
- **DOP Architectural Role:** Pure immutable data records, serializable message envelopes, deterministic evaluation functions, state transition reducers, and cryptographic hashing routines execute with zero side effects.
- **Microkernel Bootstrap Invariant:** Microkernel bootstrap executes in `< 1ms` latency with zero eager loading of community extensions (`eagerCoreHubAppsLoaded: 0`). External channel apps remain externalized as on-demand `.coreblow-plugin.tgz` packages.

#### The 12 Native Microkernel Services Specification

Registered in `src/gateway/microkernel-services.ts`, the microkernel enforces deterministic topological startup and health aggregation:

| # | Service Name | Implementation Class | Boot Level | Dependencies | Health Contract and Operational Invariants |
| :-: | :--- | :--- | :-: | :--- | :--- |
| **1** | `provider-runtime` | `NativeProviderRuntimeService` | Level 0 | `[]` | Reports active providers, models, and configuration status across 17+ zero-SDK AI providers. |
| **2** | `rag-runtime` | `NativeRagRuntimeService` | Level 1 | `["provider-runtime"]` | Reports indexed document chunks and embedding backend status; clears vector pipeline on `stop()`. |
| **3** | `tool-runtime` | `NativeToolRuntimeService` | Level 1 | `["provider-runtime"]` | Manages `ToolRegistry` and `ToolExecutor`; validates schemas against JSON Schema and reports active tool count. |
| **4** | `browser-runtime` | `NativeBrowserRuntimeService` | Level 2 | `["tool-runtime"]` | Wraps `BrowserTool`; manages CDP connections; tracks active page IDs; executes `cleanupBrowserSessionsForLifecycleEnd` on `stop()`. |
| **5** | `voice-runtime` | `NativeVoiceRuntimeService` | Level 0 | `[]` | Wraps `TtsEngine`; lists active TTS voices; clears synthesis cache on `stop()`. |
| **6** | `cory-memory` | `CoryBootstrapService` | Level 1 | `["provider-runtime"]` | Four-layer Markdown store (`USER.md`, `MEMORY.md`, `CONSTRAINTS.md`, `daily/`) + SQLite WAL index (`cory-search.sqlite`); startup snapshot prevents prompt-cache invalidation. Strictly isolated from CoreHub. |
| **7** | `cory-skill-synthesizer` | `CorySkillSynthesizerService` | Level 2 | `["cory-memory"]` | Closed-loop EvoLoop engine; distills `SKILL.md` V2 from friction trajectories; tracks Bayesian Wilson fitness ($z=1.28$); enforces immutable `SKILL_LOCKED` tags, auto-rollback, and 3-Gate Zero-Trust security. |
| **8** | `extension-tier-policy` | `ExtensionTierPolicy` | Level 0 | `[]` | Enforces structural boundary separating Core Built-in capabilities from CoreHub On-Demand extensions; guarantees `< 1ms` boot. |
| **9** | `corehub-app-store` | `CoreHubAppStoreRuntime` | Level 1 | `["extension-tier-policy"]` | 7-pillar App Store runtime; manages 15 externalized community channel `.coreblow-plugin.tgz` packages; pre-extraction SHA-256 validation, atomic staging (`~/.coreblow/tmp/<uuid>`), consent ledger, and instant rollback. |
| **10** | `war-room-orchestrator` | `WarRoomOrchestratorService` | Level 3 | `["cory-skill-synthesizer", "provider-runtime"]` | Multi-agent coordination; Lead Agent decomposition; Kanban DAG task board (`backlog -> in_progress -> review -> done`); sibling thread forking; child approval relay; collective skill mesh injection. |
| **11** | `cory-knowledge-scribe` | `CoryKnowledgeScribeService` | Level 3 | `["cory-memory", "cory-skill-synthesizer"]` | Autonomous knowledge scribe; compiles durable decisions, constraints, workflows into browsable cross-linked Markdown Wiki topic pages (`~/.coreblow/memory/wiki/<slug>.md`); provides Zero-Stall Prepared Compaction pinning user intent. |
| **12** | `pr-workflow-orchestrator` | `PrWorkflowOrchestratorService` | Level 4 | `["tool-runtime", "war-room-orchestrator"]` | Autonomous Git and PR engine; evaluates 5 pre-flight gates (`typecheck`, `linter`, `unit_tests`, `secret_scan`, `forbidden_paths`); generates deterministic PR Markdown; enforces human-in-the-loop approval. |

```
                    TOPOLOGICAL DEPENDENCY GRAPH
                    
     [provider-runtime] ──┬──────────────┬──────────────┬──────────────┐
       (Level 0 OOP)      │              │              │              │
                          ▼              ▼              ▼              │
                   [rag-runtime]  [tool-runtime]  [cory-memory]        │
                     (Level 1)      (Level 1)       (Level 1)          │
                                         │              │              │
                                         ▼              ▼              │
                                 [browser-runtime] [cory-skill-synth]  │
                                    (Level 2)       (Level 2)          │
                                                        │              │
       [extension-tier-policy] ──┐                      ├──────────────┤
            (Level 0 OOP)        │                      ▼              ▼
                                 ▼            [war-room-orch] [cory-knowledge-scribe]
                        [corehub-app-store]      (Level 3)          (Level 3)
                            (Level 1)                   │
                                                        ▼
                                             [pr-workflow-orch]
                                                 (Level 4)

     [voice-runtime] (Level 0 standalone)
```

#### Deterministic Topological Boot and Shutdown Sequence

The microkernel lifecycle is governed by topological sorting algorithms inside `ServiceRegistry`:
- **Phase 0 (Foundation Roots):** Boots `provider-runtime`, `voice-runtime`, and `extension-tier-policy` in parallel or sequence. These services have zero external dependencies.
- **Phase 1 (Core Subsystems):** Boots `rag-runtime` (depends on `provider-runtime`), `tool-runtime` (depends on `provider-runtime`), `cory-memory` (depends on `provider-runtime`), and `corehub-app-store` (depends on `extension-tier-policy`).
- **Phase 2 (Derived Execution):** Boots `browser-runtime` (depends on `tool-runtime`) and `cory-skill-synthesizer` (depends on `cory-memory`).
- **Phase 3 (Collaborative Intelligence):** Boots `war-room-orchestrator` (depends on `cory-skill-synthesizer` and `provider-runtime`) and `cory-knowledge-scribe` (depends on `cory-memory` and `cory-skill-synthesizer`).
- **Phase 4 (Autonomous Delivery):** Boots `pr-workflow-orchestrator` (depends on `tool-runtime` and `war-room-orchestrator`).
- **Graceful Shutdown Sequence:** Executes in exact reverse topological order (Phase 4 down to Phase 0), guaranteeing dependent consumers drain work before foundational providers release handles.

---

## 2.5 Stage 5 to 9 Sovereign Subsystems Architecture

### 2.5.1 Cory EvoLoop Autonomous Skill Synthesizer: src/learning
- **Architecture:** Hybrid OOP supervisor (`CorySkillSynthesizerService`) wrapping pure DOP distillation algorithms (`dop-skill-distiller.ts`).
- **Closed-Loop Distillation Lifecycle:**
  1. *Friction Detection:* Intercepts turn executions to detect failed tool invocations (`isError: true` or non-zero exit codes).
  2. *Recovery and Verification:* Identifies successful corrective tool calls followed by verification passes.
  3. *Pure DOP Distillation:* `distillSkillRecordFromTrajectory()` extracts clean procedural instructions, verified inputs/outputs, error recovery rules, and active constraints into standardized `SKILL.md` V2 format.
  4. *Bayesian Wilson Fitness Scoring:* Computes lower-bound score ($z = 1.28$, 80% confidence interval):
     $$\text{Wilson Score} = \frac{\hat{p} + \frac{z^2}{2n} - z \sqrt{\frac{\hat{p}(1-\hat{p}) + \frac{z^2}{4n}}{n}}}{1 + \frac{z^2}{n}}$$
  5. *State Transitions:* Evaluates skill progression: `candidate -> canary -> verified_active`. Regressing skills with $\text{fitnessScore} < 0.40$ or consecutive failures trigger automated rollback.
- **Operational Invariants:**
  - `SKILL_LOCKED` / `locked: true`: Immutable protection tags prevent mutation, automatic rollback, or deletion of critical operator-defined skills.
  - 3-Gate Zero-Trust Security: Enforces AST and regex static scanning (blocking `eval`, `Function()`, `child_process`, and unredacted credentials) and strictly prohibits Zone 0 public-channel skill synthesis.
  - Pre-LLM Hook: Injects validated active skills into reasoning context dynamically based on task intent.

### 2.5.2 Adaptive 6-Tier Decision and Quota-Window Router: src/providers/decision-router.ts
- **Architecture:** Pure DOP immutable route tables, usage gauge records, and deterministic task classifiers.
- **6 Specialized Task Tiers:**
  - `fast`: Low-latency routing (Groq `llama-3.3-70b-versatile`, fallback OpenAI `gpt-4o-mini`).
  - `deep`: High-context reasoning (DeepSeek `deepseek-reasoner`, fallback OpenAI `o3-mini`).
  - `local`: Air-gapped offline execution (Ollama `llama3.3`, fallback vLLM).
  - `coding`: Specialized programming logic (DeepSeek `deepseek-chat`, fallback Ollama `qwen2.5-coder`).
  - `vision`: Multimodal image processing (OpenAI `gpt-4o`, fallback Google `gemini-2.5-flash`).
  - `decision`: Fast classification and orchestration routing.
- **Daybreak Quota-Window Failover:**
  - Tracks token usage against 5-hour and 24-hour rolling provider quota windows (`UsageWindowGauge`).
  - When quota window exceeds threshold ($> 95\%$) or triggers rate-limit cooldowns, the router switches (`daybreakSwitched: true`) immediately to secondary cloud backends or zero-cost local inference without failing user turns.

### 2.5.3 Multi-Agent War Room, Kanban DAG and Lead Orchestrator: src/agents/war-room
- **Architecture:** Stateful OOP service (`WarRoomOrchestratorService`) managing pure DOP session models (`WarRoomSession`), member states (`WarRoomMember`), and task DAGs (`KanbanTaskCard`).
- **Core Orchestration Mechanics:**
  - *Specialist Roles:* Coordinates `lead`, `coder`, `researcher`, `auditor`, and `verifier` agents.
  - *Kanban DAG State Machine:* Strict linear transitions: `backlog -> in_progress -> review -> done`.
  - *Sibling Thread Forking:* Lead agent can branch sub-sessions to parallelize investigation or implementation.
  - *Child Approval Relay:* Safely intercepts dangerous tool calls within child threads, escalating approval requests to the parent War Room lead or human operator (`ChildApprovalRelayRequest`).
  - *Collective Skill Mesh:* Automatically exposes proven EvoLoop skills to all member subagents in the room.

### 2.5.4 Cory Knowledge Scribe, Memory Wiki and Zero-Stall Compaction: src/memory/knowledge-scribe.ts
- **Architecture:** Stateful OOP service (`CoryKnowledgeScribeService`) running pure functional transformations (`compileWikiTopicPages()`, `generateMemoryAuditPanelMarkdown()`).
- **Capabilities:**
  - *Browsable Memory Wiki:* Compiles durable memories, decisions, and constraints into cross-linked Markdown topic pages under `~/.coreblow/memory/wiki/<slug>.md` across 6 categories: `architecture`, `decisions`, `constraints`, `workflows`, `daily_log`, `identity`.
  - *Memory Audit Panel:* Renders read-only, sanitized views of `USER.md`, `MEMORY.md`, and `CONSTRAINTS.md` for cockpit monitoring.
  - *Zero-Stall Prepared Compaction:* Asynchronous background pre-compaction computing `PreparedCompactionArtifact`. Pins the active user request (`activeHumanRequest`) and deterministic tool schema hash (`toolDefinitionsHash`), mathematically guaranteeing prompt cache preservation across session boundaries.

### 2.5.5 Universal Workspace Profile Importer: src/migration/universal-agent-importer.ts
- **Architecture:** Unified importer service supporting 6 formats: `coreblow-bundle`, `standard-agents-md`, `claude-code`, `cursor`, `codex`, `windsurf`.
- **Security and Extraction Pipeline:**
  - *Path Traversal Defense:* Resolves and sandboxes paths strictly inside target roots; rejects `../` breakouts and cyclic symlinks.
  - *Zero-Leak Secret Redaction (`redactSensitiveText`):* Neutralizes API keys, bearer tokens, OAuth credentials, and private keys (`sk-ant-...`, `sk-...`, `ghp_...`, `xoxb-...`, `AIza...`, `PRIVATE KEY`).
  - *Preview-First Dry Run:* Generates deterministic `ImportedAgentBundle` reports detailing detected memories, rules, MCP servers, and sanitized skills before committing changes to Cory Memory.

### 2.5.6 Autonomous Git and PR Workflow Orchestrator: src/agents/pr-workflow
- **Architecture:** Stateful OOP orchestrator (`PrWorkflowOrchestratorService`) enforcing pure DOP gate evaluation (`evaluatePrPreFlightGates()`).
- **5-Gate Pre-Flight Pipeline:**
  1. `typecheck`: Enforces zero TypeScript compile errors.
  2. `linter`: Enforces zero Oxlint / style warnings.
  3. `unit_tests`: Enforces green Vitest test status.
  4. `secret_scan`: Enforces zero unredacted API keys or private tokens in diff.
  5. `forbidden_paths`: Blocks modifications to sensitive or private directories (`.env`, `.agents/`, `.evidence/`, `docs/ANTIGRAVITY_*`).
- **Deterministic PR Synthesis:** Generates standardized GitHub-ready PR Markdown bodies detailing changes, motivation, verification evidence, and security checklists.

### 2.5.7 Interactive Multi-Surface Plugin Views in Chat: src/plugins/chat-views
- **Architecture:** Pure DOP renderer (`renderChatNativeView()`) transforming structured plugin view models (`ChatNativePluginView`) into 3 client targets:
  1. *Markdown Card:* Rich text with formatted badges and action links for standard chat surfaces (Discord, Telegram, Slack).
  2. *Web Cockpit HTML Snippet:* Safe HTML snippets for the CoreBlow Web Cockpit interface.
  3. *Structured JSON Blocks:* Canonical DOP payload for native mobile and desktop companion clients.
- **Strict XSS Sanitization:** Neutralizes `<script>`, `javascript:` URIs, and inline `on\w+` event handlers (`onerror=`, `onload=`), guaranteeing safe rendering across untrusted channels.

### 2.5.8 Sovereign Local Voice Companion Telemetry and RTF Guard: src/tts/sovereign-voice-companion.ts
- **Architecture:** Pure DOP telemetry recorder and wake-shortcut state machine.
- **Real-Time Factor (RTF) Enforcement:**
  $$\text{RTF} = \frac{\text{Synthesis Latency (ms)}}{\max(1, \text{Audio Duration (ms)})}$$
- **Sovereign Latency Invariant:** Formally certifies `meetsSovereignTarget: RTF <= 0.40` for local Apple Silicon MLX neural speech generation.
- **Companion State Machine:** Tracks transition states: `idle -> listening -> synthesizing -> speaking -> degraded`.

### 2.5.9 CoreBlow Sovereign Release Certifier: src/infra/release/sovereign-release-certifier.ts
- **Architecture:** Pure DOP release verification engine and deterministic release manifest compiler.
- **5 Sovereign Readiness Gates (`evaluateSovereignReleaseGates`):**
  1. `microkernel_health`: All 12 `REQUIRED_MICROKERNEL_SERVICES` registered and healthy.
  2. `private_artifact_exclusion`: Zero private paths staged (`.env`, `.agents/`, `.evidence/`, `docs/ANTIGRAVITY_*`, internal audits).
  3. `brand_sovereignty`: Scans source code case-insensitively against forbidden competitor brand tokens.
  4. `security_invariants`: Verifies zero unredacted API keys or secrets (`sk-...`, `ghp_...`).
  5. `corehub_catalog_integrity`: Verifies CoreHub catalog meets minimum package threshold ($\ge 15$ packages).
- **Deterministic Release Manifest:** Generates `CoreBlowReleaseManifest` with SHA-256 integrity hash over canonical JSON payload:
  $$\text{manifestSha256} = \text{SHA256}(\text{canonicalJson}(\text{product}, \text{version}, \text{releaseChannel}, \text{kernelServiceNames}, \text{gateResults}))$$

---

## 3. Production Hardening and Security Guardrails

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

### 3.3 Reversible Compaction and Immutable Governance Tags (OWASP ASI06, ASI07)
During long-running multi-day sessions, context compaction risks stripping safety rules or prompt guardrails:
1. **Immutable Governance Tags:** All system-level instructions, enterprise security policies, and tool execution constraints are decorated with `@governance(immutable)` metadata.
2. **Mathematical Eviction Immunity:** The 3-stage compaction engine treats immutable tags as non-evictable. Compaction algorithms are mathematically constrained to only summarize or prune unpinned user messages and raw tool outputs.
3. **Reversible Scratchpad Offloading:** When intermediate tool artifacts are offloaded to `~/.coreblow/scratchpad/`, the compaction engine inserts a two-way pointer:
   ```
   [Offloaded Output: tool=git-diff ref=sha256:4a8b... size=142KB path=~/.coreblow/scratchpad/4a8b.dat]
   ```
   If a subsequent turn requires the full raw trace, the agent can invoke the built-in `expand_scratchpad_artifact` tool to selectively recall the data.

### 3.4 ACP Hardening and Denial of Service Defense (OWASP ASI08)
Autonomous subagent execution creates serious resource exhaustion and denial-of-service exposure (mitigating risks such as CVE-2026-84288):
1. **Worker-Thread Execution Timeouts:** Every ACP subagent session runs in a dedicated worker thread governed by an unyielding execution deadline (default: 120 seconds). When the deadline expires, the thread is forcefully terminated, active socket handles are closed, and resources are reclaimed.
2. **Deterministic Step Limits:** Agent loops enforce an upper bound on reasoning iterations (default: 25 turns per task). If an agent enters an infinite loop, the circuit breaker triggers and returns a structured failure report.
3. **Strict `trustedProxies` Deny-by-Default:** Gateway HTTP/WebSocket servers deny proxy headers (`X-Forwarded-For`, `X-Real-IP`) by default unless the connecting client matches an explicitly configured IP CIDR block in `trustedProxies`. This prevents IP spoofing and bypass of rate-limiting controls.

### 3.5 EvoLoop Zero-Trust 3-Gate Security (OWASP ASI03, ASI05)
Autonomous self-learning must never introduce backdoor payloads, privilege escalation, or arbitrary code execution:
1. **Gate 1 (Zone 0 Prohibition):** Synthesis requests originating from untrusted public channels (Zone 0) are unconditionally rejected. Only authenticated operator sessions (Zone 2) or verified internal multi-agent sessions can trigger skill extraction.
2. **Gate 2 (AST and Static Regex Scanning):** Extracted skill markdown is parsed and scanned against malicious code patterns (`eval()`, dynamic `Function()`, `child_process`, `fs.rmdir`, unauthorized networking, and private credential leaks).
3. **Gate 3 (Canary Quarantine and Wilson Fitness Gate):** Newly distilled skills enter a sandboxed `candidate` state. They are promoted to `canary` only upon passing simulated validation, and achieve `verified_active` status only after maintaining a Wilson lower-bound fitness score $\ge 0.70$ over repeated real-world invocations.

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

### 4.2 Extension SDK Dynamic Barrier
The public plugin SDK is partitioned into decoupled domain barrels:
- `coreblow/plugin-sdk/channel`: Channel lifecycle contracts, message envelope types, pairing guard hooks.
- `coreblow/plugin-sdk/provider`: Custom AI model provider integrations and streaming contracts.
- `coreblow/plugin-sdk/tool`: Dynamic tool registration, schema definitions, and sandboxed execution handlers.
- `coreblow/plugin-sdk/memory`: Memory reader/writer adapters and semantic search interfaces.
- `coreblow/plugin-sdk/approval`: Operator interactive confirmation and human-in-the-loop authorization gates.

---

## 5. Architectural Quality Attributes and Verification

To maintain architectural integrity across continuous commits, every change must pass the sovereign CoreBlow verification gates:
1. **TypeScript Type Safety:** `./node_modules/.bin/tsgo --noEmit` (strict TypeScript validation with zero suppressions across `src/`).
2. **Lint and Code Style:** `./node_modules/.bin/oxlint -c .oxlintrc.json src/` (zero warnings, zero errors).
3. **Colocated Test Suites:** `./node_modules/.bin/vitest run` (Vitest with V8 coverage enforcement > 70%).
4. **Sovereign Brand Purity Gate:** Case-insensitive verification confirming zero competitor brand names across documentation and source trees.
5. **Sovereign Release Certification:** `compileSovereignReleaseManifest` evaluating all 5 readiness gates (`microkernel_health`, `private_artifact_exclusion`, `brand_sovereignty`, `security_invariants`, and `corehub_catalog_integrity`) with deterministic SHA-256 release manifest output.
