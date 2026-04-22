# CoreBlow Codebase Architecture Analysis

**Scope**: `/Users/febrinanda/coreblow/src`  
**Codebase Size**: ~921,883 lines of TypeScript  
**Analysis Date**: 2026-04-21

---

## 1. MODULE STRUCTURE

The CoreBlow codebase is organized into 60+ major modules, each serving distinct functional domains. The architecture follows a layered pattern with clear separation of concerns.

### Core Layers (Top-Level)

| Module | Purpose | Key Responsibility |
|--------|---------|-------------------|
| **entry.ts / entry.respawn.ts** | CLI entry points | Application bootstrap, respawn handling, environment setup |
| **gateway-entry.ts** | Gateway server entry | HTTP server setup, health probes, channel routing |
| **library.ts** | Public API exports | Lazy-loaded utilities for library consumers |
| **index.ts** | Package root | Re-exports and version control |
| **runtime.ts** | Runtime type definitions | Type contracts for execution environment |
| **globals.ts** | Global state | Verbose/yes flags for CLI |
| **global-state.ts** | Global configuration | Process-wide state management |
| **extensionAPI.ts** | Legacy plugin API | Deprecated compatibility bridge for plugins |

### Major Functional Domains

#### **Agents System** (~800+ files)
The most complex subsystem - coordinates AI agent execution across multiple phases.

- **Core Engine**: `agent-engine.ts` - Unified facade for agent runtime
- **Subagents**: `subagent/` - Multi-agent orchestration with spawning/lifecycle
- **Session Management**: `session-*.ts` - State persistence, transcripts, repair
- **Model Management**: `model-*.ts` - Model selection, auth, fallback policies
- **Tool System**: `bash-tools.ts`, `tool-*.ts` - Command execution, policy, display
- **Skills System**: `skills*.ts` - Modular capabilities management
- **Authorization**: `auth-profiles/` - Authentication credential handling
- **Prompt Engineering**: `prompt-*.ts`, `system-prompt.ts` - Dynamic system prompts
- **Context Management**: `context-*.ts` - Window guards, caching, token estimation
- **CLI Runners**: `cli-runner/` - Legacy CLI backend execution
- **Embedded PI**: `pi-embedded*.ts` - Embedded agent runtime for plugins

**Key Files**:
- `agent-engine.ts` - Core orchestration (session state, tool handling, streaming)
- `agent-engine-config.ts` - Configuration schema
- `model-catalog.ts` - Provider & model registry
- `tool-policy.ts` - Tool approval/denial policies
- `bootstrap.ts` - Agent initialization pipeline
- `compaction.ts` - Conversation truncation for context windows

#### **Plugin System** (~100+ files)
Extensibility framework with runtime contracts and capability matching.

- **Registry**: `registry.ts`, `manifest-registry.ts` - Plugin discovery & metadata
- **Service Loading**: `lazy-service-module.ts` - Deferred module loading
- **Contracts**: `contracts/registry.ts` - Provider capability snapshots
- **HTTP Routes**: `http-registry.ts` - REST endpoint management
- **Command Registration**: `command-registry-state.ts` - CLI commands from plugins
- **API Builder**: `api-builder.ts` - Plugin runtime API construction
- **Runtime**: `runtime/` - Execution context for plugins
- **Memory State**: `memory-state.ts` - Plugin memory hooks
- **Interactive Handlers**: `interactive.ts` - UI component registration
- **Provider Validation**: `provider-validation.ts` - Credential/capability checks

**Key Files**:
- `registry.ts` - Primary plugin registry interface
- `runtime/index.ts` - Plugin runtime facade
- `runtime/types.ts` - PluginRuntime contract
- `types.ts` - Plugin type definitions (100+ types)
- `bundled-capability-metadata.ts` - Built-in provider/capability list

#### **Gateway / Server** (~50 files)
HTTP server infrastructure for the CoreBlow daemon.

- **Server Core**: `server/` - WebSocket/HTTP handling
- **Protocol Definition**: `protocol/` - Generated API definitions (AJV schemas)
- **Health Checks**: `health-check.ts` - Liveness/readiness probes
- **WebSocket**: `ws-connection/` - Real-time message streaming
- **HTTP Auth**: `http-auth.ts` - Security/authentication
- **Webhooks**: `webhook/` - Inbound message adapters
- **Server Methods**: `server-methods/` - RPC handler implementations

**Key Files**:
- `protocol/index.ts` - Generated AJV-validated schema definitions
- `server/http-listen.ts` - HTTP listener setup
- `server/ws-connection.ts` - WebSocket protocol handler
- `server-startup-log.ts` - Startup banner generation

#### **Channels** (~80 files)
Multi-platform message adapter layer (WhatsApp, Discord, Slack, Telegram, etc.).

- **Channel Adapters**: `*-adapter.ts` - Platform-specific implementations
- **Plugin Channels**: `plugins/` - Channel extension points
- **Policy**: `policy/` - Security & filtering rules
- **Registry**: `registry.ts` - Channel discovery
- **Session Management**: `session.ts`, `targets.ts` - Conversation mapping
- **Webhooks**: `webhook-adapter.ts`, `webhook-manager.ts` - Inbound/outbound routing
- **Thread Bindings**: `thread-bindings*.ts` - Message thread context

**Supported Channels**: WhatsApp, Discord, Slack, Telegram, Matrix, IRC, Teams, Signal, Line, Gmail, iMessage, native CLI

**Key Files**:
- `adapter.ts` - Base channel interface
- `registry.ts` - Channel plugin registry
- `webhook-adapter.ts` - Generic webhook consumer
- `channels.ts` - Channel capability enumeration

#### **Infrastructure** (~250+ files)
Low-level utilities, system interaction, and operational concerns.

- **Service Patterns**: `service-patterns.ts` - Singleton factory/testing hooks (Tier-1 pattern)
- **File System**: `fs/` - Safe file operations, boundaries
- **Networking**: `net/` - Outbound requests, network discovery
- **Ports**: `ports*.ts` - Port discovery/locking
- **System Interaction**: `system-*.ts` - Process management, shell execution
- **Configuration**: `env.ts`, `dotenv.ts` - Environment handling
- **Locking**: `lock/` - File-based concurrency control
- **Caching**: `cache-*.ts` - Multi-tier caching strategies
- **Monitoring**: `heartbeat*.ts` - Health/activity tracking
- **Installation**: `install-*.ts` - Package management helpers
- **Execution Safety**: `exec-*.ts` - Sandboxed command execution (40+ files)
- **SSH/Network**: `ssh-*.ts`, `tailscale.ts` - Remote operations
- **System Detection**: `detect-*.ts`, `os-summary.ts` - OS fingerprinting
- **Error Handling**: `errors.ts`, `unhandled-rejections.ts` - Error standardization

**Key Files**:
- `service-patterns.ts` - Tier-1 singleton pattern (guards, lazy init)
- `ports.ts` - Port availability checking
- `exec-*.ts` - Command execution approval framework
- `fs-safe.ts` - Boundary-protected file operations
- `net/` - HTTP/outbound policies

#### **Configuration System** (~30 files)
Configuration loading, validation, and state persistence.

- **Config Loader**: `config.ts` - YAML/JSON schema validation
- **Sessions**: `sessions/` - Session state storage and retrieval
- **Paths**: `paths.ts` - Directory resolution ($HOME/.coreblow, etc.)
- **Providers**: `config/providers/` - Model/provider configuration
- **Secrets**: `secrets/` - Credential storage management

**Key Files**:
- `config.ts` - Core config loader + schema merger
- `sessions/store.ts` - Session file I/O
- `paths.ts` - Path resolution utilities

#### **CLI System** (~80 files)
Command-line interface infrastructure.

- **Entry Point**: `entrypoint.ts` - Argument parsing
- **Commands**: `commands/` - Command implementations (agent, setup, doctor, etc.)
- **Auth**: `auth/` - Authentication setup
- **Daemon CLI**: `daemon-cli/` - Service management
- **Gateway CLI**: `gateway-cli/` - Server control
- **Notification**: `notification/` - User notifications
- **Program**: `program/` - Commander.js configuration

**Key Files**:
- `entrypoint.ts` - CLI argument entry
- `commands/impl/` - Command handler implementations
- `shared/` - Shared CLI utilities

#### **Tools & Skills System** (~150+ files)
Agent capabilities and skill management.

- **Tool Registry**: `tool-registry.ts` - Central tool catalog
- **Tool Policy**: `tool-policy*.ts` - Permission/execution policies
- **Bash Tools**: `bash-tools*.ts` - Shell command execution (approval system)
- **Skills**: `skills*.ts` - Skill discovery, installation, versioning
- **Tool Display**: `tool-display*.ts` - Formatting for UI

**Key Files**:
- `tool-registry.ts` - OpenAI-compatible tool definitions
- `bash-tools.ts` - Bash execution facade
- `skills.ts` - Skill lifecycle management

#### **Media & Understanding** (~60 files)
File analysis, image/video processing, transcription.

- **Media Understanding**: `media-understanding/` - Vision API integration
- **Image Generation**: `image-generation/` - Stable Diffusion, etc.
- **Link Understanding**: `link-understanding/` - URL metadata extraction
- **TTS**: `tts/` - Text-to-speech providers
- **Web Search**: `web-search/` - Search provider integration

**Key Files**:
- `media-understanding/provider-registry.ts` - Vision model registry
- `image-generation/provider-registry.ts` - Image model registry

#### **Context Engine** (~20 files)
Conversation compaction and transcript management.

- **Registry**: `registry.ts` - Context engine provider lookup
- **Legacy Engine**: `legacy.ts` - Built-in compaction algorithm
- **Runtime Delegation**: `delegate.ts` - Deferred compaction to runtime

**Key Files**:
- `registry.ts` - Engine registration & resolution
- `types.ts` - ContextEngine interface

#### **Daemon / OS Service** (~15 files)
System service management for different operating systems.

- **Service Runtime**: `service-runtime.ts` - OS-specific service integration
- **Diagnostics**: `diagnostics.ts` - Service health reporting
- **Paths**: `paths.ts` - System path resolution

**Key Files**:
- `service.ts` - Service abstraction layer
- `service-runtime.ts` - Implementation for different platforms

#### **Process Management** (~10 files)
Child process spawning and supervision.

- **Supervisor**: `supervisor/` - Process lifecycle management
- **Child Bridge**: `child-process-bridge.ts` - IPC communication

#### **Hooks & Extensibility** (~20 files)
Plugin hook system for observability and customization.

- **Hook System**: `hooks/` - Event subscription mechanism
- **Internal Hooks**: `internal-hooks.ts` - Built-in hooks
- **Bundled**: `bundled/` - Pre-registered hooks

#### **Testing Infrastructure** (~60+ files)
Test utilities and helpers.

- **Test Helpers**: `test-helpers/`, `test-utils/` - Mocking utilities
- **Plugin Test Helpers**: `plugins/test-helpers.ts`
- **Daemon Test Helpers**: `daemon/test-helpers/`
- **Skills Test Helpers**: `agents/skills.test-helpers.ts`
- **Live Test Helpers**: `agents/live-test-helpers.ts`

#### **Auto-Reply System** (~20 files)
Automated response templates and logic.

- **Reply Engine**: `reply.ts` - Response composition
- **Templating**: `templating.ts` - Template substitution

#### **Other Specialized Modules**
- **ACP** (Agent Control Plane): `acp/` - Distributed agent control
- **Canvas**: `canvas/` - UI rendering layer
- **Canvas Host**: `canvas-host/` - Hosted canvas backend
- **Routing**: `routing/` - Message routing logic
- **Flows**: `flows/` - Workflow engine
- **RAG**: `rag/` - Retrieval-augmented generation
- **Sandbox**: `sandbox/` - Secure execution environment
- **Security**: `security/` - Permission checking
- **Memory**: `memory/` - Semantic memory storage
- **Observer**: `observability/` - Tracing/metrics
- **Logging**: `logging/`, `logger.ts` - Structured logging
- **i18n**: `i18n/` - Internationalization
- **Markdown**: `markdown/` - Markdown processing
- **MCP**: `mcp/` - Model Context Protocol support
- **TUI**: `tui/` - Terminal UI components
- **Web**: `web/` - Web UI serving
- **Dashboard**: `dashboard/` - Web dashboard assets
- **Bindings**: `bindings/` - Native module wrappers
- **Extensions**: `extensions/` - VS Code/IDE extensions
- **Terminal**: `terminal/` - Terminal utilities
- **Cron**: `cron/` - Scheduled task execution
- **Interactive**: `interactive/` - Real-time interaction
- **Pairing**: `pairing/` - Device pairing protocol
- **Shared**: `shared/` - Common utilities (frontmatter, chunking, etc.)
- **Stubs**: `stubs/` - Platform stubs
- **Utils**: `utils.ts`, `utils/` - General utilities
- **Version**: `version.ts` - Version management

---

## 2. EXPORT PATTERNS

CoreBlow uses **multiple barrel export strategies** for modularity and tree-shaking optimization.

### Barrel Export Types

#### **A. Index-Based Barrels (Comprehensive Re-exports)**
```typescript
// src/shared/index.ts - 20+ exports
export * from "./config-eval.js";
export * from "./frontmatter.js";
export * from "./global-singleton.js";
export * from "./usage-tracker.js";
// ... more exports
```

**Modules Using Index Barrels**:
- `src/shared/index.ts`
- `src/plugin-sdk/index.ts`
- `src/plugins/runtime/index.ts`
- `src/commands/index.ts`
- `src/daemon/index.ts`
- `src/context-engine/index.ts`
- `src/channels/discord/index.ts`
- `src/gateway/protocol/index.ts`

#### **B. Lazy Runtime Exports**
Files use async import patterns with caching to defer expensive module loads:
```typescript
// src/library.ts - Lazy-loads runtime features
let replyRuntimePromise: Promise<typeof import("./auto-reply/reply.runtime.js")> | null = null;

function loadReplyRuntime() {
  replyRuntimePromise ??= import("./auto-reply/reply.runtime.js");
  return replyRuntimePromise;
}

export const getReplyFromConfig: GetReplyFromConfig = async (...args) =>
  (await loadReplyRuntime()).getReplyFromConfig(...args);
```

**Pattern Used In**:
- `library.ts` - 6 lazy-loaded runtime modules
- `plugins/runtime/index.ts` - TTS, media understanding, model auth
- `shared/lazy-runtime.js` - Helper utilities

#### **C. Main Package Exports**
```typescript
// Root entry points
export async function runLegacyCliEntry(argv: string[], deps?: LegacyCliDeps): Promise<void>
export let assertWebChannel: LibraryExports["assertWebChannel"];
export let applyTemplate: LibraryExports["applyTemplate"];
// ... public API
```

#### **D. Type-Only Exports**
Many modules export types without implementations:
```typescript
export type ChannelPlugin from "../channels/plugins/types.plugin.js";
export type PluginRuntime from "../plugins/runtime/types.js";
```

#### **E. Sub-Package Exports** (e.g., `coreblow/plugin-sdk/...`)
```typescript
// coreblow/plugin-sdk/index.ts
export type { ChannelPlugin } from "../channels/plugins/types.plugin.js";
export { registerContextEngine } from "../context-engine/registry.js";
export { onDiagnosticEvent } from "../infra/diagnostic-events.js";
```

### Export Consolidation Points

| File | Exports | Type |
|------|---------|------|
| `index.ts` | CLI/library entry | Dual (CLI + public API) |
| `library.ts` | Public library API | Lazy + sync mixed |
| `gateway-entry.ts` | Server setup | Direct exports |
| `extensionAPI.ts` | Deprecated compat | Legacy proxy |
| `plugin-sdk/index.ts` | Plugin types + APIs | Type + runtime |
| `shared/index.ts` | Common utilities | 20+ utils |
| `plugins/runtime/index.ts` | Runtime facade | Lazy methods |
| `daemon/index.ts` | Service management | 12+ exports |
| `commands/index.ts` | CLI registry | Command types |

### Unused/Dead Export Patterns
**Risk Areas**:
- `extensionAPI.ts` is marked **deprecated** - legacy consumers likely orphaned
- `plugin-sdk/compat` surface may have unmaintained exports
- Test-only utilities in `*/test-helpers/` could accumulate

---

## 3. SERVICE ARCHITECTURE

CoreBlow implements a **Tier-1 Singleton Pattern** for service management across all infrastructure layers.

### Core Pattern: Service Patterns (Tier-1)

**Location**: `src/infra/service-patterns.ts`

#### Singleton Factory Implementation
```typescript
export interface StandaloneSingletonOptions<TDeps, TService> {
    create: (deps: TDeps) => TService;
    defaultDeps: TDeps;
}

export function createStandaloneSingleton<TDeps, TService>(
    options: StandaloneSingletonOptions<TDeps, TService>,
): StandaloneSingleton<TDeps, TService> {
    let _instance: TService | null = null;
    
    const getInstance = (): TService => {
        if (!_instance) {
            _instance = options.create(options.defaultDeps);
        }
        return _instance;
    };
    
    const __testing = createTestingHooks<TService>(
        () => { _instance = null; },
        (svc) => { _instance = svc; },
    );
    
    return { getInstance, __testing };
}
```

#### Guard Testing Hooks Pattern
```typescript
export function createTestingHooks<T>(
    resetFn: () => void,
    setFn: (instance: T) => void,
): { reset(): void; set(instance: T): void } {
    return {
        reset() {
            if (process.env.NODE_ENV !== 'test') return; // NO-OP in prod
            resetFn();
        },
        set(instance: T) {
            if (process.env.NODE_ENV !== 'test') return; // NO-OP in prod
            setFn(instance);
        },
    };
}
```

**Safety Feature**: Testing hooks are NODE_ENV-guarded to prevent accidental singleton reset in production.

### Services Using Tier-1 Pattern

**25+ Infrastructure Services** use this pattern:

| Service | File | Purpose |
|---------|------|---------|
| `SemverCompareService` | `infra/semver-compare.ts` | Version comparison |
| `HomeDirService` | `infra/home-dir.ts` | User home directory resolution |
| `OsSummaryService` | `infra/os-summary.ts` | OS detection |
| `ShellEnvService` | `infra/shell-env.ts` | Shell environment vars |
| `NodePairingService` | `infra/node-pairing.ts` | Device pairing |
| `GatewayProcessesService` | `infra/gateway-processes.ts` | Process management |
| `SystemEventsService` | `infra/system-events.ts` | System monitoring |
| `BrewService` | `infra/brew.ts` | Homebrew package mgmt |
| `PortsLsofService` | `infra/ports-lsof.ts` | Port scanning |
| `PortsProbeService` | `infra/ports-probe.ts` | Port availability |
| `DeviceAuthStoreService` | `infra/device-auth-store.ts` | Credential storage |
| `SystemPresenceService` | `infra/system-presence.ts` | System availability |
| `SshTunnelService` | `infra/ssh-tunnel.ts` | SSH tunneling |
| `RestartSentinelService` | `infra/restart-sentinel.ts` | Process restart tracking |
| `SafeOpenSyncService` | `infra/safe-open-sync.ts` | Safe file opening |
| `GatewayDiscoveryTargetsService` | `infra/gateway-discovery-targets.ts` | Service discovery |

### Outbound Services

**Location**: `src/infra/outbound/`

| Service | Purpose |
|---------|---------|
| `OutboundSendService` | Message delivery to channels |
| `SessionBindingService` | Session-to-channel mapping |

### Plugin System Service Registry

**Location**: `src/plugins/registry.ts`

The plugin system has its own service registry:
```typescript
export type PluginToolRegistration = {
    pluginId: string;
    factory: CoreBlowPluginToolFactory;
    names: string[];
    optional: boolean;
    source: string;
};

export type PluginHttpRouteRegistration = {
    pluginId?: string;
    path: string;
    handler: CoreBlowPluginHttpRouteHandler;
    auth: CoreBlowPluginHttpRouteAuth;
};

export type PluginChannelRegistration = { ... };
```

### Tool Registry Pattern

**Location**: `src/tools/tool-registry.ts`

```typescript
export class ToolRegistry {
    private tools = new Map<string, ToolDefinition>();
    
    register(tool: ToolDefinition): void { ... }
    registerMany(tools: ToolDefinition[]): void { ... }
    get(name: string): ToolDefinition | null { ... }
    toOpenAI(permission?: string): OpenAITool[] { ... }
    listByCategory(): Record<string, string[]> { ... }
}
```

### Context Engine Registry

**Location**: `src/context-engine/registry.ts`

Implements provider registration with factory functions:
```typescript
export function registerContextEngine(
    id: string,
    factory: ContextEngineFactory,
): void { ... }

export function getContextEngineFactory(id: string): ContextEngineFactory | null { ... }

export function resolveContextEngine(id: string): ContextEngine { ... }
```

### Image Generation Provider Registry

**Location**: `src/image-generation/provider-registry.ts`

Similar pattern for image generation providers.

### Global Singleton Resolution

**Location**: `src/shared/global-singleton.ts`

Uses `Symbol.for()` for cross-module singleton sharing:
```typescript
export function resolveGlobalSingleton<T>(
    key: symbol | string,
    factory: () => T,
): T { ... }
```

Used in:
- Plugin runtime's gateway subagent state
- Any shared process-wide singleton

### Dependency Injection Pattern

The codebase **does not use a DI container**. Instead, it uses:
1. **Module-level singletons** with default deps
2. **Constructor injection** for most classes
3. **Factory functions** for parametric creation
4. **Lazy evaluation** via functions (not eager singleton creation)

**Example** (from `AgentEngine`):
```typescript
export class AgentEngine {
    readonly config: AgentEngineConfig;
    private sessions = new Map<string, EngineSession>();
    private toolCatalog: ToolCatalog;
    
    constructor(config?: Partial<AgentEngineConfig>) {
        this.config = mergeEngineConfig(config);
        this.toolCatalog = new ToolCatalog();
        // ... lazy initialize subcomponents
    }
}
```

---

## 4. KEY FILES

### Service Registry & Dependency Injection

| File | Lines | Purpose | Pattern |
|------|-------|---------|---------|
| `src/infra/service-patterns.ts` | ~100 | Singleton factory with testing hooks | Tier-1 factory |
| `src/plugins/registry.ts` | ~300+ | Central plugin discovery/registration | Registry |
| `src/tools/tool-registry.ts` | ~150 | Tool definitions & OpenAI export | Registry |
| `src/plugins/contracts/registry.ts` | ~300+ | Plugin capability snapshots | Registry |
| `src/context-engine/registry.ts` | ~100 | Context engine providers | Registry |
| `src/image-generation/provider-registry.ts` | ~150 | Image model providers | Registry |

### Utility Consolidation Points

| File | Lines | Scope | Exports |
|------|-------|-------|---------|
| `src/utils.ts` | ~250 | Global utilities | 15+ functions (clamp, escapeRegExp, normalizeE164, etc.) |
| `src/utils/` | 40+ files | Specialized utilities | Array, boolean, date, fetch, JSON, logging utils |
| `src/shared/index.ts` | ~22 | Common exports | 20+ modules (frontmatter, chunking, normalization) |
| `src/infra/` | 250+ files | Infrastructure | FS, network, system, execution safety |

### Base Classes & Shared Implementations

| File | Class | Purpose |
|------|-------|---------|
| `src/agents/agent-engine.ts` | `AgentEngine` | Core agent execution facade |
| `src/agents/agent-scope.ts` | (functions) | Agent directory resolution |
| `src/tools/tool-registry.ts` | `ToolRegistry` | Tool catalog management |
| `src/agents/sandbox.ts` | `Sandbox` | Execution environment abstraction |
| `src/agents/context-manager.ts` | (functions) | Context window management |
| `src/plugins/api-builder.ts` | (functions) | Plugin runtime API construction |
| `src/channels/adapter.ts` | `ChannelAdapter` (implicit) | Channel base interface |
| `src/gateway/protocol/index.ts` | (generated) | AJV schema validators for all RPC types |

### Entry Points & Bootstrap

| File | Type | Responsibility |
|------|------|-----------------|
| `src/entry.ts` | Executable | Main CLI entry (argument parsing, respawn) |
| `src/gateway-entry.ts` | Executable | Gateway HTTP server bootstrap |
| `src/cli-main.ts` | Executable | Legacy CLI entry |
| `src/channel-web.ts` | Executable | Web channel entry |
| `src/index.ts` | Entry point | Package root (dual CLI/library mode) |
| `src/library.ts` | Public API | Lazy-loaded library exports |
| `src/bootstrap/` | 2 files | Node.js environment setup |
| `src/daemon/index.ts` | Exports | Service management API |

### Plugin System Core

| File | Lines | Purpose |
|------|-------|---------|
| `src/plugins/registry.ts` | ~1000+ | Central registration hub for all plugin types |
| `src/plugins/runtime/index.ts` | ~250 | PluginRuntime facade (lazy-loaded methods) |
| `src/plugins/types.ts` | ~500+ | 100+ type definitions for plugins |
| `src/plugins/api-builder.ts` | ~300 | Constructs plugin API from registrations |
| `src/plugins/command-registration.ts` | ~150 | CLI command registration logic |
| `src/plugins/http-registry.ts` | ~200 | HTTP route management |
| `src/plugins/manifest-registry.ts` | ~150 | Plugin metadata discovery |

### Gateway System Core

| File | Lines | Purpose |
|------|-------|---------|
| `src/gateway/server/http-listen.ts` | ~100 | HTTP server listener setup |
| `src/gateway/server/ws-connection.ts` | ~200 | WebSocket handler |
| `src/gateway/protocol/index.ts` | 1000+ | AJV-generated validators for RPC schema |
| `src/gateway/server-methods/` | 100+ files | Individual RPC handler implementations |
| `src/gateway/health-check.ts` | ~100 | Liveness/readiness probes |
| `src/gateway/channel-manager.ts` | ~200 | Multi-channel orchestration |

### Channel System

| File | Lines | Purpose |
|------|-------|---------|
| `src/channels/adapter.ts` | ~200 | Base channel interface |
| `src/channels/registry.ts` | ~100 | Channel plugin discovery |
| `src/channels/discord/adapter.ts` | ~300 | Discord implementation |
| `src/channels/plugins/` | 20+ files | Plugin extension points |
| `src/channels/webhook-adapter.ts` | ~200 | Generic webhook consumer |
| `src/channels/policy/` | 10+ files | Security policies |

### Agent Engine Core

| File | Lines | Purpose |
|------|-------|---------|
| `src/agents/agent-engine.ts` | ~400+ | Unified agent execution facade |
| `src/agents/agent-engine-config.ts` | ~200 | Engine configuration schema |
| `src/agents/tool-policy.ts` | ~300 | Tool approval/denial rules |
| `src/agents/tool-catalog.ts` | ~200 | Tool discovery & definition |
| `src/agents/model-catalog.ts` | ~400+ | Model/provider registry |
| `src/agents/bootstrap.ts` | ~500+ | Initialization pipeline |
| `src/agents/compaction.ts` | ~400 | Conversation compression |
| `src/agents/session-state.ts` | ~200 | Session state persistence |

### Infrastructure/System Core

| File | Lines | Purpose |
|------|-------|---------|
| `src/infra/ports.ts` | ~200 | Port availability & locking |
| `src/infra/fs-safe.ts` | ~150 | Boundary-safe file operations |
| `src/infra/exec-*.ts` | 40+ files | Command execution approval & sandboxing |
| `src/infra/outbound/outbound-send-service.ts` | ~300 | Outbound message delivery |
| `src/infra/service-patterns.ts` | ~100 | Singleton factory pattern |

### Configuration & State

| File | Lines | Purpose |
|------|-------|---------|
| `src/config/config.ts` | ~400 | YAML/JSON config loader |
| `src/config/sessions/store.ts` | ~250 | Session persistence |
| `src/config/sessions/session-key.ts` | ~150 | Session key derivation |
| `src/config/paths.ts` | ~100 | Path resolution ($HOME/.coreblow) |

### Plugin SDK/API

| File | Lines | Purpose |
|------|-------|---------|
| `src/plugin-sdk/index.ts` | ~50 | Minimal root SDK exports |
| `src/plugin-sdk/plugin-entry.ts` | ~100 | Plugin initialization |
| `src/plugin-sdk/image-generation-runtime.ts` | ~150 | Image gen API for plugins |
| `src/extensionAPI.ts` | ~30 | Deprecated legacy compat |

---

## 5. HIGH-LEVEL ARCHITECTURE OVERVIEW

### Layered Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CLI / Entry Points                        │
│          entry.ts, gateway-entry.ts, cli-main.ts            │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
┌────────▼──────────────┐    ┌──────────▼─────────────┐
│   CLI Command Layer   │    │  Gateway HTTP Server   │
│  (commands/impl/)     │    │  (gateway/server/)     │
│  (cli/*/cli-*.ts)     │    │                        │
└────────┬──────────────┘    └──────────┬─────────────┘
         │                             │
         │                    ┌────────▼──────────┐
         │                    │  Protocol/Schema  │
         │                    │  (AJV validated)  │
         │                    └────────┬──────────┘
         │                             │
    ┌────▼─────────────────────────────▼──────────────────┐
    │         Core Services & Business Logic              │
    │                                                      │
    │  ┌────────────────────────────────────────────┐     │
    │  │    Agent Engine (agents/agent-engine.ts)  │     │
    │  │  - Session Management                     │     │
    │  │  - Model Selection & Catalog              │     │
    │  │  - Tool Policy & Execution                │     │
    │  │  - Conversation Compaction                │     │
    │  └────────────────────────────────────────────┘     │
    │                                                      │
    │  ┌────────────────────────────────────────────┐     │
    │  │    Plugin System (plugins/registry.ts)     │     │
    │  │  - Service Loading                        │     │
    │  │  - Contract Management                    │     │
    │  │  - Runtime API Construction               │     │
    │  └────────────────────────────────────────────┘     │
    │                                                      │
    │  ┌────────────────────────────────────────────┐     │
    │  │    Channel System (channels/*)             │     │
    │  │  - Multi-platform Adapters                 │     │
    │  │  - Session Binding                         │     │
    │  │  - Webhook Management                      │     │
    │  └────────────────────────────────────────────┘     │
    │                                                      │
    │  ┌────────────────────────────────────────────┐     │
    │  │    Configuration System (config/*)         │     │
    │  │  - Config Loading & Merging                │     │
    │  │  - Session Persistence                     │     │
    │  │  - Provider/Model Config                   │     │
    │  └────────────────────────────────────────────┘     │
    │                                                      │
    └────────┬─────────────────────────────────────────────┘
             │
    ┌────────▼─────────────────────────────────────────────┐
    │         Infrastructure Layer (infra/)               │
    │                                                      │
    │  ┌──────────────┐  ┌──────────────┐ ┌────────────┐  │
    │  │ Service      │  │ File System  │ │ Ports/Net  │  │
    │  │ Patterns     │  │ Operations   │ │ Management │  │
    │  │ (Tier-1)     │  │ (Boundaries) │ │            │  │
    │  └──────────────┘  └──────────────┘ └────────────┘  │
    │                                                      │
    │  ┌──────────────┐  ┌──────────────┐ ┌────────────┐  │
    │  │ System Exec  │  │ SSH/Tunnel   │ │ Outbound   │  │
    │  │ (Approval)   │  │ Management   │ │ Send       │  │
    │  └──────────────┘  └──────────────┘ └────────────┘  │
    │                                                      │
    └────────┬─────────────────────────────────────────────┘
             │
    ┌────────▼─────────────────────────────────────────────┐
    │         Utilities & Shared (shared/, utils/)         │
    │  - String normalization, chunking, frontmatter       │
    │  - Global singleton resolution                       │
    │  - Lazy loading helpers                              │
    └──────────────────────────────────────────────────────┘
```

### Execution Flow

#### 1. **CLI Path** (`entry.ts` → Commands → Agent Engine)
```
entry.ts
  ↓
isMainModule check
  ↓
installGaxiosFetchCompat()
  ↓
buildCliRespawnPlan() [if respawn needed]
  ↓
runCli(argv)
  ↓
parseCliContainerArgs() / resolveCliContainerTarget()
  ↓
commands/impl/[command].ts
  ↓
Agent Engine / Config System
```

#### 2. **Gateway Path** (`gateway-entry.ts` → HTTP Server → RPC Handlers)
```
gateway-entry.ts
  ↓
loadConfig()
  ↓
bootstrapRuntime() [Provider initialization]
  ↓
startGatewayServer()
  ↓
createServer() [HTTP listener]
  ↓
handleProbeRequest() [Health checks]
  ↓
ChatHandler / WebhookAdapter / ChannelBridge
  ↓
gateway/server-methods/[method].ts
  ↓
Agent Engine / Plugin Runtime
```

#### 3. **Plugin Loading Path**
```
plugins/registry.ts
  ↓
loadBundledCapabilityRuntimeRegistry()
  ↓
resolvePluginProviders() [for contracts]
  ↓
buildPluginApi() [API construction]
  ↓
registerPluginCommand() / registerPluginInteractiveHandler()
  ↓
plugins/runtime/index.ts [API facade]
```

### Data Flow Patterns

#### **Configuration Data**
```
~/.coreblow/config.yaml (or $COREBLOW_CONFIG)
  ↓
config/config.ts (yaml-load + schema validation)
  ↓
CoreBlowConfig type
  ↓
Various subsystems (agents, providers, channels)
```

#### **Session/Conversation Data**
```
~/.coreblow/agents/[agent-id]/sessions/
  ↓
config/sessions/store.ts (JSON file I/O)
  ↓
Session transcript + metadata
  ↓
agents/agent-engine.ts (compaction, replay)
```

#### **Message Flow (Channel → Agent → Response)**
```
Channel Adapter (Discord, WhatsApp, etc.)
  ↓
channels/adapter.ts
  ↓
gateway/server-methods/chat.ts
  ↓
agents/agent-engine.ts (turn execution)
  ↓
Model API call (via provider-stream.ts)
  ↓
agents/compaction.ts (if needed)
  ↓
Tool execution (bash-tools.ts, etc.)
  ↓
Response assembly
  ↓
channels/webhook-adapter.ts (outbound)
```

### Dependency Graph (Top-Level)

```
entry.ts/gateway-entry.ts
  ├─ cli/ (CLI commands)
  ├─ config/ (Config loading)
  ├─ bootstrap/ (Env setup)
  │
  ├─ agents/ (Core engine)
  │  ├─ plugins/ (Runtime API)
  │  ├─ tools/ (Tool registry)
  │  ├─ channels/ (Channel adapters)
  │  └─ infra/ (System services)
  │
  ├─ plugins/
  │  ├─ registry.ts
  │  ├─ contracts/
  │  ├─ runtime/
  │  └─ types.ts
  │
  ├─ gateway/
  │  ├─ server/
  │  ├─ protocol/
  │  ├─ server-methods/
  │  └─ health-check.ts
  │
  ├─ channels/
  │  ├─ adapter.ts
  │  ├─ *-adapter.ts (platform-specific)
  │  ├─ plugins/
  │  └─ policy/
  │
  ├─ infra/
  │  ├─ service-patterns.ts
  │  ├─ fs/
  │  ├─ net/
  │  ├─ exec-*/ (approval system)
  │  └─ outbound/
  │
  ├─ context-engine/
  ├─ image-generation/
  ├─ tts/
  ├─ rag/
  ├─ skills/
  │
  └─ shared/
     └─ Global utilities
```

### Key Architectural Decisions

#### **1. Tier-1 Singleton Pattern**
- All infrastructure services use `createStandaloneSingleton()` from `service-patterns.ts`
- Testing hooks are NODE_ENV-guarded to prevent production issues
- Lazy initialization on first use

#### **2. Plugin Contract Snapshots**
- Built-in providers/plugins are pre-snapshotted in `bundled-capability-metadata.ts`
- Runtime loads contracts dynamically for validation
- Enables offline capability matching

#### **3. Lazy Runtime Loading**
- Heavy modules (`binaries.ts`, `prompt.ts`, etc.) are lazy-loaded
- Reduces startup time for non-interactive paths
- Enables better tree-shaking in bundled scenarios

#### **4. Service Registry Pattern**
- No centralized DI container
- Each domain has its own registry (plugins, tools, channels, context engines, providers)
- Registries are discoverable at runtime

#### **5. Channel Abstraction**
- All platforms (WhatsApp, Discord, Slack, etc.) implement `ChannelAdapter` interface
- Webhook-based for inbound, session-binding for outbound
- Policy layer separates security concerns

#### **6. Execution Safety**
- Command execution goes through approval framework (`exec-approvals*.ts`)
- Sandboxing via `Sandbox` abstraction
- Boundary-protected file operations (`fs-safe.ts`)

#### **7. Configuration Merging**
- Multiple config sources (YAML files, environment variables, defaults)
- Schema validation via Zod/JSON Schema
- Provider/model config is plugin-aware

#### **8. Conversation Compaction**
- Context engine registry allows pluggable compaction strategies
- Default algorithm in `compaction.ts`
- Runtime delegation for advanced scenarios

---

## 6. ORPHANED/DEAD CODE RISKS

### High-Risk Areas

1. **`extensionAPI.ts`** - Deprecated compatibility bridge
   - Emits deprecation warning
   - Likely has unused exports
   - Recommend audit for actual usage

2. **`compat/`** - Likely historical compatibility shims
   - Check if any consumers remain

3. **Stale Test Helpers**
   - Multiple `*test-helpers.ts` files could accumulate
   - Audit references across test suites

4. **Lazy Runtime Wrappers** (in `plugins/runtime/`)
   - Lazy methods for unavailable features (subagent in non-gateway)
   - Check if these error paths are ever hit

### Duplicate Pattern Detection

1. **Multiple registries** across domains
   - `plugins/registry.ts`
   - `tools/tool-registry.ts`
   - `image-generation/provider-registry.ts`
   - `context-engine/registry.ts`
   - Could potentially be unified into single registry pattern (but acceptable given domain differences)

2. **Multiple service factory patterns**
   - `service-patterns.ts` (Tier-1)
   - `plugins/lazy-service-module.ts` (plugin-specific)
   - Mostly non-overlapping use cases, but verify

3. **Config loading patterns**
   - `config/config.ts` (main)
   - Scattered provider-specific config loaders
   - Check for duplication in merge logic

---

## 7. SUMMARY TABLE

| Aspect | Finding | Risk Level |
|--------|---------|------------|
| **Module Count** | 60+ major modules | ✅ Well-organized |
| **Lines of Code** | ~922K TypeScript | ⚠️ Large, needs modularization checks |
| **Singleton Pattern** | Tier-1 with guarded hooks | ✅ Safe, testable |
| **Export Complexity** | Multiple barrel patterns | ⚠️ Could benefit from unified export strategy |
| **Service Registries** | 5+ independent registries | ⚠️ Potential duplication |
| **Plugin System** | Comprehensive, well-structured | ✅ Extensible |
| **Gateway Architecture** | Clear HTTP/WebSocket separation | ✅ Clean separation |
| **Entry Points** | Multiple (CLI, gateway, plugin) | ✅ Well-demarcated |
| **Infrastructure** | Rich set of utilities | ⚠️ Could benefit from consolidation audit |
| **Dead Code** | `extensionAPI.ts` marked deprecated | 🔴 Needs cleanup |
| **Type System** | Heavy use of discriminated unions & generics | ✅ Type-safe |

---

## RECOMMENDATIONS

### Immediate Actions
1. **Audit `extensionAPI.ts` consumers** - Plan deprecation timeline
2. **Document registry patterns** - Create shared registry base class if overlap exists
3. **Consolidate export strategies** - Consider unified barrel export approach
4. **Create dead code report** - Automated tool to find unreachable exports

### Medium-term Improvements
1. **Registry unification** - Evaluate if single registry pattern could work for all domains
2. **Service discovery documentation** - Document how to add new services following Tier-1 pattern
3. **Export audit tools** - Create tools to identify orphaned/unused exports
4. **Plugin SDK version management** - Clear versioning for plugin-sdk subpaths

### Long-term Considerations
1. **Monorepo structure** - Consider extracting major domains into separate packages
2. **Lazy loading optimization** - Profile startup time to ensure lazy loading gains
3. **DI container evaluation** - Assess if centralized container would reduce boilerplate
4. **Module federation** - Evaluate for dynamic plugin loading at runtime

