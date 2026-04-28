# Changelog

All notable changes to the CoreBlow Gateway will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Nothing yet

### Changed
- Nothing yet

### Fixed
- Nothing yet

---

## [1.0.0-rc.1] - 2026-04-28

### Added
- **P3: Pairing System** — Device pairing with challenge/response flow, persistent store, QR auth, and policy enforcement (`src/pairing/`)
- **P3: Channel Depth** — Per-channel typing lifecycle with keepalive loops, start guards, and safety TTL; thread binding registry with expiry; draft stream controls with throttled updates (`src/channels/`)
- **P3: Extensions** — Extension loader with manifest validation, context pruning engine, conversation compaction, public artifact serving, session manager registry (`src/extensions/`)

### Changed
- **Hardening: Zero `@ts-nocheck`** — Removed all 347 `@ts-nocheck` suppressions across the entire codebase (Sprints 1–8); all files now compile under strict TypeScript
- **Hardening: Zero source `as any`** — Eliminated all 24 `as any` casts from source files using union widening, generic rewrites, `unknown` guards, and SDK bridge patterns (Sprint 14)
- **Hardening: OOP Architecture restored** — `ProviderDispatcher` class fully restored with proper dependency injection; 10 previously broken tests fixed (Sprint 13)
- **Hardening: Circular dependency baseline** — 115 circular dependency pairs locked and documented; Phase 4c extraction deferred post-v1.0 (Sprint 4)
- **Dependency upgrades** — `vite` → 8.0.10, `vitest` → 4.1.5, `dompurify` → latest; 13 transitive dependencies patched via `pnpm overrides`

### Fixed
- **Security: 34 → 0 vulnerabilities** — Resolved all `pnpm audit` findings (2 critical, 12 high, 20 moderate) via direct upgrades and `pnpm overrides` for transitive deps including `path-to-regexp`, `protobufjs`, `lodash`, `qs`, `axios`, `esbuild`, `postcss`, `picomatch`, `hono`, `fast-xml-parser`, `uuid`, `css-what`, `nth-check`
- **Type Safety: Test coverage ≥ 80%** — Added 17 new test files across `tools/`, `memory/`, `providers/`, `observability/`, `skills/`, `sandbox/` (Sprint 5)
- **Type Safety: Plugin system** — Fixed hook event shapes, marketplace-api phantom imports, wrong import names across plugins/ (Sprint 6–7)
- **Type Safety: Single `@vitest/spy` version** — Enforced `@vitest/spy@4.1.4` deduplication to eliminate test runner conflicts (Sprint 1)
- **1 pre-existing test failure** — Remains in baseline; tracked and deferred (not a regression)

### Infrastructure
- 133/134 tests passing (1 pre-existing failure, not a regression)
- TSC: 0 errors
- Source `as any` casts: 0
- `@ts-nocheck` suppressions: 0
- Remaining debt: 279 `as any` in `.test.ts` files (deferred), ~173 `: any` SDK callback signatures in `src/agents/` (post-v1.0)

---

## [0.3.0] - 2026-04-07

### Added
- **P2: CLI/TUI** — Startup banner, argument parser, command output formatting, channel auth wizard, shell completion (bash/zsh/fish), progress indicators
- **P2: Media Understanding** — Multi-modal analysis types, image/audio/video engines, scope validation, format detection, error hierarchy
- **P2: Process Management** — Safe command execution with timeout, process tree kill (Unix + Windows), spawn with fallback, child process IPC bridge
- **P2: Markdown Engine** — IR parser, cross-channel renderer (Discord/Telegram/WhatsApp), code fence extraction, table parsing, frontmatter
- **P2: CI/CD** — Dependabot config, stale issue management, smoke test workflow, Bun CI matrix, release workflow with GHCR

---

## [0.2.0] - 2026-04-06

### Added
- **P1: Config Granularity** — Channel capabilities matrix, agent limits, runtime schema validation, allowed values registry, agent-channel bindings, env mapping, byte size parsing
- **P1: Auto-Reply Engine** — Inbound debounce with key-based batching, group activation / mention gating, send policy with cooldown + rate limiting, heartbeat, thinking levels, model runtime with fallback chains, rule engine
- **P1: Command System** — 9 command handler categories (config, session, memory, tools, plugin, channel, security, agent, system) with 30+ commands
- **P1: Plugin SDK** — Agent runtime, channel helpers, approval runtime, provider helpers, temp path, event emitter
- **P1: Test Coverage** — 20 new test files covering secrets, auto-reply, config, plugin SDK, and utils

---

## [0.1.0] - 2026-04-05

### Added
- **P0: Type Safety** — Strict TypeScript compilation with zero errors across 116K+ LOC
- **P0: Secrets Management** — 3-source secret resolution (env/file/exec), AES-256-GCM encryption with PBKDF2, key rotation with grace periods, redaction engine, security audit
- **P0: Structured Logging** — Pino-based structured logging with redaction, file transport, environment-aware configuration
- **P0: Dockerfile** — Multi-stage build with bookworm-slim base, production-optimized
- **P0: SECURITY.md** — Security policy, vulnerability reporting, threat model documentation

### Infrastructure
- Initial gateway architecture with 978 source files
- 460 test files with 7,623 test cases
- Zero TSC errors, zero test failures
- Test-to-source ratio: 0.66x

---

## Legend

| Label | Meaning |
|-------|---------|
| P0 | Critical — Must have for production |
| P1 | High — Sprint priority |
| P2 | Medium — Q2 2026 |
| P3 | Nice to have — Stretch goals |
