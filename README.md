<p align="center">
  <img src="https://raw.githubusercontent.com/coreblow/coreblow/main/.github/assets/logo.svg" width="96" alt="CoreBlow" />
</p>

# CoreBlow - Enterprise AI Gateway

[Website](https://coreblow.com) |
[Docs](https://docs.coreblow.com/) |
[CLI](https://docs.coreblow.com/cli) |
[Configuration](https://docs.coreblow.com/configuration) |
[Security](https://docs.coreblow.com/security) |
[npm](https://www.npmjs.com/package/coreblow)

CoreBlow is a self-hosted AI gateway and agent runtime for operators who need a
gateway-first assistant platform: model flexibility, messaging automation,
controlled tool execution, and a plugin system that runs under their own
infrastructure.

The runtime is built around enterprise OOP patterns: service classes,
dependency injection, registries, explicit runtime boundaries, and a public
plugin SDK. It can run locally, in Docker, or as a managed gateway process while
keeping agent state, credentials, and operational policy under the operator's
control.

If you want a personal assistant stack with enterprise-style boundaries,
operator-owned infrastructure, and a TypeScript OOP architecture, CoreBlow is
the project.

Supported provider paths include local Ollama, OpenAI-compatible APIs,
Anthropic, Gemini, OpenRouter-style routing, and plugin-backed providers.
Supported runtime surfaces include built-in channels, plugin channels,
WebSocket clients, Control UI, cron, nodes, and MCP/ACP integration.

## Product Direction

CoreBlow is designed as a lightweight, local-first AI operating runtime rather
than an all-in-one bundle. Its kernel provides the capabilities required for a
useful first run: Cory built-in memory, AI provider routing, vector/RAG,
browser, voice, tools, security, and the plugin host.

The kernel uses a Hybrid OOP/DOP model: OOP owns stateful resources and
lifecycle boundaries such as services, registries, connections, and plugin
hosts; DOP owns immutable data contracts and pure high-throughput transforms
such as routing, context assembly, and policy evaluation. This keeps runtime
ownership explicit without making hot paths depend on unnecessary object state.

CoreHub is the separate on-demand application layer. Community channels and
third-party applications are installed only when an operator needs them, so
they do not become default runtime cost or configuration burden. Kernel
capabilities are never installed or rolled back through CoreHub.

CoreBlow also follows an evidence-first engineering method: clarify intent,
approve a design, make small testable changes, verify runtime behavior, and
only then declare completion. The goal is to combine immediate usability,
extensibility, and rigorous verification without copying another product's
architecture.

## Install

Runtime: Node.js 22.12 or newer.

```bash
npm install -g coreblow
coreblow onboard
coreblow gateway run
```

`coreblow onboard` walks through the gateway, workspace, model provider,
channel, and skills setup. The default local gateway port is `18789`.

## Quick Start

Source checkout:

```bash
git clone https://github.com/coreblow/coreblow.git
cd coreblow
pnpm install
pnpm coreblow onboard
pnpm coreblow gateway run
```

Docker Compose:

```bash
docker compose up -d
```

The Compose profile publishes port `3000` by default for containerized
deployments.

## Security Defaults

CoreBlow defaults to local operation and expects exposed deployments to be
explicitly configured.

- Set `COREBLOW_GATEWAY_TOKEN` for gateway authentication in non-local setups.
- Keep the gateway bound to loopback unless LAN, tailnet, or proxy exposure is
  intentional.
- Use approval policy for shell execution and other sensitive tools.
- Keep secrets in environment variables, credential refs, or configured secret
  providers rather than committing plaintext config.
- Run `coreblow doctor`, `coreblow security audit`, and
  `coreblow plugins policy audit --refresh` before exposing the gateway or
  shipping a production image with CoreHub-managed plugins.

## Highlights

- **12-Service Hybrid OOP/DOP Microkernel**: Enterprise OOP lifecycle boundaries with lightweight Data-Oriented Programming (DOP) on hot paths, achieving `< 1ms` sub-millisecond cold boot.
- **Cory Long-Term Memory & Scribes**: Persistent semantic memories, episodic journals, entity graph, browsable Wiki (`docs/wiki/`), and zero-stall prepared compaction (`src/memory/`).
- **EvoLoop Skill Synthesizer**: Continuous closed-loop distillation, validation, and automated promotion of reusable skills (`src/learning/`).
- **6-Tier Adaptive Decision Router**: Dynamic routing with Daybreak failover across local Ollama, cloud LLMs, and specialized reasoning models with quota-window tracking (`src/providers/decision-router.ts`).
- **War Room & Kanban DAG**: Multi-agent consensus room, hierarchical delegation, DAG turn coordinator, and round-robin dispute resolver (`src/agents/war-room/`).
- **5-Gate Autonomous PR Workflow**: Autonomous git/PR workflow engine with lint, type-check, test, security, and cleanliness validation gates (`src/agents/pr-workflow/`).
- **Live Sovereign MCP Bridge**: Stdio and JSON-RPC Model Context Protocol server exposing microkernel tools and resources to external AI clients (`src/mcp/`).
- **Controlled Plugin Host & Store**: CoreHub cryptographic signing, granular capability sandboxing, and dynamic chat views (`src/plugins/`).
- **Sovereign Local Voice Companion**: Low-latency voice companion runtime with audio frame telemetry and local neural TTS (`src/tts/`).
- **Omni-Platform Native Companions**: Native Swift apps for macOS (with local MLX TTS) & iOS, Jetpack Compose for Android, plus hardware edge nodes (ESP32, Windows).

## Architecture

CoreBlow is structured as a modular 12-Service Microkernel with explicit module boundaries:

| Path | Responsibility | Microkernel Tier |
| --- | --- | --- |
| `src/gateway/` | Gateway server, RPC/API surface, WebSocket control plane, and 12-Service DI container (`MicrokernelRegistryService`). | Kernel Host |
| `src/memory/` | Cory long-term semantic memory, entity graph, Knowledge Scribes, browsable wiki, and compaction (`CoryMemoryService`, `KnowledgeScribeService`). | Cognitive Subsystem |
| `src/learning/` | EvoLoop Skill Synthesizer, DOP skill distiller, and per-skill lock registry (`SkillSynthesizerService`). | Cognitive Subsystem |
| `src/providers/` | 6-Tier Adaptive Decision Router, Daybreak failover, quota windows, and streaming handlers (`DecisionRouterService`). | Inference Routing |
| `src/agents/` | Single-agent turn coordinator, War Room multi-agent DAG, and autonomous PR workflow engine (`WarRoomService`, `PrWorkflowService`). | Agent Orchestration |
| `src/plugins/` | Plugin registry, CoreHub App Store lifecycle, trust policies, and interactive chat views (`AppStoreRuntimeService`, `ChatViewService`). | Extensibility Host |
| `src/tts/` | Sovereign local voice companion runtime, audio frame buffers, and neural synthesis (`SovereignVoiceService`). | Sensory & Voice |
| `src/mcp/` | Model Context Protocol (MCP) bridge, live JSON-RPC & stdio tool server (`SovereignMcpBridgeService`). | Protocol & Tools |
| `src/migration/` | Universal Workspace Profile Importer for external agent configs (`UniversalAgentImporterService`). | Interoperability |
| `src/infra/release/` | Release certification, brand purity audit, and GA readiness verification (`ReleaseCertifierService`). | Governance |
| `src/cli/` | Operator CLI commands, interactive onboard wizard, and health audits. | User Interface |
| `src/security/` | Audits, policy checks, profiles, approvals, and sandboxing guardrails. | Governance |
| `apps/` | Omni-platform native companion clients (macOS, macOS MLX TTS, iOS, Android, shared Swift). | Native Clients |
| `extensions/` | Controlled workspace plugin packages managed via CoreHub. | App Store Layer |

## Omni-Platform Client Surfaces & 26-Repo Ecosystem

CoreBlow operates as the sovereign microkernel at the center of a coordinated 26-repository ecosystem:

| Tier | Ecosystem Scope | Key Repositories & Surfaces |
| --- | --- | --- |
| **Monorepo** | Core Operating Kernel & Native Clients | `coreblow` (Monorepo with `apps/macos`, `apps/macos-mlx-tts`, `apps/ios`, `apps/android`) |
| **Tier 1** | Native Desktop & Menubar Clients | `corebar`, `corechat`, `corekit`, `coredex` |
| **Tier 2** | Lightweight Nodes & Hardware Edges | `coreblow-windows-node`, `esp-coreblow-node`, `dolphin`, `corebox` |
| **Tier 3** | App Store, Trust & Distribution | `corehub`, `trust`, `plugin-lab` |
| **Tier 4** | Packaging, Telemetry & Infrastructure | `homebrew-tap`, `nix-coreblow`, `nix-coreblow-tools`, `coreblow-ansible`, `corebench`, `coreblow-rtt`, `coregrit-reports`, `corewatch`, `corewatch-state`, `corepatch` |
| **Tier 5** | Documentation, Community & Recipes | `coreblow.com`, `docs`, `community`, `cookbook` |

For the complete architectural blueprint and extensibility guide, see:
- [Ecosystem & Extensibility Blueprint](docs/ECOSYSTEM_MAP.md) - Full 26-repo fleet mapping, Two-Tier extensibility (CoreHub plugins vs. open community `SKILL.md` V2), and step-by-step developer guide.
- [Architecture Blueprint](docs/ARCHITECTURE.md) - Deep architectural specification of the 12 microkernel services.
- [Master PRD](docs/PRD.md) - Product Requirements Document and capability breakdown.
- [Phased Roadmap](docs/PHASE5_TO_7_ROADMAP.md) - Completed and future milestones.

## Security Model

CoreBlow treats the gateway as the control plane and makes operator policy
explicit.

- Gateway authentication supports token and password-backed flows.
- Tool approval modes govern sensitive actions.
- Exec policy and sandbox controls limit high-risk execution paths.
- Secret redaction is applied to config and command output.
- Audit logs record gateway and tool activity.
- Local security checks are available through CLI audits.
- Remote or internet-facing deployments should use strong gateway credentials,
  strict origin/proxy configuration, and an intentional bind mode.

Read the security guide before exposing the gateway:
[https://docs.coreblow.com/security](https://docs.coreblow.com/security)

## Operator Quick Refs

| Goal | Command |
| --- | --- |
| Start guided setup | `coreblow onboard` |
| Edit runtime config | `coreblow configure` |
| Run gateway in foreground | `coreblow gateway run` |
| Check gateway service and reachability | `coreblow gateway status` |
| Show channel and session status | `coreblow status --all` |
| Fetch health from the running gateway | `coreblow health --json` |
| Inspect model provider state | `coreblow models status` |
| Send a channel message | `coreblow message send --help` |
| Manage plugins | `coreblow plugins --help` |
| Audit CoreHub plugin trust | `coreblow plugins policy audit --refresh` |
| Manage exec approvals | `coreblow approvals --help` |
| Run health checks and repairs | `coreblow doctor` |
| Run security audit | `coreblow security audit` |

## Development

```bash
pnpm install
pnpm check
pnpm test
pnpm build
```

Useful development commands:

```bash
pnpm coreblow --help
pnpm coreblow --dev gateway
pnpm test:gateway
pnpm typecheck
```

Release and publish workflows are operator-controlled. Do not change version
numbers or publish packages without explicit release approval.

## Docs by Goal

- New setup: [https://docs.coreblow.com/install](https://docs.coreblow.com/install)
- CLI commands: [https://docs.coreblow.com/cli](https://docs.coreblow.com/cli)
- Gateway operation: [https://docs.coreblow.com/gateway](https://docs.coreblow.com/gateway)
- Configuration reference: [https://docs.coreblow.com/configuration](https://docs.coreblow.com/configuration)
- Providers: [https://docs.coreblow.com/providers](https://docs.coreblow.com/providers)
- Channels: [https://docs.coreblow.com/channels](https://docs.coreblow.com/channels)
- Plugin development: [https://docs.coreblow.com/plugins](https://docs.coreblow.com/plugins)
- Security: [https://docs.coreblow.com/security](https://docs.coreblow.com/security)

## License

CoreBlow is released under the [MIT License](LICENSE).
