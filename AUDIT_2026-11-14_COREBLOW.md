# CoreBlow Independent Full Audit

**Date:** 2026-11-14
**Commit:** `d969a57be` (`main`, clean working tree)
**Runtime:** Node 22.22.2, pnpm 10.23.0, Vitest 4.1.6, tsgo 7.0.0-dev
**Method:** read-only source audit plus targeted execution. Every claim below was checked against code, not against the project's own documents.

---

## 1. Executive verdict

CoreBlow is two systems in one repository.

**A. The agent gateway (real, mature, working).** A large OpenClaw-lineage runtime: gateway, sessions, routing, 20+ channel transports, 45+ model providers, a real model/tool loop, subagents, memory-core, approvals, sandboxing, pairings, CLI (40+ command groups), Control UI, native macOS/iOS/Android clients, 5,303 test files and 25,306 test cases. This part is genuinely production-shaped and is what users actually run.

**B. The "Sovereign Agent-OS" layer (real code, real unit tests, not operational).** Cory memory, EvoLoop skill synthesis, War Room, Knowledge Scribe, PR workflow, the 12-service microkernel, the WAL session ledger, and reversible compaction. These modules are substantial (300-1,100 LOC each) and their focused tests pass. But they are wired only into `src/gateway-entry.ts:530`, and that entry point is imported only by `src/cli/commands/gateway-cmd.ts:24`, a registrar that nothing calls. The gateway users actually start (`coreblow gateway run`, Docker, daemon) goes through `src/gateway/server.impl.ts`, which contains no reference to any of these services. The autonomy guarantees that the documentation advertises therefore do not execute on a real user turn.

**Is it "advanced"?**
- As an agent gateway and integration platform: **yes, clearly** (breadth is exceptional; depth is uneven).
- As the autonomous Agent-OS the docs claim: **not yet** (the flagship layer is off the production path, and several guarantees are fictional).
- As a source of truth about itself: **no** (the documentation materially overstates status, and part of the test/parity surface is theater).

**Scope note:** the wider 26-repository ecosystem exists on the author's disk. This audit covers the monorepo; cross-repo claims are flagged as unverifiable here, not assumed false.

**Is it "OpenClaw + Hermes"?** The OpenClaw lineage is literal and measurable: 88% path alignment with a May-2026 OpenClaw snapshot. The Hermes side is conceptual (ReAct, skill evolution, delegation) plus a migration importer (`extensions/migrate-hermes`); there is no second runtime in the tree. It is best described as a diverged OpenClaw fork with an added autonomy layer, not as a merge of two engines.

---

## 2. Scorecard

| Area | Score | One-line reason |
| :--- | :---: | :--- |
| Gateway and runtime foundation | 8/10 | Real, layered, tested; the isolated harness boots 12 services cleanly |
| Channel breadth and depth | 8/10 | ~22 real transports; Telegram/Discord/Slack/Matrix are production-grade |
| Provider breadth | 6/10 | 49 provider manifests, but ~62/93 transports are OpenAI-compatible clones; some are hollow |
| Agent tool loop and orchestration | 7/10 | Real loop, subagent spawn/depth caps, failover; core loop lives in an external npm package |
| Memory and RAG | 6/10 | memory-core is real; Cory/microkernel memory is unwired; dreaming execution layer missing |
| Claimed agent-OS autonomy | 3/10 | War Room is keyword bookkeeping, PR workflow never touches git, EvoLoop never fires on a turn |
| Plugin platform | 5/10 | Loader is solid; consent, capabilities, lifecycle persistence, sandbox, and rollback are partial or dead |
| Security posture | 6/10 | Strong SSRF/approval/pairing primitives; sandbox off by default, audit trail not persisted |
| Quality gates and tests | 4/10 | 25k test cases, but 345 are no-ops, 517 files use `@ts-nocheck`, typecheck is red, security gate is a stub |
| Documentation and claim integrity | 2/10 | Fabricated citations, contradictory numbers, v1.0.0 code labelled v2.0.0 GA |
| Brand and system consistency | 3/10 | OpenClaw commands still printed to users; phantom plugin ids; stale AGENTS paths |
| **Overall** | **6/10 platform / 3/10 claimed autonomy** | Strong foundation, immature and overstated autonomy story |

---

## 3. What is genuinely advanced

These are real and were verified in code or by execution:

1. **Gateway and lifecycle.** `src/gateway/service-registry.ts` implements dependency-ordered start, reverse-order shutdown, per-service health, and failure capture. The real gateway boots through it (`src/gateway/server.impl.ts:1446`).
2. **Channel surface.** 24 channel manifests, 26 channel plugins, ~22 with real transports. Telegram alone has send/edit/delete/react/typing/polls/topics at `extensions/telegram/src/send.ts`; Discord has a ~63k-LOC surface including voice and components; Matrix and Slack are comparably deep. A genuine adapter contract exists at `src/channels/plugins/types.adapters.ts`.
3. **Provider surface.** 49 provider manifests, 58 provider ids, 267 model catalog entries (102 vision-capable), OAuth/device-code/CLI/local auth paths, and real per-provider stream wrappers (e.g. `extensions/deepseek/stream.ts`).
4. **Tool and subagent system.** Real built-in tools (`read`, `write`, `edit`, `exec`, `process`, `apply_patch`, `web_search`, `web_fetch`, `browser`, `sessions_*`, `memory_*`, `tts`, `canvas`, `image_generate`), policy gating, owner-only tools, and a subagent spawn path with depth/children caps (`src/agents/subagent-spawn.ts`, `src/agents/subagent-depth.ts`).
5. **Reliability primitives.** Failover policy, auth-profile rotation, compaction safety timeouts, ACP permission relay, per-session write locks, atomic file writes, SSRF protection with DNS pinning, fail-closed exec approvals.
6. **Plugin contribution model.** `PluginManifestContracts` supports 20 contribution types (channels, providers, tools, speech, realtime voice/transcription, media understanding, document extractors, image/video/music generation, web search/fetch/extract, migration, gateway methods, agent tool-result middleware) at `src/plugins/manifest.ts:174-195`.
7. **Client surface.** Control UI is a real gateway client (`ui/src/ui/gateway.ts`) with 13 views; macOS/iOS/Android apps exist; 10 i18n locales including Indonesian.
8. **Test volume.** 5,303 test files and 25,306 `it`/`test` calls; lint is clean (0 warnings/errors over 8,817 files).

### 3.1 README and ecosystem map cross-check

I read `README.md`, `docs/ECOSYSTEM_MAP.md`, and the local-only `docs/COREBLOW_ECOSYSTEM_26_REPOS.md` (untracked and correctly listed in `.git/info/exclude`).

**What holds up**

- The 26-repository ecosystem is real on the author's machine: 25 satellite checkouts plus the monorepo, `corehub`, `coreblow.com`, `coreblow-test`, and `coreblow-workspace` exist, and the sibling CoreHub checkout holds 16 `.tgz` artifacts. The federation is genuine, not a documentation fiction.
- README's product description (gateway-first runtime, plugin SDK, OOP boundaries, 12-service microkernel) matches the code at the top level.

**What does not**

- README's architecture table names **9 classes that do not exist**: `MicrokernelRegistryService`, `CoryMemoryService`, `DecisionRouterService`, `WarRoomService`, `AppStoreRuntimeService`, `ChatViewService`, `SovereignVoiceService`, `SovereignMcpBridgeService`, `ReleaseCertifierService`. The real names are `CoryBootstrapService`, `CorySkillSynthesizerService`, `WarRoomOrchestratorService`, `CoreHubAppStoreRuntime`, `GaReleaseCertifier`, and so on; only `SkillSynthesizerService` and `UniversalAgentImporterService` match.
- `docs/ECOSYSTEM_MAP.md` claims **Ed25519 signature validation** for CoreHub apps. `src/plugins/signature-verify.ts` has no Ed25519 code: the declared algorithm is `'sha256'`, verification is hash equality against a self-registered publisher map, and the module has zero importers.
- The map repeats the `< 1 ms` boot, "sandboxed worker processes", "community plugins cannot crash the gateway", and "100% brand sovereignty" claims that sections 4, 7, 9, and 12 refute.
- `docs/COREBLOW_ECOSYSTEM_26_REPOS.md` is correctly private (untracked, excluded), so it is not a leak. But because it exists only on the author's disk, every claim that depends on it (artifact certification, satellite builds) is not reproducible from this repository or in CI.

This changes the nuance, not the verdict: the ecosystem ambition is real; the monorepo's operational claims still do not match the monorepo's runtime.

The satellite fleet is audited separately in `AUDIT_2026-11-14_ECOSYSTEM_26_REPOS.md`: three repositories (`corehub`, `docs`, `coreblow.com`) hold 98.6% of all satellite source code, while the remaining 22 are roughly 40-LOC scaffolds that do not implement the roles the ecosystem map assigns to them.

---

## 4. The critical wiring gap

### 4.1 Evidence

- `createMicrokernelServiceRegistry()` is called **only** at `src/gateway-entry.ts:530`; the services start at `:547` via `registry.startAll()`.
- `src/gateway-entry.ts` is imported **only** by `src/cli/commands/gateway-cmd.ts:19`.
- `registerGatewayCommand` (`src/cli/commands/gateway-cmd.ts:24`) has **zero callers**.
- The real CLI path is `src/cli/gateway-cli/run.ts:16` -> `startGatewayServer` from `src/gateway/server.js` -> `src/gateway/server.impl.ts`. Docker (`docker-compose.yml`, command `node coreblow.mjs gateway`) and the daemon use the same path.
- `src/gateway/server.impl.ts` contains no `cory`, `war-room`, `skill-synthesizer`, `knowledge-scribe`, `microkernel`, or `tierPolicy` reference.

### 4.2 Consequence table

| Documented capability | Implemented? | Executes on a user turn? |
| :--- | :---: | :---: |
| 12-service microkernel boot DAG | Yes (`src/gateway/microkernel-services.ts:441-471`) | **No** (dead entry) |
| Cory four-layer memory | Yes (`src/memory/cory.ts`) | **No** (only microkernel/MCP bridge) |
| EvoLoop trajectory -> skill synthesis | Yes (`src/learning/`) | **No** (no turn interception) |
| Pre-LLM skill injection | Function exists (`dop-skill-distiller.ts:1034`) | **No** (no callers outside `src/learning/`) |
| War Room / Kanban DAG | Code exists (`src/agents/war-room/`) | **No**, and it never calls a model or spawns an agent |
| Knowledge Scribe / wiki | Yes (`src/memory/knowledge-scribe.ts`) | **No** (HTTP/MCP only) |
| PR workflow with 5 gates | Gate logic exists (`src/agents/pr-workflow/`) | **No**, and it never runs git or a PR API |
| 120 s isolated worker subagents | **No** — no `worker_threads` in `src/`; spawn timeout defaults to none | No |
| Nonce-signed inter-agent envelopes | **No** — no signing code in `src/acp/` | No |
| Three-stage reversible compaction | Class exists and is tested, but unused; production compaction is one summary pass | No |
| WAL session persistence | Class exists, starts as a gateway service, but has **zero `append()` callers** | No |

### 4.3 Why this is the headline

It is not a missing feature; it is a missing wire. The sovereign layer is a well-tested island. `src/runtime-lightweight-metrics.test.ts` proves the island works (4 tests pass; exactly 12 services start; 0 CoreHub apps load; boot under the enforced 200 ms gate). Nothing proves the island is connected to the mainland.

Two secondary symptoms:

- `GaReleaseCertifier` is registered in the real gateway, but every check defaults to pass (`options.x ?? true`, e.g. `src/infra/release/ga-release-certifier.ts:76-80`), so it self-certifies GA.
- `src/gateway/plugin-integration.ts` instantiates `PluginLoader`, the class that owns sandbox, permissions, audit, hot reload, and dependency resolution — but `GatewayPluginIntegration` is never instantiated, so that entire stack is dormant.

---

## 5. Integrity debt: facades and test theater

This is the most damaging finding after the wiring gap, because it corrupts every "coverage" and "parity" number.

| Pattern | Count | Where |
| :--- | ---: | :--- |
| Facade source files (`type XFacade = Record<string, unknown>` + `id: "<own path>"`) | **590** | 543 in 11 extensions, 47 in `src/` |
| Tautological tests (`expect("path").toContain("prefix")`) | **345** | `qa-lab` 75, `codex` 54, `qqbot` 51, `oc-path` 40, `memory-wiki` 23 |
| `@ts-nocheck` files (forbidden by `AGENTS.md`) | **517** (275 non-test) | `src/` 178, `extensions/` 339 |

Hollow extensions, measured as facade files / total non-test `.ts` files:

| Extension | Files | Non-test LOC | Facade share |
| :--- | ---: | ---: | ---: |
| `extensions/codex` | 74 | 445 | 99% |
| `extensions/qa-matrix` | 47 | 283 | 98% |
| `extensions/memory-wiki` | 35 | 211 | 97% |
| `extensions/qa-lab` | 143 | 863 | 97% |
| `extensions/google-meet` | 24 | 145 | 96% |
| `extensions/canvas` | 19 | 115 | 95% |
| `extensions/file-transfer` | 18 | 109 | 94% |
| `extensions/qqbot` | 142 | 856 | 94% |
| `extensions/oc-path` | 31 | 188 | 94% |
| `extensions/deepinfra` | 13 | 79 | 92% |
| `extensions/qa-channel` | 22 | 137 | 86% |

Concrete user-visible consequences:

- `extensions/deepinfra/coreblow.plugin.json` advertises a provider, six contracts, and `enabledByDefault: true`, while `extensions/deepinfra/index.ts` is `register() {}`.
- `extensions/qqbot/coreblow.plugin.json` advertises tools `qqbot_channel_api` and `qqbot_remind`; no tool registers.
- `extensions/tts/index.ts:21` returns a success string without synthesizing audio; `gemini-auth`, `qwen-auth`, and `minimax-auth` return strings such as `"Gemini auth login"` for every action.
- `extensions/whatsapp/src/__tests__/channel.test.ts` tests a class with no `sendMessage`; it stays green because of `@ts-nocheck` and because that test is outside the Vitest include list.

Effect on metrics: 590 of the "shared" source paths and 345 of the "shared" test paths are placeholders. After subtracting them, behavior alignment with upstream is roughly 80%, and test alignment roughly 70% — not the 100% implied by many per-domain `done` statuses.

---

## 6. Documentation vs reality

| Claim | Source | Verdict |
| :--- | :--- | :--- |
| Kernel boot `< 1 ms` / `0.56 ms` | `docs/ARCHITECTURE.md:130`, `docs/PHASE5_TO_7_ROADMAP.md:56` | **Overstated 100-200x.** The enforced assertion is `< 200 ms` (`src/runtime-lightweight-metrics.test.ts:71`); the whole 4-case file executes in 23 ms. |
| Subagents isolated in worker threads with a 120 s ceiling | `docs/ARCHITECTURE.md:316`, audit report `:174` | **False.** `worker_threads` appears nowhere in `src/`; `sessions_spawn` default timeout is none. |
| Nonce-signed cryptographic envelopes | audit report `:175,230` | **Fabricated.** `src/acp/envelope-signer.ts` does not exist and nothing replaces it. |
| Vault manager, path jail, RBAC | audit report `:223,225,226` | `vault-manager.ts` does not exist and `src/security/rbac.ts` has zero importers, so no RBAC is enforced; the real path jail is `src/plugins/path-jail.ts` and only guards the dormant `PluginLoader`. |
| Three-stage reversible compaction with immutable tags | `docs/ARCHITECTURE.md:114-118`, audit `:178-185` | **Unwired.** The class exists and is tested; production compaction is a single model summary with no immutable-tag concept. |
| 15/15 `.coreblow-plugin.tgz` artifacts certified | `docs/PHASE5_TO_7_ROADMAP.md:51` | **True only outside this repo.** 16 `.tgz` exist in the sibling CoreHub checkout; none are in this repo, the "certifying" test hardcodes a personal absolute path, and it silently passes when absent (`src/plugins/corehub-e2e-install.test.ts:30-31`). CI cannot verify the claim. |
| v2.0.0 GA certified | `docs/ARCHITECTURE.md:3`, roadmap header | **Contradicted** by `package.json` version `1.0.0` and `CHANGELOG.md` `v1.0.0 (2026-05-14)`. |
| "Zero OpenClaw naming remnants" | `CHANGELOG.md:36` | **False.** 178 `src/` files reference OpenClaw (mostly compatibility shims), and user-facing repair hints print `openclaw plugins install` (`src/plugins/official-external-plugin-repair-hints.ts:41-42`). |
| Wilson z = 1.96 and rollback at fitness < 0.40 | `PROJECT.md:8,18` | **Contradicted by code:** z = 1.28; rollback on `consecutiveFailures >= 2` or `wilson < 0.35`. |
| `src/plugins/extension-tier-policy.ts` "enforces" the core/on-demand boundary | `docs/ARCHITECTURE.md:136` | **Display-only.** No load or install path consults it; unknown ids silently default to on-demand. |
| "Audit report" file citations (`src/secrets/vault-manager.ts`, `src/infra/path-jail.ts`, `src/acp/worker-pool.ts`, `src/acp/envelope-signer.ts`) | `docs/COREBLOW_COMPREHENSIVE_AUDIT_REPORT.md` | 2 fabricated, 3 renamed, 5 overstated, 2 verified out of 12 OWASP rows. |
| Repo is 1.88M LOC / 15,104 files; `docs/` has 4 files | audit report `:5,26` | Stale. `src` + `extensions` alone are ~2.2M TS LOC; `src` is 8,872 files; `docs/` has 25 files. |

---

## 7. Plugin platform assessment

### 7.1 What works

- **Loader:** `src/plugins/loader.ts` (1,463 LOC) — discovery across global/workspace/bundled roots, activation planning, config allow/deny, Jiti loading, per-plugin try/catch, 124 bundled plugins.
- **Install:** atomic stage -> backup -> rename (`src/infra/install-package-dir.ts:213-283`), SHA-256 artifact verification (`src/plugins/corehub.ts`), `minGatewayVersion` gating.
- **Manifest breadth:** 20 contribution contract types; 133 of 142 directories carry a `coreblow.plugin.json` and all 133 parse; 56 extensions enabled by default. Note that parsing is a low bar: only 38 of 133 declare a `name`, and **0 of 133 declare `version`, `entry`, `capabilities`, or `permissions`**.
- **SDK surface:** 439 SDK entrypoints; root barrel kept minimal; extension import boundaries enforced by dedicated scripts (when run).
- **Fault containment at load/register time:** a throwing plugin is skipped without killing boot.

### 7.2 What does not work

| Gap | Evidence |
| :--- | :--- |
| Consent ledger is never consulted by the loader | zero `consent` references in `loader.ts`, `discovery.ts`, `registry.ts`; an installed app becomes loadable on the next boot |
| No real capability declarations | 0/133 manifests declare capabilities/permissions; the validating Zod schema is imported only by its own test |
| Lifecycle state is in-memory only and `update` has no rollback | `app-store-contract.ts:367` is a `Map`; `update.ts` has no backup path |
| Plugins are not sandboxed and can crash the process | no worker/process isolation; unhandled rejection exits the gateway (`src/infra/unhandled-rejections.ts`) |
| Install-time code scan is advisory | critical findings only `logger.warn` and installation continues |
| Tier policy is wrong and inert | 14 phantom "core" ids that are microkernel services, 69 extensions unclassified, `bluesky`/`mqtt` listed but unloadable |
| Manifest catalog drift | 133 manifests vs 124 bundled entries; 9 extension directories cannot load (no `coreblow.plugin.json`) |
| Naming invariant violated | `extensions/kimi-coding/coreblow.plugin.json` declares id `kimi` |
| SDK stability machinery is dead | `src/plugin-sdk/api-baseline.ts:1` says "Zero consumers"; `scripts/check-plugin-sdk-exports.mjs` is two lines of `console.log` |
| Boundary guard is red and unenforced | `node --import tsx scripts/check-no-monolithic-plugin-sdk-entry-imports.ts` exits 1 (two Discord files); not part of `pnpm check` or CI |
| Install endpoint validates id too late | `manifest.id` is joined into a filesystem path before validation (`microkernel-services.ts:1173-1200`) — auth-gated, but a traversal write primitive |

**Bottom line:** the plugin *host* is solid; the plugin *store* is a demo harness. The "7-pillar App Store" exists as vocabulary and isolated tests, not as the path an operator's plugin takes.

---

## 8. Agent cognition and autonomy

| Capability | Status | Reality |
| :--- | :--- | :--- |
| ReAct model/tool loop | Production, delegated | Runs inside `@mariozechner/pi-coding-agent`; the in-repo loop (`src/agents/coreblow-react-engine.ts`) is off-path |
| Tool schema validation | Production, external | TypeBox schemas on tool definitions; the in-repo `src/tools/tool-executor.ts` has no production importer |
| Parallel subagents | Production | `sessions_spawn`, depth/children caps, registry and announce |
| Worker isolation + timeout | **Missing** | No `worker_threads`; default spawn timeout unset |
| Inter-agent message signing | **Missing** | No HMAC/nonce/signature in `src/acp/` |
| Compaction | Production, simpler than documented | One model-generated summary (`src/agents/pi-embedded-runner/compact.ts`); reversible ledger is dead |
| Skill synthesis (EvoLoop) | Real but unreachable | 3 gates, Wilson score, promotion/rollback, revisions all implemented and tested; no turn calls it |
| 6-tier decision router | Partial | Route table real; classifier is keyword regexes; consumers are the dead microkernel path |
| Quota-window failover | Partial | Switches at 100% of the window, not the documented 95% |
| Fallback provider chain | Dead | `src/providers/fallback.ts` has no production instantiation |
| War Room / Kanban | Simulation | Keyword role classification and in-memory board; never calls the provider runtime it stores |
| PR workflow | Simulation | Gate checks and markdown generation; no git, no PR API |
| Memory (Cory) | Real but unreachable | SQLite WAL + FTS5 + BM25 implemented; no importer from `src/agents` or `src/auto-reply` |
| Memory (memory-core) | Production | Real hybrid search, MMR, temporal decay, memory flush plan |

---

## 9. Security posture

**Genuinely strong:** SSRF guard with DNS re-check and IP pinning (`src/infra/net/ssrf.ts`), fail-closed exec approvals (`security="deny"`, `askFallback="deny"`), ACP approval classification that fails closed, pairing codes from `crypto.randomBytes` with TTL and lockout, Docker sandbox hardening flags, secret resolution via env/file/exec with containment and limits, CodeQL (5 split configs) + Dependabot, npm provenance on publish.

**Weak or theatrical:**

- `sandbox.mode` defaults to `"off"` (`src/agents/sandbox/config.ts:245`); host `exec` uses `process.cwd()` with no jail.
- A model-supplied `elevated: true` can turn `ask` off when the operator configured `defaultLevel: "full"` (`src/agents/bash-tools.exec.ts:352-354`).
- Secret redaction runs on logs only; outbound model requests and tool results are not scrubbed.
- Audit logging (`audit-logger.ts`, `audit-trail.ts`) is in-memory with zero production importers; nothing is tamper-evident or persisted.
- Trust zones, RBAC, rate-limiter/token-bucket, signature verification, and `safe-path` are all unimported outside tests.
- Credentials live as plaintext JSON at `~/.coreblow` with `0o600`; the AES-GCM helper is unused.
- `scripts/check-security.mjs` is `console.log('check-security: passed')`.
- `pnpm audit --prod || true`; lint is `continue-on-error`; no SBOM, no signing, actions pinned by tag.
- `pnpm typecheck` is red on `main` (`extensions/clickclack/src/config-schema.ts:31`, zod 4.3.x vs 4.4.3), and CI runs it.

OWASP report verification: **2 verified, 3 renamed, 5 overstated, 2 fabricated** out of 12 cited controls.

---

## 10. Parity with OpenClaw

From `scripts/parity/openclaw-parity-matrix.json` plus independent sampling:

| Metric | Value |
| :--- | :--- |
| CoreBlow source paths | 9,153 |
| Upstream source paths | 8,443 |
| Shared | 7,369 (87.6% of upstream) |
| CoreBlow-only | 1,784 (21.2% of upstream) |
| Upstream-only (missing) | 1,047 (12.4%) |
| Test paths shared / missing | 3,874 / 1,111 (22.3% gap) |
| Domains with zero source gaps | 243 of 272 |
| Gap concentration | 29 domains hold all 1,047 gaps; top 15 = 82.5% |

After removing 590 facade source files and 345 fake tests, real behavior alignment is ~80% and real test alignment ~70%.

Largest real gaps: `src/agents` (178 files, incl. native hook relay, tool search, code mode, video/music tools, turn-engine resilience), `src/auto-reply` (97, reply-run registry and command surface), `extensions/telegram` (78, message cache, ingress spool, update tracker), `extensions/whatsapp` (78), `extensions/browser` (53), `extensions/memory-core` (42, entire "dreaming" execution layer), `src/gateway` (39, talk/artifacts/skills-upload/approvals/checkpoints), `src/secrets` (30).

The matrix itself is stale twice: generated against a May-2026 snapshot (`generatedDate` "2026-05-26" is a hardcoded literal) and not regenerated since 2026-10-30. Since then, 54 commits added product surface but closed no upstream gaps.

---

## 11. Health and gates (as run)

| Gate | Result |
| :--- | :--- |
| `pnpm lint` (oxlint) | **Pass** — 0 warnings / 0 errors over 8,817 files |
| `pnpm check` | **Pass** — but only lint + MCP import budget |
| `pnpm exec tsgo --noEmit` | **Fail** — exit 2, 1 error (clickclack zod mismatch) |
| Scoped Vitest (war-room, pr-workflow, knowledge-scribe, skill-synthesizer, decision-router) | **Pass** — 108/108 |
| Microkernel boot test | **Pass** — 12 services, 0 eager CoreHub apps, under 200 ms |
| Monolithic SDK import check | **Fail** — exit 1, two Discord files |
| `pnpm format` | **No-op** — script prints "not yet available — skipping" |
| `lint:security` / `check-plugin-sdk-exports` | **Stubs** — two-line `console.log` |
| Security workflow | `pnpm audit --prod || true`, two-pattern secret grep |
| Typecheck in CI | Runs and will fail at this commit |

---

## 12. Brand and system consistency

- 178 `src/` files reference `openclaw`; most are deliberate compatibility shims, but user-facing strings still emit `openclaw plugins install` and `openclaw doctor --fix`.
- Both official external catalogs remain OpenClaw-branded (33 and 14 matches; plugin catalog 10/10 entries are `@openclaw/*`).
- `extensions/kimi-coding` declares id `kimi`.
- Documentation claims "100% brand sovereignty" while `docs/` itself contains 10 files with the competitor name and 435 lines with absolute personal paths across 83 files in src/extensions/docs/scripts.
- `AGENTS.md:20` references `src/telegram`, `src/slack`, `src/signal`, `src/imessage`, which do not exist.
- 9 extension directories have no manifest and cannot load: `alibaba`, `azure-speech`, `diagnostics-prometheus`, `document-extract`, `gradium`, `inworld`, `runway`, `senseaudio`, `test-support`.

---

## 13. Prioritized recommendations

### P0 — do before the next release claim

1. **Decide the sovereign layer's fate.** Either instantiate the microkernel in the real gateway (`src/gateway/server.impl.ts`, after `registerInfraServices()`) and route turns through it, or mark it explicitly as preview and remove the operational claims. Half-wired is worse than either.
2. **Make `main` typecheck-green and blocking.** Fix the clickclack/zod mismatch (pin one zod major), then require `tsgo` in the same gate as lint.
3. **Remove or finish the 11 hollow extensions.** Delete their manifests, or mark `enabledByDefault: false` and `status: "preview"`, and remove fake tools that report success (`tts`, `gemini-auth`, `qwen-auth`, `minimax-auth`).
4. **Delete the theater.** Replace the two-line `check-security.mjs` / `check-plugin-sdk-exports.mjs`, remove tautological tests, and stop counting facade files as parity coverage.
5. **Reconcile the public story.** One version (1.0.0), one status, corrected numbers (`<200 ms`, no 120 s workers, no nonce signing, z = 1.28), and delete fabricated file citations from the audit report.
6. **Fail closed on install and execution.** Block installation on critical scan findings unless explicitly overridden; remove model-triggered `ask: off` via `elevated`.

### P1 — next 4-6 weeks

7. Persist plugin lifecycle, add rollback to `update`, and consult the consent ledger inside `loader.ts` before import.
8. Validate `manifest.id` before any filesystem join in the CoreHub install route.
9. Give plugins real fault isolation (worker/child boundary) or attribute and contain unhandled rejections per plugin.
10. Either use the WAL (append turn/session events, add `fsync`, tolerant replay) or delete it; add a persisted hash-chained approval/exec audit journal.
11. Port the highest-value parity gaps: plugin-sdk tests (58), agent harness, reply-run registry, memory dreaming, Telegram spool, gateway RPC surfaces.
12. Add an MCP client so CoreBlow can consume external MCP servers.
13. Rebrand the catalogs and repair hints, fix `kimi`, generate the tier policy from bundled metadata, fix stale AGENTS paths.
14. Remove `@ts-nocheck` from 275 non-test files (start with `src/`).

### P2 — structural

15. Enforce the SDK API baseline in CI and delete `packages/plugin-sdk` subpaths that do not resolve.
16. Add SBOM + artifact signing, pin actions by SHA, make audit/lint blocking, add real secret scanning.
17. Split the 142 extension directories (124 currently bundled) into CoreHub packages per `docs/MICROKERNEL_HYBRID_UPGRADE_PRD.md`; keep the kernel at the 16 real core plugins.
18. Fix the parity generator's false-gap heuristics (`pi-hooks` -> `pi-extensions`, status/module consolidation) and regenerate the matrix against a real upstream commit.

---

## 14. Reproduce

```bash
corepack pnpm lint
corepack pnpm exec tsgo --noEmit
corepack pnpm check
corepack pnpm test -- src/runtime-lightweight-metrics.test.ts
corepack pnpm test -- src/agents/war-room/war-room.test.ts src/agents/pr-workflow/pr-workflow.test.ts \
  src/memory/knowledge-scribe.test.ts src/learning/skill-synthesizer.test.ts src/providers/decision-router.test.ts
node --import tsx scripts/check-no-monolithic-plugin-sdk-entry-imports.ts
rg -l "Facade = Record<string, unknown>" src extensions --glob '!*.test.ts'
rg -l 'expect\(".*"\)\.toContain\(' src extensions --glob '*.test.ts'
node -e "const m=require('./scripts/parity/openclaw-parity-matrix.json');console.log(m.summary)"
rg -n "MicrokernelRegistryService|CoryMemoryService|DecisionRouterService|WarRoomService" src
rg -n "ed25519|Ed25519" src/plugins/signature-verify.ts src/plugins/corehub.ts
```
