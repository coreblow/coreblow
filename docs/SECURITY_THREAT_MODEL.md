# CoreBlow Security Threat Model and Defense Architecture

This document defines the threat model, trust boundaries, attacker profiles, defensive controls, and architectural limitations enforced by the CoreBlow Microkernel and CoreHub App Store runtime.

---

## 1. Trust Boundaries and System Architecture

CoreBlow operates as a multi-tier runtime with explicit isolation boundaries:

```
┌────────────────────────────────────────────────────────┐
│                   Untrusted Network                    │
└───────────────────────────┬────────────────────────────┘
                            │ HTTP / WebSocket
                            ▼
┌────────────────────────────────────────────────────────┐
│               Gateway Ingress Boundary                 │
│  • Gateway Token / Password Authentication              │
│  • Trusted Origin and Loopback Authorization           │
│  • Scoped Operator Access Control (operator.admin)      │
│  • Strict CORS Headers (Vary: Origin, No Wildcards)    │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                   CoreBlow Kernel                      │
│  • Cory Built-in Memory (Local Markdown / Vector Store)│
│  • Native AI Providers & Streaming Engine              │
│  • Native Vector / RAG & Document Extraction           │
│  • Native Tool Runtime & Policy Enforcement            │
│  • Native CDP Headless Browser Engine                  │
│  • Native Voice Engine                                 │
└───────────────────────────┬────────────────────────────┘
                            │ In-Process Dynamic Import
┌───────────────────────────▼────────────────────────────┐
│          CoreHub On-Demand App Lifecycle               │
│  • Cryptographic SHA-256 Tarball Verification          │
│  • Capability Consent Ledger Gate (Pre-Activation)     │
│  • Atomic Staging Directory Extraction Isolation       │
│  • Path Traversal & Entrypoint Containment Guardrails │
│  • Deep Runtime Registry Purge on Disable or Rollback  │
└────────────────────────────────────────────────────────┘
```

> [!IMPORTANT]
> **Process Isolation Boundary & Limitation**:
> CoreHub plugins execute in the CoreBlow Node process; process-level sandbox isolation is not yet a certification guarantee.
> While tarball verification, capability consent gating, and deep runtime unregistration protect against unverified packages and lifecycle pollution, active plugin code runs inside the main Node runtime. Native worker-thread or OS-level process sandboxing is not a feature of this release.

---

## 2. Threat Analysis and Implemented Defensive Controls

CoreBlow implements the following concrete, tested defensive controls:

### 2.1 Cryptographic SHA-256 Artifact Verification
- **Threat**: Tampered, corrupted, or intercepted extension tarballs installed from third-party networks or CDNs.
- **Defense**:
  - The `AtomicPluginStageManager` computes and enforces cryptographic SHA-256 integrity verification against catalog records (`manifest.integrity`).
  - Tarball extraction occurs in an ephemeral staging directory (`~/.coreblow/tmp/<uuid>`). If the computed digest fails to match the expected catalog signature, the staging directory is immediately purged and no files are committed to production extension roots.

### 2.2 Staged Atomic Extraction and Orphan Recovery
- **Threat**: Partial writes or interrupted installations leaving corrupted or incomplete packages in runtime directories.
- **Defense**:
  - Packages are extracted into atomic staging directories. Only after integrity checks and manifest validation pass is the staged directory atomically swapped into place.
  - On startup and failure, orphaned or abandoned staging folders are automatically cleaned up (`cleanupOrphanedStages`).

### 2.3 Manifest Validation and Schema Conformance
- **Threat**: Malformed plugin manifests introducing invalid configurations, unexpected hooks, or missing entrypoints.
- **Defense**:
  - Manifest schemas (`coreblow.plugin.json`) are validated prior to staging. Entrypoints, declared capabilities, and plugin IDs must conform to strict schema invariants.

### 2.4 Path Traversal and Directory Escape Containment
- **Threat**: Malicious manifests attempting directory traversal attacks (e.g., `../../etc/passwd` or entrypoints pointing outside the plugin root).
- **Defense**:
  - Entrypoint paths are sanitized with `path.resolve` and verified using `path.relative(pluginDir, entryPath)`.
  - Any path that begins with `..` or resolves as an absolute path outside the extension root throws an error and halts execution before dynamic import.

### 2.5 Capability Consent Ledger Gating
- **Threat**: A community plugin or third-party extension accesses sensitive host capabilities (network sockets, filesystem credentials, webhooks) without operator awareness.
- **Defense**:
  - The `CapabilityConsentLedger` records explicit, immutable operator approval for declared capabilities prior to plugin activation.
  - Activation of any package requiring unapproved capabilities fails closed before dynamic module loading, returning an error directing the operator to review and grant consent via `coreblow plugins consent <id> --grant <caps>`.

### 2.6 In-Process Dynamic Import and Execution
- **Threat**: Unverified or disabled packages executing arbitrary code or consuming resources at boot.
- **Defense**:
  - CoreHub apps are never loaded eagerly at startup (`eagerCoreHubAppsLoaded: 0`).
  - In-process dynamic import (`await import(fileUrl)`) occurs only after SHA-256 verification, path containment, and capability consent have succeeded.
  - As noted above, once imported, execution occurs in the host Node.js process.

### 2.7 Runtime Registry Registration and Deep Rollback Cleanup
- **Threat**: Disabled or rolled-back plugins leaving active event hooks, command handlers, or channels in memory, leading to phantom execution.
- **Defense**:
  - On activation, contributions are explicitly registered with the appropriate microkernel registries (`channelRegistry`, `toolRegistry`, hooks).
  - On rollback or disable, `unregisterImportedPluginId(pluginId)` performs deep runtime purging across:
    - Active plugin records
    - Channel instances and channel routers
    - Registered tools
    - Event hooks and typed hook subscribers
    - CLI command handlers and provider registrations
    - Custom HTTP route handlers
  - Rollback atomically restores the pre-update backup snapshot from `~/.coreblow/backups/<pluginId>@<version>`.

### 2.8 Gateway Authentication and Access Control
- **Threat**: Unauthorized callers attempting to invoke privileged microkernel endpoints (`/api/corehub/consent`, `/api/corehub/install`, `/api/corehub/activate`, `/api/corehub/rollback`).
- **Defense**:
  - All mutating endpoints require valid Bearer token or Gateway password authentication. Anonymous requests fail closed with `401 Unauthorized`.
  - Operator scopes are strictly resolved from authenticated credentials. Hand-crafted headers (e.g., `x-coreblow-scopes: operator.admin`) provided by unauthenticated or untrusted callers are disregarded and reject with `403 Forbidden`.
  - Constant-time string comparisons (`crypto.timingSafeEqual`) prevent timing side-channel attacks on credentials.

### 2.9 Trusted Origin, Host Verification, and CORS Defense
- **Threat**: Cross-site request forgery (CSRF) or browser-based drive-by attacks from malicious origins attempting to manipulate CoreHub extensions.
- **Defense**:
  - Privileged mutations verify the request `Origin` or `Host` header against loopback, local gateway bindings, and configured control origins. Untrusted origins are rejected with `403 Forbidden`.
  - Mutation endpoints **never** emit wildcard `Access-Control-Allow-Origin: *` headers. Valid origins receive the exact reflected origin accompanied by `Vary: Origin`.
  - Public discovery endpoints (`GET /api/corehub/storefront`) are strictly read-only and explicitly separated from privileged control mutations.

### 2.10 Tool Execution and Shell Approvals
- **Threat**: AI models executing unauthorized shell commands or tools with host privileges.
- **Defense**:
  - The native tool runtime enforces approval escalation policies.
  - Interactive shell commands require explicit operator approval via the approval router before execution.

### 2.11 Secret Redaction and Diagnostic Privacy
- **Threat**: Leaking API keys, tokens, or personal identifiers into logs, error messages, Cockpit UI, or support diagnostic bundles.
- **Defense**:
  - CoreBlow loggers and diagnostic analyzers apply automatic masking to recognized secret patterns (OpenAI `sk-...`, Anthropic `sk-ant-...`, Google Gemini keys, gateway tokens).
  - Diagnostic health reports and `coreblow doctor` bundles omit raw credential strings and output redacting placeholders.
