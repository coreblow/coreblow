# CoreBlow 26-Repository Ecosystem Audit

**Date:** 2026-11-14
**Scope:** the 25 satellite repositories in the sibling `coreblow-split` checkout, cross-checked against the monorepo `coreblow` at `d969a57be`
**Method:** read-only inspection plus execution of each repository's own test command. No files were modified, no commits were made.

---

## 1. Executive verdict

The 26-repository ecosystem is **real as a structure and mostly hollow as a product**.

- All 25 satellite repositories exist, are git repositories with correct `coreblow/*` remotes, clean working trees, a CI workflow, a test suite, `SECURITY.md`, Dependabot, and CODEOWNERS. The scaffolding is consistent and deliberate.
- The code is not. **Three repositories hold 98.6% of all satellite source code** (`corehub` 23,856 LOC, `coreblow.com` 26,632, `docs` 16,125). The other **22 repositories contain 955 LOC combined**, about 40 lines each.
- Of the 25 satellites, **3 are substantive** (`corehub`, `docs`, `coreblow.com`), **2 are partial** (`trust`, `plugin-lab`), and **20 are placeholders** whose READMEs describe primitives while the ecosystem map describes finished products.

Stated plainly: the map says "25 specialized repositories"; the disk says "1 real registry, 1 real docs site, 1 real portal, and 22 well-formed skeletons". That is a reasonable way to start a federated ecosystem, but it is not the completed fleet the documentation claims.

---

## 2. Fleet scorecard

| # | Repository | Claimed role in the map | Real source | Verdict |
| :-: | :--- | :--- | ---: | :--- |
| 1 | `coreblow` (monorepo) | 12-service Agent-OS kernel | 851k non-test LOC | **Real, audited separately** (6/10 platform, 3/10 claimed autonomy) |
| 2 | `corehub` | App Store registry, Cloudflare Worker, D1, catalog | 23,856 LOC, 148 commits | **Real** — the strongest satellite |
| 3 | `docs` | Official documentation site | 799 md/mdx, 24 commits | **Real content, stale scope** |
| 4 | `coreblow.com` | Portal and universal installer | 26,632 LOC, 20 commits | **Real, version-mismatched** |
| 5 | `trust` | Trust authority, threat model, OWASP policies | 18 LOC + 2 threats | **Partial** |
| 6 | `plugin-lab` | Isolated plugin verification testbed | 135 LOC | **Partial / incompatible** |
| 7 | `homebrew-tap` | `brew install coreblow/tap/coreblow` | 47 LOC | **Broken** (2.0.0 artifact does not exist) |
| 8 | `nix-coreblow` | Deterministic Nix distribution | 64 LOC | **Placeholder** (wraps `npx`) |
| 9 | `nix-coreblow-tools` | Nix dev shells | 32 LOC | **Placeholder** |
| 10 | `coreblow-ansible` | Provisioning and host hardening | 0 LOC (YAML only) | **Placeholder** (set_fact + assert) |
| 11 | `corebar` | Native macOS menu bar app | 49 LOC Swift | **Placeholder** |
| 12 | `corechat` | Ultra-fast Go terminal client | 44 LOC Go | **Placeholder** (library functions) |
| 13 | `corekit` | Shared Go toolkit / JSON-RPC client | 39 LOC Go | **Placeholder** |
| 14 | `coredex` | Contact book and identity directory | 46 LOC Go | **Placeholder** |
| 15 | `coreblow-windows-node` | Windows Service, Event Log, DPAPI | 110 LOC C# | **Placeholder** (record type only) |
| 16 | `esp-coreblow-node` | ESP32 audio node firmware | 64 LOC C | **Placeholder** (JSON formatter) |
| 17 | `dolphin` | Resumable typed workflow shell | 61 LOC | **Placeholder** (validator) |
| 18 | `corebox` | Clean-room process isolation runner | 42 LOC | **Placeholder** (plan builder) |
| 19 | `corebench` | 1,000-turn benchmark harness | 22 LOC | **Placeholder** (score function) |
| 20 | `coreblow-rtt` | RTT / TTFT profiler | 36 LOC | **Placeholder** (summarizer) |
| 21 | `coregrit-reports` | Compliance and audit report store | 8 LOC + `index.json` | **Placeholder** |
| 22 | `corewatch` | GitHub issue/PR triage bot | 32 LOC | **Placeholder** (classifier only) |
| 23 | `corewatch-state` | Persistent bot state store | 9 LOC + `index.json` | **Placeholder** |
| 24 | `corepatch` | PR reviewer and patch landing tool | 50 LOC | **Placeholder** (plan only) |
| 25 | `community` | Governance, RFCs, incident playbook | 5 real docs | **Real docs, small** |
| 26 | `cookbook` | Recipes and multi-agent templates | 1 example | **Minimal** |

Source totals: 67,568 LOC across all satellites; `corehub` + `docs` + `coreblow.com` = 66,613 (98.6%); the other 22 = 955.

---

## 3. What is genuinely real

### 3.1 `corehub` — the one production-grade satellite

- 23,856 LOC across 46 JavaScript modules (src, scripts, test, ops), 148 commits, 10 test modules, 9 CI workflows, a long list of operational scripts (`smoke:*`, `validate:*`, `persistence:*`, `deploy:worker:*`).
- `catalog.json` holds 18 entries with capabilities, review state, publisher identity, `minCoreblowVersion`, and per-version artifact metadata.
- **18 of 18 artifact SHA-256 hashes match the files on disk.** No missing artifacts. This was verified by hashing every archive.
- Artifacts are real packages, not manifests: `discord` is 385 files / 396 KB, `qqbot` 150 files / 18 KB.
- Publisher trust uses **GitHub Actions OIDC with RSA-SHA256 JWT verification** (`src/api-server.mjs:6563` region), which is a genuine cryptographic supply-chain control.
- The monorepo client is a real counterpart: it maps `minCoreblowVersion` to `minGatewayVersion`, verifies `corehub.artifact.json`, checks archive SHA-256, and handles moderation/trust drift (`src/plugins/corehub.ts`, `src/infra/corehub.ts:812-908`).

**Caveat:** the ecosystem map claims "Ed25519 signature validation". There is **zero Ed25519 code in `corehub`**. The real mechanism is OIDC publisher verification plus SHA-256 artifact integrity, not per-artifact signatures. The catalog has no `signature` field.

### 3.2 `docs` — real documentation, wrong generation

- 799 Markdown/MDX files, 24 commits, a Mintlify-style `docs.json`, real navigation for install/CLI/providers/channels/security/plugins, 12 files covering CoreHub.
- **Zero files mention EvoLoop, Cory, microkernel, War Room, skill synthesis, or Knowledge Scribe.** The public docs describe the gateway product, not the v2.0 Agent-OS the monorepo advertises.
- It ships internal material publicly: 5 files in `docs/internal-plans/` (including an `openclaw-implementation-plan.md`) and 2 roadmap files, plus 4 files that still reference OpenClaw.

### 3.3 `coreblow.com` — real installer, wrong version story

- Real `public/install.sh`: validates Node 22.12+, runs `npm install -g coreblow@latest`, prints onboarding instructions.
- Real catalog sync: `scripts/sync-corehub-catalog.mjs` validates against the CoreHub schema and generates `src/corehub-catalog.generated.js` (347 KB), with a `--check` drift gate.
- **The banner says "v2.0.0 GA" while `npm view coreblow` shows `latest = 1.0.0-rc.11`.** There is no 2.0.0 on npm at all.

### 3.4 Partial: `trust`, `plugin-lab`, `community`

- `trust`: a real policy-shaped repository (`threats.json` + `security-response.md`) but only **2 generic threats** (`secret-exposure`, `unsafe-plugin`). It is not the OWASP Agentic AI policy authority the map describes.
- `plugin-lab`: real Node package with tests, but its validator requires `name`, `version`, and `entry` in a manifest. **The sampled real manifests fail it**:
  ```
  extensions/telegram/coreblow.plugin.json -> ["name is required","version must be semver-like","entry must point to a JavaScript file"]
  extensions/discord/coreblow.plugin.json  -> same
  extensions/memory-core/coreblow.plugin.json -> same
  ```
  So the "isolated verification testbed for third-party plugins" cannot validate any plugin the monorepo actually ships.
- `community`: 5 real documents (rules, roles, onboarding, incident playbook) plus a docs check. Small but honest.

---

## 4. The placeholders: claim vs code

Every one of these repos is a clean scaffold (README, CI, test, security policy). None implements the product described in the map.

| Repository | Map claim | What the code actually does |
| :--- | :--- | :--- |
| `corebar` | macOS menu bar app (Swift 6.2) | 20-line `CoreBarStatus` struct; no AppKit, no menu bar, no gateway client |
| `corechat` | Ultra-fast terminal chat client (Go 1.22+) | 29-line `NormalizeMessage`/`AppendMessage`; no CLI, no WebSocket |
| `corekit` | Shared JSON-RPC client and socket transport | 13-line endpoint normalizer and `IsLocal` |
| `coredex` | Contact book and identity directory | 20-line contact normalizer and search key |
| `coreblow-windows-node` | Windows Service, Event Log, DPAPI | 48-line record with hardcoded `Version: "2.0.0"`, `VoiceRtf: 0.18`; zero NuGet packages |
| `esp-coreblow-node` | ESP32 audio streaming firmware | 28-line `snprintf` heartbeat JSON; no Wi-Fi, I2S, or audio |
| `dolphin` | Resumable workflow engine with checkpoints | 32-line `WorkflowPlan.validate()`; no execution, no checkpoints |
| `corebox` | Clean-room process isolation runner | 24-line `createRunPlan()` returning command strings; no container, no isolation |
| `coreblow-ansible` | Automated provisioning and hardening | `set_fact` for a port, then `assert` it is a valid port; nothing is installed |
| `corebench` | 1,000-turn benchmark harness | 10-line weighted score function |
| `coreblow-rtt` | RTT and TTFT measurement | 15-line average of supplied samples; no network calls |
| `corewatch` | GitHub triage bot | 20-line label/age classifier; no GitHub API |
| `corewatch-state` | Persistent state store | an `index.json` file |
| `corepatch` | PR reviewer and patch landing | 24-line risk-to-gate mapping |
| `coregrit-reports` | Compliance report history | an `index.json` file |
| `homebrew-tap` | Working `brew install` | Formula points at npm `coreblow-2.0.0` (**404**); Cask points at an unverified `v2.0.0` DMG |
| `nix-coreblow` | Deterministic package | shell wrapper: `exec npx -y coreblow@latest`; `coreblow-studio` copies a `dist/CoreBlow.app` that does not exist |
| `nix-coreblow-tools` | Nix dev environment | a devShell with Node/pnpm/git |
| `cookbook` | Multi-agent recipes | one `hello-agent` example that echoes input |
| `trust` | OWASP Agentic AI policy authority | an 18-line JSON shape check and 2 threats |

The READMEs are more honest than the map: they say "primitives", "contracts", and list "out of scope" items. The map, `README.md` of the monorepo, and `docs/ARCHITECTURE.md` are where the overclaim happens.

---

## 5. Cross-repository consistency findings

### 5.1 The version story is broken in five places

| Source | Version |
| :--- | :--- |
| npm registry (`coreblow`) | `latest = 1.0.0-rc.11`; no stable 1.0.0, no 2.0.0 |
| monorepo `package.json` | `1.0.0` |
| monorepo docs / architecture | `2.0.0 GA` |
| `coreblow.com` installer banner | `v2.0.0 GA` (installs latest rc) |
| Homebrew Formula / Cask | `2.0.0` (npm 404 / release asset unverified) |
| Windows node tray string | `v2.0.0` |
| Nix Studio derivation | `2.0.0` |

A user following the documented install path gets an rc build while every surface calls it GA 2.0.0.

### 5.2 Two different CoreHub catalogs disagree

- Monorepo fallback catalog: **21 channel entries**, including three competitor-branded plugins (`@wecom/wecom-openclaw-plugin`, `openclaw-plugin-yuanbao`, `@tencent-weixin/openclaw-weixin`) and `googlechat`, `slack`, `whatsapp`.
- CoreHub registry catalog: **18 entries** (15 channels + `coreblow`, `corehub-directory`, `plugin-lab`), with no Slack/WhatsApp/Google Chat.
- The difference is partly justified (Slack/WhatsApp are core plugins), but the competitor-branded entries and the missing reconciliation mean the fallback and the registry are not the same store.

### 5.3 The plugin testbed rejects the product's own plugins

`plugin-lab` requires `name`/`version`/`entry`; the monorepo schema requires only `id` + `configSchema`. A third-party plugin that passes CoreBlow's real loader fails `plugin-lab`, and vice versa. There is no shared schema package despite `packages/plugin-package-contract` existing in the monorepo.

### 5.4 The public docs do not document the v2 features

`docs` has 799 files and zero mentions of the flagship subsystems. The only public narrative for EvoLoop, Cory, War Room, and the microkernel is inside the monorepo's `docs/` and `README.md`, which are not the docs site.

### 5.5 The fleet is frozen at scaffold time

- 18 of 25 satellites last changed on **2026-05-19** (the scaffold generation day). `docs` on 2026-05-21. Six repos were touched in November (corehub, coreblow.com, plugin-lab, windows-node, homebrew-tap, nix-coreblow).
- Commit counts: 4-7 for 22 repos; 148 for `corehub`; 24 for `docs`; 20 for `coreblow.com`.
- Six repos have **unpushed local commits**: `coreblow-windows-node` (+1), `coreblow.com` (+1), `corehub` (+1), `homebrew-tap` (+3), `nix-coreblow` (+1), `plugin-lab` (+1).
- Every one of the 22 scaffold repos has the same single CI workflow (`actions/checkout@v6`, `npm test` or equivalent), pinned by tag, with no cross-repo contract tests, no SBOM, no signing.

### 5.6 Tests pass, but they test the scaffold

All test commands were run:

- 12 Node satellites: **PASS** (`npm test`).
- 3 Go satellites: **PASS** (`go test ./...`).
- `corebar`: **PASS** (`swift test`, one 12-line test).
- `corehub`: **PASS** (10 test modules).
- `coreblow.com`: **PASS** (`npm run check`, catalog drift check).
- `coreblow-ansible`, `homebrew-tap`, `nix-*`, `esp-node`, `windows-node`: no runnable local gate (no dotnet/nix/IDF/Homebrew in this environment).

Green tests here prove the primitives work, not that the products exist.

---

## 6. What this means for the 26-repo claim

The ecosystem is **coherently designed and correctly scaffolded**, which is real work: naming, remotes, CI, security policy, licensing, and a consistent README template across 25 repositories. `corehub` in particular is a credible registry, and the monorepo client that consumes it is real.

But the map's language ("Ultra-fast Terminal Client", "Windows Service with DPAPI", "1,000-turn Benchmark Harness", "Clean-Room Process Isolation", "Automated Server Hardening", "Ed25519 signature validation", "26-repo fleet") describes finished products. On disk, 22 of 25 satellites are placeholders, and the one cryptographic claim in the map (Ed25519) is not implemented.

The honest description: **a real registry, a real docs site, a real portal, two partial policy repos, and 20 well-formed skeletons.**

---

## 7. Prioritized recommendations

### P0 — stop the version and contract drift

1. **Pick one version truth.** Either publish `1.0.0` stable (current npm is `1.0.0-rc.11`) or cut `2.0.0`; then update `coreblow.com`, Homebrew Formula/Cask, Windows node, Nix, and the monorepo docs in one pass. Right now every install surface lies.
2. **Fix Homebrew.** The Formula points at npm `coreblow-2.0.0.tgz` (404) and the Cask points at a `v2.0.0` DMG whose release asset is unverified. Publish the version or pin both to the real release and checksum.
3. **Fix `plugin-lab` or delete it.** Adopt `packages/plugin-package-contract` (or the monorepo manifest schema) as the single validator and add a cross-repo contract test that runs it against real `extensions/*/coreblow.plugin.json`.
4. **Reconcile the two catalogs.** Make `corehub/catalog.json` the single source; regenerate the monorepo fallback from it; remove the three OpenClaw-branded entries.
5. **Correct the Ed25519 claim** in `docs/ECOSYSTEM_MAP.md` to "GitHub OIDC publisher verification + SHA-256 artifact integrity", or implement artifact signing.

### P1 — decide what each satellite is

6. **Label the 20 scaffolds as not implemented.** Add a `status: preview` (or "planned") field to each README and to the ecosystem map; do not describe them as shipping products.
7. **Prioritize the two clients that users would actually touch**: `corechat` (needs a real gateway WebSocket/JSON-RPC client) and `corebar` (needs AppKit + gateway health). Both are currently ~30 lines.
8. **Unpushed commits**: push the six repos or document why they are local.
9. **Remove internal plans and competitor-named files from the public `docs` repo**; add the v2 feature docs (or stop advertising them publicly).
10. **Add a cross-repo CI gate** that checks: version consistency, catalog sync, manifest-contract compatibility, and no personal absolute paths in published repos.

### P2 — build the fleet for real

11. Implement `trust` as an OWASP Agentic AI policy set that the monorepo's `security` commands actually consume.
12. Implement `corebench` / `coreblow-rtt` against the real gateway (not pure functions), so the performance claims become measurable.
13. Implement `corebox` / `dolphin` as real execution engines (container/checkpoint), or remove them from the architecture.
14. Replace `nix-coreblow`'s `npx` wrapper with a pinned derivation, and `coreblow-ansible`'s assert-only role with a real install/hardening playbook.
15. Add SBOM, signed releases, and SHA-pinned actions across the fleet.

---

## 8. Reproduction

```bash
# inventory
ls coreblow-split
for d in coreblow-split/*/; do git -C "$d" log -1 --date=short --pretty='%h %ad %s'; done

# source size share
find coreblow-split/corehub -name '*.mjs' -o -name '*.js' | xargs wc -l
find coreblow-split/corebox/src -type f | xargs wc -l

# run the fleet gates
for d in coreblow-split/{community,cookbook,corebench,coreblow-rtt,corebox,coregrit-reports,corepatch,corewatch,corewatch-state,dolphin,plugin-lab,trust}; do (cd "$d" && npm test); done
for d in coreblow-split/{corechat,corekit,coredex}; do (cd "$d" && go test ./...); done
(cd coreblow-split/corebar && swift test)
(cd coreblow-split/corehub && node test/run-tests.mjs)
(cd coreblow-split/coreblow.com && npm run check)

# artifact integrity
cd coreblow-split/corehub && node -e '
const fs=require("fs"),crypto=require("crypto");
const c=require("./catalog.json"); let ok=0,bad=0;
for(const e of c) for(const v of e.versions||[]) {
  const a=v.artifact; if(!a?.name) continue;
  const h=crypto.createHash("sha256").update(fs.readFileSync("artifacts/"+a.name)).digest("hex");
  if(h===a.sha256) ok++; else bad++;
}
console.log({ok,bad});'

# validator incompatibility
cd coreblow-split/plugin-lab && node --input-type=module -e '
import {validatePluginManifest} from "./src/manifest.mjs";
import fs from "node:fs";
console.log(validatePluginManifest(JSON.parse(fs.readFileSync("../../coreblow/extensions/telegram/coreblow.plugin.json","utf8"))));'

# version truth
npm view coreblow dist-tags
npm view coreblow@2.0.0 version
```
