# Product Requirements Document (PRD): CoreBlow Agent-OS

**Document Version:** 1.0.0<br />
**Status:** Active / Engineering Baseline<br />
**Product Canonical URLs:** [https://coreblow.com](https://coreblow.com) | [https://github.com/coreblow](https://github.com/coreblow)<br />
**Documentation Portal:** [https://docs.coreblow.com](https://docs.coreblow.com)

---

## 1. Executive Summary & Vision

### 1.1 Product Vision
CoreBlow is an **Enterprise Autonomous Agent Operating System (Agent-OS)** engineered to run mission-critical autonomous agents across enterprise communication channels, sovereign local hardware, and distributed cloud backends. CoreBlow converges the multi-channel gateway routing of OpenClaw, the cognitive reasoning and agent control protocols of Hermes, and the enterprise-grade object-oriented foundation of CoreBlow.

Modern enterprise agent deployments suffer from three structural failure modes:
1. **Stateless Fragility:** Chatbots and basic ReAct wrappers treat conversations as transient message arrays, dropping multi-day workflows, context state, and tool execution history across channels.
2. **The Lethal Trifecta:** Autonomous agents that combine host machine access, exposure to untrusted public channels, and unconstrained tool execution expose enterprises to severe security vulnerabilities, including prompt injection, data exfiltration, and unauthorized lateral movement.
3. **Architectural Bloat and Fragmentation:** Legacy tools accumulate brittle Python sidecars, duplicate provider wrappers, ad-hoc JSONL file locks, and endless backward-compatibility migration chains that impede reliability and maintainability.

CoreBlow solves these challenges through a unified, high-performance monorepo (**1.88M+ LOC**, **~70% test-to-code ratio**, pure **TypeScript ESM**) operating under the engineering discipline of **"Prune First, Document Fast, Execute Lean"**.

### 1.2 Strategic Convergence

```
   ┌─────────────────────────────────────────────────────────────────┐
   │                       CoreBlow Agent-OS                         │
   └─────────────────────────────────────────────────────────────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         ▼                         ▼                         ▼
  OpenClaw Heritage         Hermes Heritage           CoreBlow Foundation
  • 142 Channel Adapters    • ReAct Cognition         • OOP ServiceRegistry
  • Webhook Normalization   • ACP Protocol            • True Zero Gap SDK
  • Pairing Guard           • Parallel Subagents      • Sovereign MLX TTS
  • Ingress Routing         • Dynamic Compaction      • Fail-Closed Security
```

CoreBlow unifies these capabilities into a single deterministic runtime:
- **From OpenClaw:** Battle-tested channel normalization, multi-platform webhook routing, and pairing authorization.
- **From Hermes:** Advanced autonomous task execution, headless ReAct cognitive loop, parallel subagent orchestration via Agent Control Protocol (ACP), and context compaction.
- **From CoreBlow:** Rigid object-oriented lifecycles (`ServiceRegistry`), strict public SDK barriers (`src/plugin-sdk/`), native Apple Silicon MLX inference, and enterprise governance.

---

## 2. Core Pillars & Value Proposition

### 2.1 Omnipresent Unified Memory
CoreBlow provides continuous session persistence across 142 channel workspaces and native companion applications:
- **Cross-Surface Identity Resolution:** A user interacting via Slack, Discord, Telegram, WhatsApp, macOS desktop app (`apps/macos`), iOS app (`apps/ios`), Android app (`apps/android`), or Web UI (`ui/`) maps to a unified cryptographic session identity.
- **Continuous Working Memory:** Conversations, tool execution artifacts, active plans, and user preferences are retained in structured storage, surviving process restarts, network splits, and channel switches.
- **Deterministic Scratchpad:** Intermediate task files, code generation scratchpads, and execution logs persist in `~/.coreblow/scratchpad/`, allowing long-running multi-day tasks to resume without prompt bloat.

### 2.2 Industrial Resiliency & OOP Lifecycle
CoreBlow replaces loose script execution with an industrial object-oriented lifecycle:
- **Deterministic ServiceRegistry:** Every subsystem (gateway, channels, cognitive turn engine, model providers, telemetry) implements explicit `start()`, `stop()`, and `health()` lifecycles managed by `src/gateway/service-registry.ts`.
- **Fail-Closed Security:** In the event of a configuration fault, signature mismatch, or network partition, subsystems drop into a deterministic degraded state or fail closed rather than continuing with unsafe defaults.
- **Self-Healing Diagnostics:** The integrated `coreblow doctor` subsystem validates environment integrity, detects port conflicts, verifies token entropy, and validates socket connections in real time.

### 2.3 Hybrid & Sovereign AI
CoreBlow maximizes cost efficiency, data sovereignty, and performance through cascaded hybrid model routing:
- **Zero-Cost Edge Inference:** Local Apple Silicon acceleration via `apps/macos-mlx-tts` delivering real-time factor (RTF) <= 0.4 for speech synthesis, coupled with local vLLM, Ollama, and MLX model inference.
- **Cascaded Cloud Routing:** Dynamic model dispatch prioritizing zero-cost local inference for classification, filtering, and simple tasks, cascading to frontier models (Anthropic Claude, Google Gemini, OpenAI GPT) only when high reasoning thresholds are required.
- **Deterministic Fallbacks:** Automated failover to secondary providers on rate-limit (HTTP 429) or server errors (HTTP 5xx) with zero message loss.

### 2.4 True Zero Gap Plugin SDK
CoreBlow enforces an uncompromised isolation barrier between core internals and extensions:
- **Strict Module Boundaries:** Extensions (`extensions/*`) and third-party plugins must import exclusively from `coreblow/plugin-sdk/*` or local barrels (`./api.ts`). Direct imports of `src/**` or cross-extension internals are strictly prohibited and enforced by static analysis gates.
- **Typed Plugin Capabilities:** Manifest-driven capabilities (CLI backends, channels, providers, speech synthesis, document extractors, web fetch) are strongly typed via `src/plugins/manifest.ts` and registered through deterministic contract suites.
- **Safe Sandboxing:** Untrusted community plugins run within capability-gated sandboxes with restricted filesystem, process, and network access.

---

## 3. Deprecation & Anti-Bloat Policy

To maintain high velocity and codebase health, CoreBlow enforces a strict **Deprecation and Anti-Bloat Policy**. Upstream features that add technical debt or compromise determinism are pruned rather than ported.

### 3.1 Hermes Upstream Deprecations
CoreBlow drops legacy standalone wrappers and non-TypeScript runtimes from Hermes:
- **Drop Python Sidecars and Wrappers:** CoreBlow does not use Python subprocesses, virtual environments, or shell glue for cognitive execution. The Hermes cognitive engine is implemented natively in TypeScript ESM under `src/agents/`.
- **Drop Standalone Chat Adapters:** Hermes standalone chat adapters are deprecated in favor of CoreBlow unified channel routing (`src/channels/` and `src/routing/`).
- **Drop Standalone TUI/CLI (`hermes-cli`):** Terminal UI and command-line execution are consolidated into the unified `coreblow` CLI (`src/cli/` and `src/commands/`). Hermes operates purely as a headless cognitive engine communicating over ACP.

### 3.2 OpenClaw Upstream Deprecations
CoreBlow drops legacy compatibility bloat and redundant abstractions from OpenClaw:
- **Drop Sliding-Window Prompt Builders in `src/auto-reply/`:** Primitive message-array slicing in `src/auto-reply/` is deprecated. All memory compaction, context budgeting, and history pruning are centralized in the cognitive orchestration engine (`src/agents/`).
- **Drop Permanent Legacy Compatibility (`openclaw.extension.json`, `clawhub`, `clawbot`, `acpx`):** Legacy manifests, obsolete registry endpoints, branded aliases, and deprecated protocol variants are eliminated. CoreBlow uses canonical names: `coreblow`, `corehub`, `corebot`, and `acp`.
- **Drop Multi-File Legacy Config Migration Chains (`legacy-config-migrations.*.ts`):** OpenClaw maintained dozens of incremental config migration files spanning hundreds of releases. CoreBlow deprecates multi-file migration chains in favor of a single deterministic configuration normalizer and clean CoreBlow-native schema.

### 3.3 Storage & Extension Consolidation
- **Transition to Structured WAL Storage:** Raw concurrent JSONL file writes that suffer from file-lock contention during parallel ACP subagent execution are transitioned to structured Write-Ahead Logging (WAL) and transactional session storage.
- **Consolidate OpenAI-Compatible Boilerplates:** Duplicate provider adapters that merely wrap standard OpenAI-compatible endpoints are consolidated into a single parameterized provider runtime (`src/plugin-sdk/provider-stream-family.ts`).

---

## 4. Product Requirements & Capability Matrix

### 4.1 Functional Requirements

| Capability | Requirement Description | Implementation Surface | Priority |
| :--- | :--- | :--- | :--- |
| **Unified Messaging** | Ingest, normalize, and dispatch messages across 142 channels with thread and media continuity. | `src/channels/`, `src/routing/`, `extensions/*` | P0 |
| **ACP Protocol** | Orchestrate primary agents and parallel subagents over typed Agent Control Protocol envelopes. | `src/acp/`, `src/plugin-sdk/acp.ts` | P0 |
| **ReAct Cognitive Loop** | Multi-turn reasoning with strict JSON schema tool validation, step budgeting, and execution recovery. | `src/agents/`, `src/agents/turn-engine/` | P0 |
| **Dynamic Compaction** | 3-stage context management: verbatim pruning, scratchpad offloading, and recursive summarization. | `src/agents/compaction/` | P0 |
| **ServiceRegistry** | Centralized dependency injection, health monitoring, and graceful shutdown orchestration. | `src/gateway/service-registry.ts` | P0 |
| **Sovereign TTS** | Native Apple Silicon voice synthesis delivering RTF <= 0.4 with zero cloud dependencies. | `apps/macos-mlx-tts/`, `src/tts/` | P1 |
| **CoreHub Marketplace** | Cryptographically verified plugin installation, capability grants, and dependency resolution. | `src/plugins/corehub-install-records.ts`, `src/infra/corehub.ts` | P1 |
| **Native Companion Apps** | Full-featured companion clients for desktop and mobile with background gateway sync. | `apps/macos/`, `apps/ios/`, `apps/android/`, `ui/` | P1 |

### 4.2 Non-Functional Requirements
- **Performance & Latency:**
  - Gateway ingress overhead: < 15ms p99 for webhook normalization.
  - Subagent spawn latency: < 50ms via in-process workers over ACP.
  - Local speech synthesis: Real-Time Factor (RTF) <= 0.4 on Apple Silicon M-series.
- **Reliability & Availability:**
  - 99.99% uptime for core gateway daemon.
  - Zero state loss during abnormal process termination via WAL persistence.
  - Graceful degradation on model provider outages with automatic fallback cascade.
- **Test Coverage:**
  - Strict V8 coverage enforcement (> 70% lines, branches, functions, and statements).
  - Colocated unit tests (`*.test.ts`) and end-to-end integration suites (`*.e2e.test.ts`).

---

## 5. Security & Threat Mitigation: The Lethal Trifecta

Autonomous agents face a unique security threat landscape termed **The Lethal Trifecta**:
1. **Direct Host and Tool Access:** Ability to execute shell commands, read/write filesystem paths, and make arbitrary network requests.
2. **Exposure to Untrusted Public Ingress:** Direct connectivity to public messaging channels (Discord, Slack, Telegram, WhatsApp, Webhooks) where arbitrary third parties can supply input.
3. **Autonomous Agency:** Unsupervised execution loops that interpret natural language and execute tools without human-in-the-loop approval.

CoreBlow systematically neutralizes this trifecta in alignment with the **OWASP Top 10 for Agentic AI Systems**:

```
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      THE LETHAL TRIFECTA                               │
 │                                                                        │
 │   Untrusted Channel Ingress  +  Host Execution  +  Autonomous Agency   │
 └────────────────────────────────────────────────────────────────────────┘
                                     │
                  MITIGATION VIA COREBLOW GUARDRAILS
                                     │
 ┌───────────────────┬──────────────────────┬────────────────────────────┐
 │  Cryptographic    │  Capability Sandboxes│   Immutable Governance     │
 │  Context Isolation│  & Execution Timeouts│   Tags & Pairing Guard     │
 │  (OWASP ASI01)    │  (OWASP ASI04/ASI08) │   (OWASP ASI05/ASI06)      │
 └───────────────────┴──────────────────────┴────────────────────────────┘
```

### 5.1 OWASP Agentic AI Risk Mitigations

#### ASI01: Prompt Injection & Context Pollution
- **Cryptographic Channel Demarcation:** Ingress messages from public channels are cryptographically signed and tagged with trust zone markers (`public-untrusted`, `authorized-user`, `system-operator`).
- **Prompt Isolation Boundary:** Untrusted input is strictly segregated into fenced user content blocks. System directives and tool definitions reside in isolated token spaces that user prompts cannot override.

#### ASI02: Sensitive Information Disclosure
- **Automated PII/Secret Redaction:** Outbound message streams pass through `redactSensitiveText` and identifier masking routines (`src/logging/redact.ts`) before reaching channel transport.
- **Vaulted Credential Management:** Credentials and API keys are stored in encrypted system keychains or environment secret references (`SecretRef`), never written to disk logs or context windows.

#### ASI03: Supply Chain Vulnerabilities
- **CoreHub Manifest Signing:** Plugins installed via CoreHub undergo cryptographic signature verification, manifest hash audits, and dependency vulnerability scans prior to activation.

#### ASI04: Insecure Output Handling & Autonomous Execution
- **Least-Privilege Tool Sandboxing:** Tools executing filesystem or shell operations run inside constrained sandboxes with path traversal guards (`src/infra/boundary-path.ts`) preventing access outside approved workspace roots.
- **Strict Schema Enforcement:** Model tool calls are validated against rigid JSON schemas prior to execution; malformed or ambiguous arguments trigger immediate execution abortion.

#### ASI05: Improper Authorization & Privilege Escalation
- **Pairing Guard:** Public channel contacts must complete an explicit pairing handshake before agent tools or memory write access are unlocked.
- **Operator Scopes:** Dangerous operations (system reconfiguration, plugin installation, process management) require authenticated `operator.write` scopes.

#### ASI06: Excessive Agency & Unbounded Loops
- **Step and Cost Budgeting:** Every agent turn is constrained by strict step counters, execution timeouts, and maximum token budgets.
- **Circuit Breakers:** Repetitive tool failures or cyclical reasoning trigger automatic loop termination and administrative alerting.

#### ASI07: Insufficient Guardrails on Memory & Compaction
- **Immutable Governance Tags:** System instructions, security guardrails, and compliance constraints are tagged as immutable. During 3-stage context compaction, governance tags are mathematically protected from eviction or summarization degradation.

#### ASI08: Denial of Service & Resource Exhaustion
- **Worker Execution Timeouts:** Subagent ACP worker threads are bounded by strict memory caps and CPU timeouts, neutralizing unbounded loop and resource exhaustion vulnerabilities (including patterns such as CVE-2026-84288).
- **Rate-Limited Webhook Ingress:** Public ingress endpoints enforce strict IP-based and user-based token bucket rate limits.

#### ASI09: Insecure Inter-Agent Communication
- **Authenticated ACP Envelopes:** Inter-agent messages exchanged via ACP use signed message envelopes with nonce validation to prevent replay attacks and message tampering.

#### ASI10: Shadow Agents & Unmonitored Execution
- **Centralized ServiceRegistry Tracking:** All active agents, subagents, and background worker threads register with `ServiceRegistry`. Unmonitored execution threads are terminated immediately.

---

## 6. Release & Parity Strategy

CoreBlow transitions from legacy parity accumulation to a lean production baseline:
1. **Prune First:** Eliminate dead code, obsolete migration chains, and unneeded legacy stubs before touching production code.
2. **Document Fast:** Establish canonical architectural blueprints (`docs/ARCHITECTURE.md`) and requirements before executing features.
3. **Execute Lean:** Deliver tightly scoped, fully tested batches adhering strictly to CoreBlow naming (`coreblow`, `corehub`, `corebot`, `acp`) and the True Zero Gap SDK.
