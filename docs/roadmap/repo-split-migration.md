# CoreBlow Repository Split Migration

CoreBlow is moving from a single large monorepo toward an OpenClaw-style ecosystem split. The goal is not to copy OpenClaw code or branding. The goal is to adopt the proven repository boundaries while keeping CoreBlow's Enterprise OOP architecture, CoreBlow naming, and self-host/open-source release model.

This migration intentionally pauses the final `1.0.0` release. The next milestone is a cleaner repository topology with independent CI and security gates.

## Reference Snapshot

OpenClaw reference snapshots are stored outside this repository:

- `/Users/febrinanda/openclaw-refs`

They were downloaded as GitHub archive snapshots, not cloned worktrees. Use them only to study structure, workflow boundaries, packaging patterns, and public API seams.

Priority reference repos:

| Area | OpenClaw reference | CoreBlow target |
|---|---|---|
| Core runtime | `openclaw` | `coreblow/coreblow` |
| Skill/plugin directory | `clawhub` | `coreblow/corehub` or `coreblow/pluginhub` |
| Docs | `docs` | `coreblow/docs` |
| Website | `openclaw.ai` | `coreblow/coreblow.com` |
| ACP client | `acpx` | `coreblow/acpx` or keep as plugin until stable |
| MCP API wrapper | `mcporter` | `coreblow/mcporter` equivalent if needed |
| Workflow shell | `lobster` | `coreblow/workflow-shell` candidate |
| Channel CLI | `wacli`, `discrawl`, `slacrawl`, `telecrawl`, `imsg` | channel-specific CoreBlow repos |
| Platform node | `openclaw-windows-node`, `clawgo`, `esp-openclaw-node` | CoreBlow platform node repos |
| Packaging | `homebrew-tap`, `nix-openclaw`, `openclaw-ansible` | CoreBlow distribution repos |
| QA and compatibility | `clawbench`, `openclaw-rtt`, `plugin-inspector`, `kitchen-sink` | CoreBlow QA/plugin compatibility repos |

## Target Shape

Core repository remains focused:

- CLI entrypoints and command registry
- Gateway HTTP/WS server and service registry
- Agent runtime and OOP orchestration
- Public plugin SDK and compatibility contracts
- Core config, security policy, install smoke, and release workflows
- A small set of bundled plugins required for a first-run experience

Ecosystem repositories carry the surfaces that do not need to block core release:

- Documentation and website
- Plugin directory and compatibility fixtures
- Channel tools and provider integrations
- Platform node implementations
- Packaging, deployment, and benchmark infrastructure

## Phase 0: Stabilize Gates

Status: in progress.

Actions:

- Keep main CodeQL focused on OpenClaw-style security boundaries instead of one broad TypeScript scan.
- Run main CodeQL as a `Security High` matrix with independent categories: core auth and secrets, gateway runtime, channel runtime, network and SSRF, MCP and process tools, plugin trust, and GitHub Actions.
- Disable default CodeQL query packs in the main workflow and run only high or very-high precision security findings from `security-extended`.
- Do not install package dependencies or run autobuild in the main CodeQL workflow.
- Move `src/agents` into `CodeQL Agents`, a manual workflow and future ownership boundary.
- Move the rest of `src` into `CodeQL Source Ecosystem`, a manual workflow.
- Move `extensions` CodeQL to `CodeQL Extensions`, a manual workflow.
- Keep core release gates strict: lint/type, build, unit, gateway, Android, Docker, install smoke, security, and core CodeQL.
- Do not publish final `1.0.0` until split foundations and green gates are confirmed.

Done criteria:

- `CodeQL` completes as small security-boundary jobs without scanning all extensions or the entire source ecosystem.
- `CodeQL Source Ecosystem` exists as a separate workflow for migration monitoring.
- `CodeQL Extensions` exists as a separate workflow for migration monitoring.
- Main branch CI no longer treats extension or broad quality analysis as a core release blocker.

### Immediate cut decision

The first cut is intentionally operational, not cosmetic:

- `CodeQL` protects critical security boundaries only.
- `CodeQL Agents` protects agent runtime code while agent ownership is evaluated as a possible split boundary.
- `CodeQL Source Ecosystem` protects non-release-core `src` directories while they are evaluated for extraction, consolidation, or deletion.
- `CodeQL Extensions` protects plugins and providers while they are migrated toward `coreblow/plugins` or standalone repositories.

This mirrors OpenClaw's ecosystem approach: critical security checks stay bounded and category-owned, while satellite surfaces keep their own validation lanes.

## Phase 1: Split Docs and Website

Target repos:

- `coreblow/docs`
- `coreblow/coreblow.com`

Move candidates:

- `docs/**`
- localized docs
- docs build/deploy workflow
- website/install content that belongs to the public site

Current cut:

- Core runtime workflows ignore `docs/**` so documentation-only edits do not run build, Bun, install smoke, lint/type, parity, security, smoke, unit, or workflow sanity gates.
- `.github/workflows/docs.yml` owns README and docs link checks until `coreblow/docs` becomes the canonical docs repo.

Core repo keeps:

- `README.md`
- `CHANGELOG.md`
- small contributor and security docs
- links to docs.coreblow.com

Done criteria:

- Docs build passes in docs repo.
- Core repo README links use `https://docs.coreblow.com/...`.
- Core release no longer runs docs-only checks.

## Phase 2: Split Plugin Directory

Target repo:

- `coreblow/corehub` or `coreblow/pluginhub`

Move candidates:

- plugin registry metadata
- plugin discovery docs
- compatibility summaries
- plugin marketplace UI or index generation

Core repo keeps:

- `src/plugin-sdk`
- `src/plugins`
- plugin loader and hook runner
- SDK contract tests

Done criteria:

- Plugin directory can update independently from core runtime.
- Core package still installs bundled plugins needed for first-run.
- Plugin index generation does not require core release.

## Phase 3: Split Extensions

Initial target repo:

- `coreblow/plugins`

Do not create 101 repos immediately. Start with one plugin monorepo, then promote large plugins into standalone repos only when they justify separate ownership.

Split order:

1. Channel plugins: Discord, Slack, Telegram, WhatsApp, Signal, iMessage, Matrix, Teams, Zalo, Line.
2. Provider plugins: OpenAI, Anthropic, Ollama, OpenRouter, Mistral, Groq, and related providers.
3. Heavy capability plugins: browser, memory, media, voice, phone-control.
4. Test and fixture plugins: synthetic, test-utils, kitchen-sink style fixtures.

Core repo keeps:

- public SDK
- extension loader contracts
- bundled minimal plugins
- integration tests that verify externally installed plugins can load

Done criteria:

- `extensions` is no longer the primary home for most plugins.
- Core CI does not install or analyze every plugin by default.
- Plugin CI owns provider/channel-specific gates.

Current cut:

- `.github/workflows/extensions-ci.yml` owns extension boundary checks and sharded extension tests for `extensions/**`, `src/plugin-sdk/**`, and `src/plugins/**`.
- Core build/typecheck still includes `extensions/**/*` because `tsconfig.json` and `tsconfig.build.json` currently include extension sources. Removing that dependency is a later extraction step, not a safe first cut.
- Extension tests are sharded with `COREBLOW_TEST_SHARDS=3` so the plugin lane can grow independently from core runtime CI.

## Phase 4: Split Platform Nodes

Target repos:

- `coreblow/android-node`
- `coreblow/apple-node` or separate `coreblow/ios-node` and `coreblow/macos-node`
- `coreblow/windows-node`
- optional `coreblow/go-node`

Current note:

Android was recently repaired by aligning its source shape with the OpenClaw Android reference. Do not move it until the repaired Android CI has stayed green across the split foundation work.

Done criteria:

- Platform node repos have independent build/test workflows.
- Core repo exposes stable protocol contracts.
- Core release does not rebuild every platform app.

## Phase 5: Split Packaging and Deploy

Target repos:

- `coreblow/homebrew-tap`
- `coreblow/nix-coreblow`
- `coreblow/coreblow-ansible`
- optional `coreblow/installers`

Move candidates:

- Homebrew formulas
- Nix flakes
- Ansible hardening playbooks
- production deployment examples
- installer smoke workflows

Done criteria:

- Package manager updates can land independently after a core tag.
- Installers consume published artifacts instead of building core from source.

## Phase 6: Split QA and Compatibility

Target repos:

- `coreblow/bench`
- `coreblow/rtt`
- `coreblow/plugin-inspector`
- `coreblow/plugin-fixtures`

Move candidates:

- release timing measurements
- benchmark harnesses
- plugin compatibility scanners
- kitchen-sink plugin fixtures

Done criteria:

- QA repositories consume released or candidate artifacts.
- Core CI keeps only the gates needed to protect core behavior.

## Migration Rules

- Use CoreBlow branding everywhere.
- Preserve CoreBlow OOP boundaries; do not import OpenClaw procedural internals directly.
- Keep compatibility aliases only when they are runtime contracts.
- Split by ownership and release cadence, not by directory aesthetics alone.
- Each extracted repo must have its own README, license, CI, package metadata, and security posture before it becomes canonical.
- Keep migration reversible until the new repo has passed at least one green CI cycle.

## First Execution Batch

1. Finish core vs extensions CodeQL separation.
2. Create `coreblow/docs` and migrate docs/site build.
3. Create `coreblow/plugins` and move non-bundled extensions in batches.
4. Update core plugin loader docs to describe external plugin installation.
5. Reduce core repo CI to core gates plus a small external-plugin smoke.

Final `1.0.0` should resume only after the split foundation is stable and the core release gate is green without scanning the entire ecosystem.
