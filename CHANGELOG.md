# CoreBlow Changelog

All notable changes to this project will be documented in this file.
Entries are listed newest-first within each version block.
Changelog covers user-facing changes only; internal/meta notes are omitted.

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
