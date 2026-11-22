# CoreBlow Changelog

All notable changes to this project will be documented in this file.
Entries are listed newest-first within each version block.
Changelog covers user-facing changes only; internal/meta notes are omitted.

## [2.1.1] (2026-11-22)

### Fixes

- **Hoisted tsx Resolution in CLI:** Fixed `coreblow` launcher failure when installed globally via `npm` or `npx` in hoisted environments by checking parent `.bin/tsx` and resolving an absolute file URL for `tsx/esm`.
- **Security Update for WhatsApp Channel:** Upgraded `@whiskeysockets/baileys` to patched release `7.0.0-rc14` to resolve GHSA-qvv5-jq5g-4cgg (message upsert and app state corruption).

## [2.1.0] (2026-11-22)

### Highlights

CoreBlow v2.1.0 release introduces a full React + Ink declarative terminal experience with a centered welcome hero, bottom-pinned rounded composer, 24/7 cron job orchestration, unified bot messaging channels, multi-provider model switching, and pluggable local/remote execution backends.

### Features

- **Declarative React + Ink Flexbox TUI:** Modular, flicker-free terminal interface with adaptive Light/Dark contrast, centered hero emblem, bottom-pinned rounded orange composer, and exclusive modal overlays.
- **Headless & Stdin Pipe Execution (`-p`):** Clean scriptable execution with stdin piping up to 10 MB and structured `--output-format text|json|stream-json` NDJSON streaming.
- **Session Continuation & SQLite FTS5 Resume (`-c` / `-r`):** Instant workspace session continuation and interactive full-text search session picker with fork and rename support.
- **24/7 Cron Orchestration (`/cron`, `coreblow cron`):** Live job scheduler, execution history inspection, and run-now triggering across local and bot destinations.
- **Unified Bot Messaging & Gateway Lifecycle (`/bots`, `coreblow bots`):** Unified channel monitor for Telegram, Discord, Slack, WhatsApp, Signal, and WebChat with automatic bot loop-protection.
- **Pluggable Execution Backends (`/backend`, `--backend`):** Per-session execution switching across host shell, OS-level Seatbelt/Bubblewrap sandbox, Docker container, remote SSH, paired CoreBlow remote node, and cloud runners.
- **Desktop Session Handoff (`--session` / `COREBLOW_SESSION_ID`):** Seamless one-click session handoff from CLI/TUI to CoreBlow Studio Desktop with single-instance window focus and live session switching.

### Security

- **AST-Based Skill Security Scanner:** Deep JavaScript/TypeScript syntax tree inspection via TypeScript Compiler API detecting dynamic code evaluation, constructor-chain bypasses, and obfuscated dynamic imports.
- **Desktop Hardening:** Enabled Chromium OS-level process sandboxing (`sandbox: true`) and interactive user consent confirmation before window screen captures.
- **Channel Session Isolation:** Default `dmScope` set to `per-channel-peer` for strict direct message separation across channels.
- **MCP Tool Collision Guard:** Automatic namespacing and warning for duplicate tool registrations across plugins and servers.
- **OS-Level Bash Sandbox:** Apple Seatbelt (macOS) and Bubblewrap (Linux) profiles restricting write operations to project workspace and temp directories while blocking sensitive credential paths.
- **Packaging & Installer Resilience:** Entitlements-secured macOS packaging pipeline supporting Developer ID runtime signing and automatic `$HOME/.local` permission fallback for universal installation.

## v1.0.0 (2026-05-14)

### Highlights

CoreBlow reaches General Availability. All platforms (macOS, iOS, Android) achieve structural
parity with the reference architecture. Security audit clean, zero known vulnerabilities.

### Security

- Resolve all 12 npm vulnerabilities (6 high, 5 moderate, 1 low)
- Bump `@opentelemetry/*` 0.215.0 → 0.217.0 (fix Prometheus exporter crash)
- Add pnpm overrides for `hono` (≥4.12.18), `fast-uri` (≥3.1.2), `fast-xml-builder` (≥1.1.7), `basic-ftp` (≥5.3.1)
- `pnpm audit` returns 0 vulnerabilities

### Changes

- SharedKit test stabilization: 190/190 tests pass
- iOS architectural parity: 256 files, 21,689 lines (106% of reference)
- iOS Xcode project generation: `project.yml` + `CoreBlow.xcodeproj`
- `xcodebuild` BUILD SUCCEEDED for iOS scheme
- macOS structural parity with reference codebase
- DeviceAuthStore test isolation via temp-directory COREBLOW_STATE_DIR
- Fix ChatViewModel concurrency test ordering
- Fix AnyCodable.encode() for dictionary and array types
- Fix GatewayChannelActor session injection
- Relocate DiagnosticsFileLog, NodeMode files to match reference structure
- Create CoreBlowApp.swift, RootCanvas, SettingsTab, and 9 other iOS files
- Expand 32 iOS files to ≥80% parity
- Zero OpenClaw naming remnants in codebase
- Add production-ready CLI, runtime, and Control UI localization across 10 languages

## v0.9.0 (2026-05-09)

### Changes

- Android: achieve 89.6% parity with reference architecture
- Android: final stub elimination across all modules
- Expand OnboardingFlow, SettingsSheet, NodeRuntime, SmsManager
- Expand ChatMarkdown, TalkModeManager, GatewaySession, GatewayDiscovery
- Expand 12 test files across Android test suite
- Create 21 Android test files + expand 2 stubs
- Fix LocalMobileColors and MobileColors import paths

## v0.8.0 (2026-05-06)

### Changes

- Android: Phase 1A–1F core infrastructure (voice config, protocols, chat UI)
- Create 24+ Android source files with 4,000+ lines
- Deep expansion of handlers, gateway, and UI modules
- Cross 80% parity milestone for Android

## v0.7.0 (2026-05-04)

### Changes

- Android: gateway and UI expansion phases H–O
- Handlers deep expansion
- Voice + gateway expansion
- Settings and widget expansion

## v0.6.0 (2026-05-02)

### Changes

- Android: initial architecture phases A–G
- Create core module structure for Android app
- Establish parity tracking infrastructure
- Gateway protocol implementation

## v0.5.0 (2026-04-29)

### Changes

- Rename package `@coreblow/coreblow` → `coreblow`
- ESM import compatibility for npm install
- Add coreblow self-reference alias for bare import resolution
- Rewrite CLI launcher to use tsx instead of dist/entry.js

## v1.0.0-rc.1 (2026-03-04)

### Highlights

First release candidate of CoreBlow — Autonomous AI agents platform.

### Changes

- Multi-provider gateway (OpenAI, Anthropic, Gemini, Groq, DeepSeek)
- Agent framework with tool execution
- Auto-reply system with configurable triggers
- Browser automation via Puppeteer
- Channel extensions (Discord, Slack, Telegram, WhatsApp)
- CLI tooling (`coreblow` command)
- Gateway WebSocket protocol
- Session management and compaction
- Plugin SDK with extension loading
- MCP (Model Context Protocol) support
- Observability via OpenTelemetry
- Docker deployment configuration
- macOS, iOS, Android companion app scaffolding
