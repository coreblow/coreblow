# Repository Guidelines

- Repo: https://github.com/coreblow/coreblow
- In chat replies, file references must be repo-root relative only (example: `extensions/bluebubbles/src/channel.ts:80`); never absolute paths or `~/...`.
- Do not edit files covered by security-focused `CODEOWNERS` rules unless a listed owner explicitly asked for the change or is already reviewing it with you. Treat those paths as restricted surfaces, not drive-by cleanup.

## Project Structure & Module Organization

- Source code: `src/` (CLI wiring in `src/cli`, commands in `src/commands`, web provider in `src/provider-web.ts`, infra in `src/infra`, media pipeline in `src/media`).
- Tests: colocated `*.test.ts`.
- Docs: `docs/` (images, queue, configuration). Built output lives in `dist/`.
- Nomenclature: use "plugin" / "plugins" in docs, UI, changelogs, and contributor guidance. `extensions/*` remains the internal directory/package path to avoid repo-wide churn from a rename.
- Bundled plugin naming: for repo-owned workspace plugins, keep the canonical plugin id aligned across `coreblow.plugin.json:id`, `extensions/<id>` by default, and package names anchored to the same id (`@coreblow/<id>` or approved suffix forms like `-provider`, `-plugin`, `-speech`, `-sandbox`, `-media-understanding`). Keep `coreblow.install.npmSpec` equal to the package name and `coreblow.channel.id` equal to the plugin id when present. Exceptions must be explicit and covered by the repo invariant test.
- Plugins: live under `extensions/*` (workspace packages). Keep plugin-only deps in the extension `package.json`; do not add them to the root `package.json` unless core uses them.
- Plugins: install runs `npm install --omit=dev` in plugin dir; runtime deps must live in `dependencies`. Avoid `workspace:*` in `dependencies` (npm install breaks); put `coreblow` in `devDependencies` or `peerDependencies` instead (runtime resolves `coreblow/plugin-sdk` via jiti alias).
- Import boundaries: extension production code should treat `coreblow/plugin-sdk/*` plus local `api.ts` / `runtime-api.ts` barrels as the public surface. Do not import core `src/**`, `src/plugin-sdk-internal/**`, or another extension's `src/**` directly.
- Installers served from `https://coreblow.com/*`: live in the sibling repo `../coreblow.com` (`public/install.sh`, `public/install-cli.sh`, `public/install.ps1`).
- Messaging channels: always consider **all** built-in + extension channels when refactoring shared logic (routing, allowlists, pairing, command gating, onboarding, docs).
  - Core channel docs: `docs/channels/`
  - Core channel code: `src/telegram`, `src/discord`, `src/slack`, `src/signal`, `src/imessage`, `src/web` (WhatsApp web), `src/channels`, `src/routing`
  - Extensions (channel plugins): `extensions/*` (e.g. `extensions/msteams`, `extensions/matrix`, `extensions/zalo`, `extensions/zalouser`, `extensions/voice-call`)
- When adding channels/extensions/apps/docs, update `.github/labeler.yml` and create matching GitHub labels (use existing channel/extension label colors).

## Docs Linking

- Docs are hosted at docs.coreblow.com.
- Internal doc links in `docs/**/*.md`: root-relative, no `.md`/`.mdx` (example: `[Config](/configuration)`).
- For docs, UI copy, and picker lists, order services/providers alphabetically unless the section is explicitly describing runtime behavior (for example auto-detection or execution order).
- Section cross-references: use anchors on root-relative paths (example: `[Hooks](/configuration#hooks)`).
- Doc headings and anchors: avoid em dashes and apostrophes in headings because they break anchor links.
- When the user asks for links, reply with full `https://docs.coreblow.com/...` URLs (not root-relative).
- When you touch docs, end the reply with the `https://docs.coreblow.com/...` URLs you referenced.
- README (GitHub): keep absolute docs URLs (`https://docs.coreblow.com/...`) so links work on GitHub.
- Docs content must be generic: no personal device names/hostnames/paths; use placeholders like `user@gateway-host` and "gateway host".

## Build, Test, and Development Commands

- Runtime baseline: Node **22+** (keep Node + Bun paths working).
- Install deps: `pnpm install`
- If deps are missing (for example `node_modules` missing, `vitest not found`, or `command not found`), run the repo's package-manager install command (prefer lockfile/README-defined PM), then rerun the exact requested command once.
- Pre-commit hooks: `prek install`. The hook runs the repo verification flow, including `pnpm check`.
- `FAST_COMMIT=1` skips the repo-wide `pnpm format` and `pnpm check` inside the pre-commit hook only.
- Also supported: `bun install` (keep `pnpm-lock.yaml` + Bun patching in sync when touching deps/patches).
- Prefer Bun for TypeScript execution (scripts, dev, tests): `bun <file.ts>` / `bunx <tool>`.
- Run CLI in dev: `pnpm coreblow ...` (bun) or `pnpm dev`.
- Node remains supported for running built output (`dist/*`) and production installs.
- Mac packaging (dev): `scripts/package-mac-app.sh` defaults to current arch.
- Type-check/build: `pnpm build`
- TypeScript checks: `pnpm tsgo`
- Lint/format: `pnpm check`
- Format check: `pnpm format` (oxfmt --check)
- Format fix: `pnpm format:fix` (oxfmt --write)
- Terminology:
  - "gate" means a verification command or command set that must be green for the decision you are making.
  - A local dev gate is the fast default loop, usually `pnpm check` plus any scoped test you actually need.
  - A landing gate is the broader bar before pushing `main`, usually `pnpm check`, `pnpm test`, and `pnpm build` when the touched surface can affect build output, packaging, lazy-loading/module boundaries, or published surfaces.
  - A CI gate is whatever the relevant workflow enforces for that lane.
- Hard gate: if the change can affect build output, packaging, lazy-loading/module boundaries, or published surfaces, `pnpm build` MUST be run and MUST pass before pushing `main`.
- Tests: `pnpm test` (vitest); coverage: `pnpm test:coverage`
- Changelog: user-facing changes only; no internal/meta notes (version alignment, appcast reminders, release process).
- Changelog placement: in the active version block, append new entries to the end of the target section (`### Changes` or `### Fixes`); do not insert new entries at the top of a section.

## Coding Style & Naming Conventions

- Language: TypeScript (ESM). Prefer strict typing; avoid `any`.
- Formatting/linting via Oxlint and Oxfmt.
- Never add `@ts-nocheck` and do not add inline lint suppressions by default. Fix root causes first.
- Do not disable `no-explicit-any`; prefer real types, `unknown`, or a narrow adapter/helper instead.
- Dynamic import guardrail: do not mix `await import("x")` and static `import ... from "x"` for the same module in production code paths. If you need lazy loading, create a dedicated `*.runtime.ts` boundary.
- Extension SDK self-import guardrail: inside an extension package, do not import that same extension via `coreblow/plugin-sdk/<extension>` from production files. Route internal imports through a local barrel such as `./api.ts` or `./runtime-api.ts`.
- Never share class behavior via prototype mutation. Use explicit inheritance/composition.
- Add brief code comments for tricky or non-obvious logic.
- Keep files concise; extract helpers instead of "V2" copies. Aim to keep files under ~700 LOC; split/refactor when it improves clarity or testability.
- Naming: use **CoreBlow** for product/app/docs headings; use `coreblow` for CLI command, package/binary, paths, and config keys.
- Written English: use American spelling and grammar in code, comments, docs, and UI strings.

## Testing Guidelines

- Framework: Vitest with V8 coverage thresholds (70% lines/branches/functions/statements).
- Naming: match source names with `*.test.ts`; e2e in `*.e2e.test.ts`.
- Run `pnpm test` (or `pnpm test:coverage`) before pushing when you touch logic.
- Write tests to clean up timers, env, globals, mocks, sockets, temp dirs, and module state so `--isolate=false` stays green.
- For targeted/local debugging, keep using the wrapper: `pnpm test -- <path-or-filter> [vitest args...]`.
- Keep Vitest on `forks` only. Do not introduce or reintroduce any non-`forks` Vitest pool or alternate execution mode.
- Scoped tests prove the change itself. `pnpm test` remains the default `main` landing bar.
- Mobile: before using a simulator, check for connected real devices (iOS + Android) and prefer them when available.

## Commit & Pull Request Guidelines

- Create commits with `scripts/committer "<msg>" <file...>`; avoid manual `git add`/`git commit` so staging stays scoped.
- Follow concise, action-oriented commit messages (e.g., `CLI: add verbose flag to send`).
- Group related changes; avoid bundling unrelated refactors.
- PR submission template (canonical): `.github/pull_request_template.md`
- Issue submission templates (canonical): `.github/ISSUE_TEMPLATE/`

## Git Notes

- Agents MUST NOT create or push merge commits on `main`. If `main` has advanced, rebase local commits onto the latest `origin/main` before pushing.
- Bulk PR close/reopen safety: if a close action would affect more than 5 PRs, first ask for explicit user confirmation.

## Security & Configuration Tips

- Web provider stores creds at `~/.coreblow/credentials/`; rerun `coreblow login` if logged out.
- Sessions live under `~/.coreblow/sessions/` by default.
- Never commit or publish real phone numbers, videos, or live configuration values. Use obviously fake placeholders.
- Release guardrails: do not change version numbers without operator's explicit consent; always ask permission before running any npm publish/release step.

## Local Runtime / Platform Notes

- Use `coreblow doctor` for rebrand/migration issues or legacy config/service warnings.
- Never edit `node_modules`. Updates overwrite. Skill notes go in `tools.md` or `AGENTS.md`.
- SwiftUI state management (iOS/macOS): prefer the `Observation` framework (`@Observable`, `@Bindable`) over `ObservableObject`/`@StateObject`; don't introduce new `ObservableObject` unless required for compatibility.
- Connection providers: when adding a new connection, update every UI surface and docs (macOS app, web UI, mobile if applicable, onboarding/overview docs).
- Version locations: `package.json` (CLI), `apps/android/app/build.gradle.kts` (versionName/versionCode), `apps/ios/Sources/Info.plist` + `apps/ios/Tests/Info.plist`, `apps/macos/Sources/CoreBlow/Resources/Info.plist`.
- "Bump version everywhere" means all version locations above **except** `appcast.xml` (only touch appcast when cutting a new macOS Sparkle release).
- **Restart apps:** "restart iOS/Android apps" means rebuild (recompile/install) and relaunch, not just kill/launch.
- **Device checks:** before testing, verify connected real devices (iOS/Android) before reaching for simulators/emulators.
- When adding a new `AGENTS.md` anywhere in the repo, also add a `CLAUDE.md` symlink pointing to it (example: `ln -s AGENTS.md CLAUDE.md`).

## Collaboration / Safety Notes

- When working on a GitHub Issue or PR, print the full URL at the end of the task.
- When answering questions, respond with high-confidence answers only: verify in code; do not guess.
- Never update the Carbon dependency.
- Any dependency with `pnpm.patchedDependencies` must use an exact version (no `^`/`~`).
- Patching dependencies (pnpm patches, overrides, or vendored changes) requires explicit approval.
- **Multi-agent safety:** do **not** create/apply/drop `git stash` entries unless explicitly requested.
- **Multi-agent safety:** when the user says "push", you may `git pull --rebase` to integrate latest changes (never discard other agents' work). When the user says "commit", scope to your changes only.
- **Multi-agent safety:** prefer grouped `commit` / `pull --rebase` / `push` cycles for related work instead of many tiny syncs.
- **Multi-agent safety:** do **not** create/remove/modify `git worktree` checkouts unless explicitly requested.
- **Multi-agent safety:** do **not** switch branches / check out a different branch unless explicitly requested.
- Never send streaming/partial replies to external messaging surfaces (WhatsApp, Telegram); only final replies should be delivered there.
- Release guardrails: do not change version numbers without operator's explicit consent; always ask permission before running any npm publish/release step.
- Beta release guardrail: when using a beta Git tag, publish npm with a matching beta version suffix rather than a plain version on `--tag beta`.
