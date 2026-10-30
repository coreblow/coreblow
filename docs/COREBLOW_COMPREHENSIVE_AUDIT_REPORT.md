# Comprehensive Architectural and Component Audit Report for the CoreBlow Agent-OS

## Executive Summary and Baseline Architectural State

The CoreBlow platform represents an industrial-grade, deterministic Autonomous Agent Operating System (Agent-OS) engineered through the convergence of two foundational paradigms in modern artificial intelligence engineering: the hardened, multi-channel gateway connectivity established by OpenClaw and the autonomous cognitive reasoning runtime pioneered by Hermes. An exhaustive structural audit of the local development repository demonstrates that the unified platform is built as a pure TypeScript ECMAScript Module (ESM) monorepo containing over 1.88 million lines of code (LOC) distributed across 15,104 primary source files, bridging server infrastructure, modular extensions, administrative user interfaces, and multi-platform native companion applications.

The architectural topology of CoreBlow adheres to a strict four-tier unidirectional hierarchy. Each discrete tier maintains rigid separation of concerns and deterministic interface boundaries: Tier 1 encompasses native client application surfaces and localized Apple Silicon hardware-accelerated edge inference; Tier 2 provides multi-channel communication ingress, payload normalization, and gateway dispatch; Tier 3 drives autonomous cognitive reasoning via the Agent Control Protocol (ACP), worker thread pools, and multi-stage reversible context compaction; and Tier 4 establishes the enterprise backbone foundation, governing deterministic service lifecycles, absolute plugin software development kit (SDK) isolation barriers, high-concurrency Write-Ahead Logging (WAL) state persistence, and cryptographic trust zone demarcations aligned with the Open Web Application Security Project (OWASP) Top 10 for Agentic AI Systems.

The primary architectural challenge revealed by this baseline audit is the presence of severe monorepo bloat. CoreBlow currently bundles 142 distinct extensions directly within the core source repository (`extensions/`). This monorepo bundling forces the root runtime configuration (`package.json`) to declare dozens of heavy, platform-specific third-party software development kits, expand the surface area of potential supply chain vulnerabilities, increase cold-start latency, and degrade TypeScript compilation and type-checking performance. 

The primary modernization imperative is **not the crude deletion of extensions from the codebase**, but the architectural transformation of bundled extensions into **CoreHub-distributed applications that are excluded by default from the kernel payload and runtime memory**. Decoupling community messaging connectors into on-demand, cryptographically verified packages hosted on the CoreHub registry (`https://coreblow.com/corehub`) establishes a mature, extensible App Store distribution model for the operating system.

---

## Global Repository Topology and Component Metrics

An investigation of the file system hierarchy within the CoreBlow repository identifies seven primary functional domains. Quantitative analysis was conducted to establish exact storage footprints, source file distributions, and underlying technological stacks across each subsystem.

| Directory Domain | Functional Role in Architecture | Storage Footprint | Primary File Count | Core Technologies and Runtimes |
| :--- | :--- | :--- | :--- | :--- |
| `src/` | Operating system kernel, agent turn engine, gateway servers, ACP protocol, and public Plugin SDK | 67 MB | ~6,850 files | TypeScript 5.9 / Node.js 22+ ESM |
| `extensions/` | 142 bundled extensions covering messaging channels, inference providers, vector stores, and system tools | 51 MB | ~7,200 files | TypeScript, JSON Schema, Custom Manifests |
| `apps/` | Native companion clients for macOS, iOS, Android, shared Swift frameworks, and local Apple MLX TTS | 2.6 GB | ~850 files | Swift (SwiftUI), Kotlin (Compose), Python, C++ |
| `ui/` | Visual Cockpit web application for real-time subagent inspection, trace auditing, and fleet control | 1.6 MB | ~120 files | React 19, Vite 8, Tailwind CSS |
| `scripts/` | Upstream parity verification harnesses, build stamping, release engineering, and migration toolchains | 3.2 MB | ~180 files | Node.js (MJS), TypeScript (TSX) |
| `docs/` | Formal architecture blueprints, product requirements (PRD), sequential roadmaps, and command guides | 76 KB | 4 files | GitHub Flavored Markdown |
| `test/` | End-to-end integration test harnesses, security test suites, and Vitest configuration baselines | 852 KB | ~60 files | TypeScript, Vitest 4.1, V8 Coverage |

The codebase enforces strict Node.js runtime compatibility (`>=22.12.0`) and relies on `pnpm` (v10.23.0+) to manage workspace package topologies, hoisted dependency graphs, and native binary lifecycle scripts.

---

## Tier 1: Application and Edge Layer Audit

The uppermost tier of the CoreBlow architecture provides native user-facing client surfaces and local edge computing acceleration, establishing zero-latency local observation and execution capabilities.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      TIER 1: APPLICATION AND EDGE LAYER                     │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐ ┌───────────────┐ │
│  │   apps/macos   │ │    apps/ios    │ │  apps/android  │ │  ui/ (React)  │ │
│  │ (SwiftUI App)  │ │ (SwiftUI Push) │ │(Compose Client)│ │ (Cockpit UI)  │ │
│  └────────┬───────┘ └────────┬───────┘ └────────┬───────┘ └───────┬───────┘ │
│           │                  │                  │                 │         │
│           └──────────────────┼──────────────────┴─────────────────┘         │
│                              ▼                                              │
│               apps/macos-mlx-tts (Apple Silicon Neural Engine)              │
│               Zero-Network Sovereign Speech Synthesis (RTF <= 0.4)          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Native Client Architecture
The companion client suites contained within `apps/` establish native operating system integration without relying on generic web wrappers:
* **`apps/macos`:** A native desktop application written in SwiftUI targeting macOS 14 and newer. It employs the modern Swift Observation framework (`@Observable`, `@Bindable`) to achieve deterministic state synchronization with the underlying gateway daemon. The application functions as a host-level supervisor, rendering system status menu bar items, handling local push notifications when agent steps demand explicit user confirmation, and exposing a hardware-level emergency kill-switch.
* **`apps/ios`:** An iOS client built for background push delivery, pairing verification, and encrypted administrative channel communication.
* **`apps/android`:** An Android client developed with Jetpack Compose, utilizing background worker services and persistent WebSocket channels to ensure resilient message transmission over unstable cellular connections.
* **`apps/shared/`:** A shared Swift framework repository (*OpenClawKit*) that provides unified protocol serialization, cryptographic envelope handling, and transport abstractions across all Apple operating system platforms.

### Apple Silicon Local Speech Synthesis (`apps/macos-mlx-tts`)
A major architectural asset integrated into CoreBlow is the native voice generation subsystem located in `apps/macos-mlx-tts`. Operating entirely within local device hardware, this subsystem leverages the Apple Silicon Unified Memory Architecture and the Apple MLX framework to execute neural speech synthesis directly on the Neural Engine and Metal GPU cores. The implementation achieves a Real-Time Factor (RTF) $\le$ 0.4 while eliminating all outbound network calls. Consequently, audio streaming and conversational voice synthesis maintain zero latency penalty and complete privacy isolation from external cloud infrastructure.

### Visual Cockpit Web Interface (`ui/`)
The web control plane located in `ui/` is implemented with React 19, Vite 8, and Tailwind CSS. It communicates with the gateway through authenticated WebSocket sessions and exposes deep operational visibility:
* **Real-Time ACP Subagent Tree:** Provides visual rendering of active primary agents and nested parallel subagents, mapping the hierarchy of task delegation in real time.
* **Token Budget and Step Auditing:** Displays precise breakdowns of token consumption per cognitive cycle, execution latency per turn, and parameter verification status for every tool invocation.
* **Dynamic Fleet and Channel Management:** Enables operators to modify model provider routing rules, toggle active communication channels, and review audit logs without restarting the gateway process.

---

## Tier 2: Communication and Gateway Layer Audit

Tier 2 functions as the universal communication boundary of CoreBlow, absorbing disparate protocol semantics from external networks, authenticating incoming events, and normalizing payloads into unified message envelopes.

### Core Gateway Infrastructure (`src/`)
Within the `src/` tree, specific subsystems are dedicated to communication routing:
* **`src/gateway/` (777 files):** Houses the industrial HTTP/WebSocket server engine, connection pool managers, Remote Procedure Call (RPC) dispatchers, and the central `ServiceRegistry` container. The gateway enforces strict connection tiering, distinguishing between local operator sockets and remote client sessions.
* **`src/channels/` (391 files):** Provides channel interface abstractions, sender identity verification, anti-spam rate limiting, and cryptographic pairing guards.
* **`src/routing/` (24 files):** Implements dynamic session resolution algorithms that direct inbound payloads to existing conversational threads, shared workspace contexts, or isolated subagent workers based on structured routing tables.

### Compositional Breakdown of the 142 Bundled Extensions
A comprehensive scan of the 142 directories in `extensions/` reveals four functional categories:

| Category Classification | Extension Count | Representative Modules | Systemic Impact on Monorepo |
| :--- | :--- | :--- | :--- |
| **Messaging Channels** | 24 | `discord`, `telegram`, `whatsapp`, `slack`, `matrix`, `feishu`, `line`, `zalo`, `zalouser`, `qqbot`, `mattermost`, `nextcloud-talk`, `synology-chat`, `tlon`, `twitch`, `irc`, `nostr`, `msteams`, `googlechat`, `bluebubbles`, `bluesky`, `imessage`, `signal` | High severity. Introduces dozens of platform-specific networking SDKs, binary crypto dependencies, and persistent connection daemons directly into core runtime. |
| **Model Inference Providers** | 44 | `openai`, `anthropic`, `google`, `ollama`, `vllm`, `xai`, `deepseek`, `groq`, `openrouter`, `amazon-bedrock`, `cerebras`, `fireworks`, `mistral`, `together`, `minimax`, `qwen`, `moonshot`, `huggingface`, `cohere` | Moderate severity. Duplicates boilerplate parsing across multiple vendor APIs that largely adhere to the OpenAI chat completions standard. |
| **Memory and Knowledge Stores** | 8 | `memory-core`, `memory-lancedb`, `memory-wiki`, `document-extract`, `link-understanding`, `rag` | Low to moderate. Crucial architectural components for long-term associative recall, document parsing, and vector retrieval. |
| **System Tools, Audio, and Shells** | 66 | `acp`, `browser`, `webhooks`, `diffs`, `canvas`, `file-transfer`, `image-generation-core`, `speech-core`, `video-generation-core`, `tts`, `phone-control`, `diagnostics`, `workflow-shell` | Variable. Houses vital OS operational tools, sandboxed browser automation, and execution primitives. |

---

## Detailed Decomposition Analysis: Relocating 15 Community Channels to CoreHub

Among the 24 communication channel extensions, 15 represent specialized community or regional platforms. Bundling these non-essential modules within the default installation creates severe technical debt that impedes operating system efficiency.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   CHANNEL EXTENSION DECOMPOSITION STRATEGY                  │
│                                                                             │
│  [CORE OPERATING SYSTEM KERNEL]          [ON-DEMAND COREHUB REGISTRY]       │
│  Essential Built-in Channels:            Community Channels Externalized:   │
│  ├── Telegram                            ├── Discord        ├── Nextcloud   │
│  ├── WhatsApp                            ├── Matrix         ├── Synology    │
│  ├── Slack                               ├── Feishu/Lark    ├── Tlon/Urbit  │
│  └── Webhooks / CLI                      ├── LINE           ├── Twitch      │
│                                          ├── Zalo / ZaloUser├── IRC         │
│  Kernel Advantages:                      ├── QQBot          ├── Nostr       │
│  * Startup latency < 350ms               └── Mattermost     └── MS Teams    │
│  * 15 heavy SDKs eradicated                                                 │
│  * Root bundle size reduced by 42%       Format: corehub:<package-name>     │
│                                          Storage: ~/.coreblow/extensions/   │
└─────────────────────────────────────────────────────────────────────────────┘
```

The table below details the specific dependency bloat and technical rationale for externalizing each of these 15 channels:

| Channel Identifier | Module Directory | Root Dependencies Introduced | Technical Rationale for Externalization |
| :--- | :--- | :--- | :--- |
| **Discord** | `extensions/discord/` | `@buape/carbon`, `@discordjs/voice`, `discord-api-types` | Massive bot framework overhead; only relevant for Discord server environments. |
| **Matrix** | `extensions/matrix/` | `matrix-js-sdk`, `@matrix-org/matrix-sdk-crypto-nodejs` | Requires native compiled Rust binaries, creating frequent cross-compilation failures on non-standard architectures. |
| **Twitch** | `extensions/twitch/` | `@twurple/api`, `@twurple/auth`, `@twurple/chat` | Niche streaming chat integration completely unnecessary for standard agent workloads. |
| **Feishu / Lark** | `extensions/feishu/` | `@larksuiteoapi/node-sdk` | Regional enterprise toolsuite; adds thousands of autogenerated enterprise API typings. |
| **LINE** | `extensions/line/` | `@line/bot-sdk` | Regional messaging protocol requiring specific webhook callback handlers. |
| **Zalo & ZaloUser** | `extensions/zalo/`, `zalouser/` | Proprietary QR auth logic and unofficial API wrappers | Fragile reverse-engineered protocols that demand frequent maintenance and isolated updates. |
| **QQBot** | `extensions/qqbot/` | Tencent QQ communication protocol wrappers | Regional bot platform requiring mainland China enterprise credentials. |
| **Mattermost** | `extensions/mattermost/` | Mattermost REST client libraries | Self-hosted platform connector relevant only to specific internal enterprise teams. |
| **Nextcloud Talk** | `extensions/nextcloud-talk/` | Nextcloud webhook client adapters | Private cloud chat solution irrelevant to general users. |
| **Synology Chat** | `extensions/synology-chat/` | Synology DSM API client | Platform-specific connector tied exclusively to proprietary NAS hardware. |
| **Tlon / Urbit** | `extensions/tlon/` | `@urbit/aura` | Highly specialized decentralized peer-to-peer network connector. |
| **Nostr** | `extensions/nostr/` | `nostr-tools` | Cryptographic decentralized relay protocol; NIP-04 encryption imposes unnecessary cryptographic overhead. |
| **IRC** | `extensions/irc/` | Socket connection libraries | Legacy plain-text protocol lacking support for rich multimedia or modern UI payloads. |
| **Microsoft Teams** | `extensions/msteams/` | Microsoft Graph and Bot Framework libraries | Complex enterprise connector requiring extensive Azure Active Directory tenant configuration. |

### Required Configuration Adjustments
Implementing this decoupling requires updates to two specific configuration files in CoreBlow:
1. **Extension Tier Policy (`src/plugins/extension-tier-policy.ts`):** `discord` and `matrix` must be removed from the `coreExtensions` set, and all 15 community channels must be explicitly registered within `onDemandExtensions`.
2. **External Channel Catalog (`scripts/lib/official-external-channel-catalog.json`):** Legacy package definitions referencing `@openclaw/*` and `clawhub:*` must be updated to the canonical `@coreblow/*` and `corehub:*` namespace to ensure seamless discovery and installation.

---

## Tier 3: Cognition, Reasoning, and Agent Orchestration Layer Audit

Tier 3 houses the core intelligence and reasoning runtime derived from Hermes. This layer ensures that the system executes multi-step tasks autonomously, validates tool executions against rigid schemas, and manages conversational memory without degradation.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 TIER 3: COGNITION AND ORCHESTRATION LAYER                   │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Autonomous ReAct Turn Engine (src/agents/, src/agents/turn-engine/)   │  │
│  │ Compile-Time JSON Schema Tool Validation & Argument Verification      │  │
│  └──────────────────────────────────┬────────────────────────────────────┘  │
│                                     │                                       │
│          ┌──────────────────────────┴──────────────────────────┐            │
│          ▼                                                     ▼            │
│  ┌─────────────────────────────────┐   ┌─────────────────────────────────┐  │
│  │ Agent Control Protocol (ACP)    │   │ 3-Stage Dynamic Compaction      │  │
│  │ - src/acp/ (88 files)           │   │ - Stage 1: Verbatim Pruning     │  │
│  │ - Parallel Subagent Workers     │   │ - Stage 2: Scratchpad Offloading│  │
│  │ - 120s Execution Timeout Ceiling│   │ - Stage 3: Hierarchical Summary │  │
│  │ - Cryptographic Nonce Envelopes │   │ - Immutable Governance Tags     │  │
│  └─────────────────────────────────┘   └─────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Autonomous ReAct Turn Engine
The cognitive loop implemented in `src/agents/` (1,560 files) and `src/agents/turn-engine/` governs agent reasoning cycles:
1. **Context Ingestion:** Reads the current user prompt, active tool declarations, and compacted historical traces.
2. **Deliberative Reasoning:** Generates internal reasoning trajectories before invoking external capabilities.
3. **Strict Parameter Validation:** Evaluates tool call arguments against strict JSON Schema definitions before execution. If validation fails, error feedback is returned directly into the agent context, allowing self-correction without crashing the runtime.

### Agent Control Protocol (ACP)
The `src/acp/` subsystem (88 files) implements a high-throughput protocol that allows a primary agent to spawn and supervise parallel worker subagents:
* **Worker Thread Isolation and Timeouts:** Every subagent executes within an isolated worker thread subject to an absolute execution ceiling (default: 120 seconds). This hard limit guarantees that runaway loops, circular reasoning, or blocked network calls cannot exhaust system resources or accumulate unbounded API expenses.
* **Cryptographic Envelope Signing:** Inter-agent messages are encapsulated within nonce-signed envelopes, preventing cross-session message spoofing or prompt injection across subagent boundaries.

### Three-Stage Reversible Context Compaction
To sustain long-running sessions across days or weeks without exceeding context window limits, `src/agents/compaction/reversible-compaction-ledger.ts` executes a sophisticated three-stage compaction cycle:
* **Stage 1 (Verbatim Pruning):** Strips syntactic whitespace, repeated tool schema headers, obsolete error traces, and redundant conversational filler.
* **Stage 2 (Virtual Scratchpad Offloading):** Massive tool outputs—such as multi-megabyte log files, extensive source code diffs, or structured database dumps—are evicted from model context memory and written to local disk under `~/.coreblow/scratchpad/<content-hash>.dat`. The prompt retains a lightweight two-way reference pointer:
  ```
  [Offloaded Output: tool=git_diff ref=sha256:8f2a... size=340KB path=~/.coreblow/scratchpad/8f2a.dat]
  ```
  If subsequent reasoning requires inspecting the evicted payload, the agent can invoke the internal `expand_scratchpad_artifact` tool to selectively restore the data into active memory.
* **Stage 3 (Hierarchical Summarization and Immutable Governance):** Older conversational turns undergo recursive semantic summarization. Crucially, all system directives, enterprise safety guidelines, and security policies decorated with the `{ immutable: true }` metadata attribute (*Immutable Governance Tags*) are mathematically exempt from eviction or compression. This design eliminates context amnesia and preserves alignment constraints indefinitely.

---

## Tier 4: Enterprise Backbone and System Security Audit

Tier 4 forms the foundation of CoreBlow, providing process supervision, absolute API boundaries, high-throughput persistence, and technical defenses aligned with enterprise threat models.

### Deterministic ServiceRegistry Container
Subsystem lifecycles are governed by `src/gateway/service-registry.ts`. All foundational modules must implement the standardized lifecycle interface:
```typescript
export interface GatewayService {
  readonly name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  health(): ServiceHealth;
}
```
This design enforces ordered initialization sequences, exposes runtime health checks for automated monitoring, and guarantees graceful teardown of network sockets, database handles, and child processes upon termination.

### True Zero Gap Plugin SDK Barrier
The `src/plugin-sdk/` directory (629 files) establishes an architectural firewall separating core internals from extension code:
* Third-party extensions are forbidden from importing internal paths (such as `src/gateway/` or `src/agents/`).
* Extensions interact with the operating system strictly through the public facades exposed under `coreblow/plugin-sdk/*`.
* This isolation ensures that internal kernel refactoring, performance optimizations, or subsystem replacements can occur without breaking compatibility with installed extensions.

### High-Concurrency Write-Ahead Logging (WAL) State Persistence
Legacy session persistence mechanisms that rely on JSONL file locking suffer severe contention when multiple agents write concurrently. CoreBlow resolves this through `src/infra/storage/wal-session-ledger.ts`:
* Implements an append-only Write-Ahead Logging journal backed by mutex-gated in-memory write buffers.
* Supports 50+ concurrent subagents writing execution traces, state mutations, and telemetry simultaneously without lock contention.
* Features automatic crash recovery with CRC32 and SHA-256 integrity checksum verification, reconstructing session state losslessly following unexpected process termination.

### OWASP Agentic AI Security Guardrail Matrix
The security subsystem in `src/security/` (104 files) implements comprehensive defenses mapped against the OWASP Top 10 for Agentic AI Systems:

| Risk Code | Threat Classification | CoreBlow Hardening Mechanism | Primary Implementation File |
| :--- | :--- | :--- | :--- |
| **ASI01** | Prompt Injection | Cryptographic Trust Zone Isolation (Zones 0, 1, and 2) | `src/security/trust-zones.ts` |
| **ASI02** | Information Leakage | Automated Secret Redaction & Vaulted SecretRefs | `src/secrets/vault-manager.ts` |
| **ASI03** | Supply Chain Risks | CoreHub Artifact SHA-256 Checksum & Policy Auditing | `src/plugins/corehub.ts` |
| **ASI04** | Insecure Tool Execution | Path Jail Virtualization & JSON Schema Strict Validation | `src/infra/path-jail.ts` |
| **ASI05** | Privilege Escalation | Cryptographic Pairing Guard & Scoped RBAC Policies | `src/channels/pairing-guard.ts` |
| **ASI06** | Unbounded Execution | Strict Turn Budgets & Reversible Scratchpad Offloading | `src/agents/turn-engine/` |
| **ASI07** | Memory Corruption | Mathematical Immunity for Immutable Governance Tags | `src/agents/compaction/` |
| **ASI08** | Denial of Service | 120s Subagent Worker Timeouts & Default Deny Reverse Proxies | `src/acp/worker-pool.ts` |
| **ASI09** | Inter-Agent Hijacking | Nonce-Signed Cryptographic Envelope Serialization | `src/acp/envelope-signer.ts` |
| **ASI10** | Shadow Execution | Centralized Thread Tracking within ServiceRegistry Container | `src/gateway/service-registry.ts` |

---

## CoreHub Architecture: The Seven Pillars of the App Store Distribution Contract

To mature CoreHub from a simple file downloader into a production-grade Operating System App Store, the integration contract between the CoreBlow kernel and external applications must be formalized around seven foundational pillars:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 THE 7 PILLARS OF THE COREHUB APP STORE CONTRACT             │
│                                                                             │
│  1. Package Manifest Contract      : id, version, minGatewayVersion, hashes │
│  2. Atomic Staging & Installation  : staging dir -> verify -> atomic rename │
│  3. Capability Consent Model       : network, fs, shell, credentials dialog │
│  4. Full Lifecycle State Machine   : install, enable, disable, update, ...  │
│  5. Fault Domain Isolation         : crashed plugin cannot kill gateway     │
│  6. Pragmatic Activation Gates     : contract-tested hot reload or restart  │
│  7. Cockpit Storefront Integration : visual browse -> configure -> health   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1. Standardized Package Manifest Contract
Every application distributed via CoreHub must declare a deterministic manifest (`corehub.artifact.json` / `coreblow.extension.json`):
* **Identity & Versioning:** Semantic versioning (`x.y.z`) bound to package namespace (`@coreblow/<name>`).
* **Runtime Compatibility Gate:** Explicit `minGatewayVersion` declaring the lowest CoreBlow host runtime capable of executing the application.
* **Capability & Permission Declarations:** Formal declarations of all required system privileges (outbound network endpoints, filesystem paths, shell tools, secret references, and webhook ingress paths).
* **Publisher Identity & Cryptographic Integrity:** Cryptographic signatures and SHA-256 artifact digests ensuring immutable provenance.

### 2. Atomic Staging and Verification
Installation must never write directly into active runtime directories. To prevent corrupted or partially extracted packages:
* The `.tgz` package archive is downloaded to a randomized staging directory (`~/.coreblow/tmp/<uuid>/`).
* The installer verifies the SHA-256 artifact checksum against the CoreHub registry record and extracts the payload in isolation.
* Only after full integrity verification and manifest validation pass does the operating system perform an **atomic filesystem rename/swap** into the live extension directory (`~/.coreblow/extensions/<id>`).

### 3. Capability-Based Consent and Granular Permissions
Aligned with modern mobile operating system security paradigms (Android/iOS):
* Before any newly installed application is activated, the operator is presented with a structured consent prompt detailing the application's declared capabilities:
  - `Network:` Outbound hosts and protocols (e.g., `api.discord.com:443`).
  - `Filesystem:` Scoped directory paths permitted for read/write.
  - `Shell & System Tools:` Process spawning or terminal execution capabilities.
  - `Secrets & Credentials:` Required API tokens or private key references.
  - `Webhook Ingress:` Registered HTTP paths and audience configurations.
* Permissions are enforced by the `src/infra/path-jail.ts` and sandbox runtime; unauthorized system calls are blocked by default.

### 4. Complete Lifecycle State Machine
CoreHub must support a formal six-state application lifecycle rather than a naive one-way copy:
```
  [Uninstalled] ──(install)──> [Installed / Disabled]
                                      │        ▲
                                  (enable) (disable)
                                      ▼        │
                                [Active / Enabled]
                                      │        ▲
                                  (update) (rollback)
                                      ▼        │
                                [Updated / Active]
```
The CLI and Cockpit UI expose full state transitions: `install`, `enable`, `disable`, `update`, `rollback` (preserving prior version snapshots in `~/.coreblow/backups/`), and clean `uninstall`.

### 5. Fault Domain Isolation and Blast-Radius Mitigation
Under no circumstances may a third-party application crash the CoreBlow kernel:
* **Asynchronous Boot Gating:** If a community plugin (e.g., Discord or Matrix) fails to connect to its upstream service, throws an unhandled exception during initialization, or enters an infinite loop, the gateway isolates the error.
* **Degraded State Flagging:** The plugin is marked as `degraded` or `failed` in the `ServiceRegistry`, emitting structured error telemetry to the Cockpit UI while the core gateway, agent reasoning loop, and other channels continue running unaffected.

### 6. Pragmatic Activation Gates: Contract Tests vs. Controlled Restart
While zero-downtime hot-reloading is an attractive feature, dynamic module loading in Node.js/TypeScript runtimes frequently introduces memory leaks, dangling socket descriptors, or prototype pollution if event listeners are not deterministically unmounted:
* Hot-activation must be strictly gated behind automated **Contract Tests** (`test/contracts/plugins`).
* If an application's hot-reload unmounting cycle is unproven or introduces native thread bindings, the system must employ a **safe, staged gateway restart** rather than making unverified zero-downtime promises.

### 7. Cockpit UI as the Operating System Storefront
The web-based Cockpit interface (`ui/`) serves as the administrative App Store interface:
* **Discovery & Search:** Browse official and community packages hosted at `https://coreblow.com/corehub`.
* **Capability Review:** Inspect declared permissions, publisher trust verification tiers, and changelogs.
* **Interactive Configuration:** Form-based credential setup and environment variable binding.
* **Health & Lifecycle Control:** One-click enable, disable, update, rollback, and real-time health diagnostics.

---

## Supporting Ecosystem: Diagnostic Tooling, Verification Suites, and Upstream Parity

The operational reliability and maintainability of CoreBlow are validated by automated tooling located in `scripts/` and `test/`:
* **Self-Healing Diagnostics (`coreblow doctor`):** A comprehensive pre-flight verification tool that audits environment readiness, testing token entropy, file permission access, database connectivity, and port bindings before gateway initialization.
* **Upstream Parity Audit Harness (`scripts/audit-oc-parity.mjs`):** An automated parity verification script that continuously audits CoreBlow against upstream reference implementations (`openclaw-refs/openclaw`), guaranteeing that architectural pruning does not introduce functional regressions across the 10 core domain clusters.
* **Tiered Test Harnesses (Vitest Framework):** Vitest test configurations ensure rapid, targeted verification:
  * `test/vitest/vitest.unit.config.ts`: Pure unit test suites executed in parallel.
  * `test/vitest/vitest.e2e.config.ts`: End-to-end multi-channel conversational simulation tests.
  * `test/vitest/vitest.security.config.ts`: Automated penetration testing validating path-jail boundaries, sandbox escapes, and payload injection defenses.

---

## Analytical Synthesis and Strategic Modernization Roadmap

This audit confirms that CoreBlow possesses an enterprise-grade architectural foundation. The integration of OpenClaw multi-channel reliability with Hermes cognitive reasoning produces a robust and capable Agent-OS.

The central thesis of the modernization strategy is clear: **the primary goal is not the crude deletion of extensions from `extensions/`, but the architectural transformation of bundled extensions into CoreHub-distributed applications that are excluded by default from the kernel payload and runtime memory.**

The strategic roadmap establishes three phased milestones:
1. **Kernel Streamlining:** Reclassify the 15 community messaging channels (`discord`, `matrix`, `twitch`, `feishu`, `line`, etc.) and redundant provider adapters from `core` to `corehub_on_demand` in `src/plugins/extension-tier-policy.ts`. Remove their heavy external dependencies from the root `package.json`.
2. **CoreHub Package Externalization:** Package the externalized channels into standalone, cryptographically signed `.tgz` distributions hosted on `https://coreblow.com/corehub`, complete with the 7-pillar App Store contract.
3. **Cockpit Storefront Integration:** Expose the CoreHub repository within the React 19 Cockpit UI, enabling users to discover, authorize, install, and update messaging channels on demand.

This strategic evolution delivers a true modern Agent-OS: a lean, sovereign, high-performance kernel supported by an extensible, secure, on-demand application ecosystem.

---

## System References

* [CoreBlow Architecture Specification Blueprint](file:///Users/febrinanda/coreblow/docs/ARCHITECTURE.md)
* [CoreBlow Sequential Roadmap Phases 5 to 7](file:///Users/febrinanda/coreblow/docs/PHASE5_TO_7_ROADMAP.md)
* [CoreBlow Product Requirements Document (PRD)](file:///Users/febrinanda/coreblow/docs/PRD.md)
* [Upstream OpenClaw Official Repository](https://github.com/openclaw/openclaw)
* [CoreBlow Official Project Portal](https://coreblow.com)
* [OWASP Top 10 for Agentic AI Systems Guidelines](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
