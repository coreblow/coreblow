# CoreBlow Gateway — Architecture Overview

## System Architecture

CoreBlow Gateway is a production-grade AI agent orchestration platform built in TypeScript. It provides a unified interface for managing AI conversations, tool execution, plugin systems, and multi-channel communication.

```
┌─────────────────────────────────────────────────────┐
│                   CoreBlow Gateway                   │
├─────────────┬──────────────┬────────────────────────┤
│  Channels   │   Agents     │   Infrastructure       │
│  ─────────  │   ──────     │   ──────────────       │
│  • Discord  │  • Turn Eng. │  • Config System       │
│  • Telegram │  • AutoPilot │  • Plugin Registry     │
│  • Slack    │  • SubAgents │  • Security Layer      │
│  • IRC      │  • RAG Pipe  │  • Dashboard           │
│  • WhatsApp │  • Cron Jobs │  • WebSocket Server    │
│  • Webhooks │  • Hooks     │  • Rate Limiting       │
├─────────────┴──────────────┴────────────────────────┤
│              Runtime & Sandbox Layer                 │
│  • Docker Sandbox  • Native Process Isolation       │
│  • Token Bucket    • RBAC System                    │
│  • Audit Logger    • PII Scanner                    │
└─────────────────────────────────────────────────────┘
```

## Directory Structure

```
gateway/
├── src/
│   ├── acp/                    # Agent Communication Protocol
│   ├── agents/                 # Agent subsystems
│   │   ├── turn-engine/        # Turn-based conversation engine
│   │   │   ├── autopilot/      # AutoPilot (auto-reply, queue, heartbeat)
│   │   │   └── config/         # Agent configuration & defaults
│   │   └── mcp/                # Model Context Protocol
│   ├── auto-reply/             # Auto-reply pipeline
│   ├── channels/               # Channel adapters (Discord, Telegram, etc.)
│   ├── config/                 # Configuration system & Zod schemas
│   ├── dashboard/              # Web dashboard
│   ├── gateway/                # Gateway server, RPC, API schemas
│   ├── hooks/                  # Hook/flow engine
│   ├── image-generation/       # Image generation provider registry
│   ├── infra/                  # Infrastructure utilities
│   ├── plugins/                # Plugin system (registry, lifecycle, SDK)
│   ├── rag/                    # RAG pipeline (chunker, loader, embeddings)
│   ├── security/               # Security layer (guardrails, RBAC, PII, etc.)
│   └── utils/                  # Shared utilities
├── tests/
│   └── security/               # Security integration tests
├── docs/                       # Documentation
└── scripts/                    # Migration & utility scripts
```

## Core Subsystems

### 1. Agent Communication Protocol (ACP)
The ACP subsystem manages session state, message routing, and agent lifecycle. Sessions are tracked via `AcpSession` with full metadata (model, workspace, tools, history).

### 2. Turn Engine & AutoPilot
The turn engine manages conversation turns with configurable models, temperature, and token limits. AutoPilot handles automated responses with priority queuing, heartbeat monitoring, and abort control.

### 3. Security Layer
Production-grade security with:
- **GuardrailsEngine**: Unified pipeline orchestrating toxicity, bias, PII, and content checks
- **RBAC**: Role-based access (owner > admin > user > guest) with inheritance
- **PII Scanner**: Detects and masks emails, phones, SSNs, credit cards, IPs
- **Input Sanitizer**: XSS, SQL injection, command injection protection
- **Token Bucket**: Per-key rate limiting with configurable refill
- **Sandbox**: Docker + native process isolation

### 4. Plugin System
Enterprise plugin architecture with:
- Manifest validation (Zod schemas with semver, permissions, hooks)
- Lifecycle management (install, enable, disable, uninstall)
- Security sandboxing with permission grants
- Marketplace integration

### 5. Configuration System
Zod-validated configuration with full defaults:
- Gateway (port, host, auth, CORS)
- Agents (temperature, tokens, timeout, model)
- Sandbox (mode, resources, timeouts)
- Tools (profiles, exec policies)
- Channels, Models, Features, Logging

### 6. RAG Pipeline
Retrieval-Augmented Generation with:
- Multi-format document loader (.md, .txt, .json, .csv, .ts, .py, .html)
- Recursive text chunker with configurable overlap
- Vector search with MMR re-ranking
- Embedding provider abstraction

## Technology Stack

| Component | Technology |
|-----------|-----------|
| Language | TypeScript (strict mode) |
| Runtime | Node.js 23+ |
| Package Manager | pnpm |
| Test Framework | Vitest 2.1 |
| Validation | Zod 4 |
| Build | tsc (ESM) |

## Quality Metrics

| Metric | Value |
|--------|-------|
| Test Files | 432 |
| Total Tests | 7,284 |
| Pass Rate | 100% |
| TypeScript Errors | 0 |
| Zod Schemas | 4 (config, plugin, API, webhook) |
