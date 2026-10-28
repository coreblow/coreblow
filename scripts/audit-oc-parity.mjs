#!/usr/bin/env node
/**
 * scripts/audit-oc-parity.mjs
 *
 * Ground-truth CB vs OC parity audit script.
 * Generates accurate comparison tanpa halusinasi.
 *
 * Usage:
 *   node scripts/audit-oc-parity.mjs
 *   node scripts/audit-oc-parity.mjs --json
 *   node scripts/audit-oc-parity.mjs --oc-root=/Users/febrinanda/openclaw-refs/openclaw
 *   node scripts/audit-oc-parity.mjs --domain-summary
 *   node scripts/audit-oc-parity.mjs --module src/tui
 *   node scripts/audit-oc-parity.mjs --tests-only
 *   node scripts/audit-oc-parity.mjs --include-live
 *
 * Architecture reference baseline
 */

import { readdirSync, existsSync, readFileSync } from "node:fs";
import { join, relative, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const CB_ROOT = join(__dirname, "..");

const args = process.argv.slice(2);
const JSON_OUTPUT = args.includes("--json");
const DOMAIN_SUMMARY_OUTPUT = args.includes("--domain-summary");
const TESTS_ONLY = args.includes("--tests-only");
const SKIP_LIVE = !args.includes("--include-live"); // skip live/e2e by default

const OC_ROOT = (() => {
  const flag = args.find((a) => a.startsWith("--oc-root="));
  if (flag) return flag.split("=").slice(1).join("=");
  return process.env.OC_ROOT || "/Users/febrinanda/openclaw-main";
})();

if (!existsSync(OC_ROOT)) {
  console.error(`OpenClaw reference root not found: ${OC_ROOT}`);
  process.exit(1);
}

// FIX: Only accept --module=X form to avoid positional arg bugs
const MODULE_FILTER = (() => {
  const flag = args.find((a) => a.startsWith("--module="));
  if (flag) return flag.split("=").slice(1).join("=");
  return undefined;
})();

// ─── helpers ────────────────────────────────────────────────────────────────

function walk(dir, filter = () => true) {
  if (!existsSync(dir)) return [];
  const results = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walk(fullPath, filter));
    } else if (entry.isFile() && filter(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

function relTo(root, fullPath) {
  return relative(root, fullPath);
}

function isSourceFile(name) {
  return (
    (name.endsWith(".ts") || name.endsWith(".tsx")) &&
    !name.endsWith(".d.ts")
  );
}

function isTestFile(name) {
  return name.endsWith(".test.ts") || name.endsWith(".test.tsx");
}

function extractExports(filePath) {
  if (!existsSync(filePath)) return [];
  const src = readFileSync(filePath, "utf8");
  const exports = [];
  const patterns = [
    /^export\s+(?:async\s+)?function\s+(\w+)/gm,
    /^export\s+const\s+(\w+)/gm,
    /^export\s+class\s+(\w+)/gm,
    /^export\s+type\s+(\w+)/gm,
    /^export\s+interface\s+(\w+)/gm,
    /^export\s+enum\s+(\w+)/gm,
  ];
  for (const pat of patterns) {
    let m;
    while ((m = pat.exec(src)) !== null) {
      exports.push(m[1]);
    }
  }
  return [...new Set(exports)];
}

function extractTestScenarios(filePath) {
  if (!existsSync(filePath)) return [];
  const src = readFileSync(filePath, "utf8");
  const scenarios = [];
  const itPattern = /\bit\s*\(\s*["'`]([^"'`]+)["'`]/g;
  let m;
  while ((m = itPattern.exec(src)) !== null) {
    scenarios.push(m[1]);
  }
  return scenarios;
}

const INTENTIONAL_TEST_SCENARIO_DIFFERENCES = new Map([
  [
    "src/gateway/auth.test.ts",
    new Map([
      [
        "resolves token/password from OPENCLAW gateway env vars",
        {
          status: "intentionally_different",
          rationale:
            "CoreBlow keeps public gateway auth env vars under COREBLOW_* branding.",
        },
      ],
      [
        "accepts password mode when env provides OPENCLAW_GATEWAY_PASSWORD",
        {
          status: "intentionally_different",
          rationale:
            "CoreBlow does not make OPENCLAW_GATEWAY_PASSWORD a canonical auth contract.",
        },
      ],
    ]),
  ],
  [
    "src/gateway/call.test.ts",
    new Map([
      [
        "uses OPENCLAW_GATEWAY_URL env override in remote mode when remote URL is missing",
        {
          status: "intentionally_different",
          rationale: "CoreBlow remote gateway discovery uses CoreBlow-branded env vars.",
        },
      ],
      [
        "uses env OPENCLAW_GATEWAY_URL when set",
        {
          status: "intentionally_different",
          rationale: "CoreBlow does not treat OPENCLAW_GATEWAY_URL as a primary public API.",
        },
      ],
      [
        "allows ws:// private remote URLs only when OPENCLAW_ALLOW_INSECURE_PRIVATE_WS=1",
        {
          status: "intentionally_different",
          rationale:
            "CoreBlow keeps insecure private WS opt-in under CoreBlow-branded configuration.",
        },
      ],
      [
        "allows ws:// hostname remote URLs when OPENCLAW_ALLOW_INSECURE_PRIVATE_WS=1",
        {
          status: "intentionally_different",
          rationale:
            "CoreBlow keeps insecure hostname WS opt-in under CoreBlow-branded configuration.",
        },
      ],
    ]),
  ],
  [
    "src/gateway/client.test.ts",
    new Map([
      [
        "allows ws:// to private addresses only with OPENCLAW_ALLOW_INSECURE_PRIVATE_WS=1",
        {
          status: "intentionally_different",
          rationale:
            "CoreBlow keeps insecure private WS opt-in under CoreBlow-branded configuration.",
        },
      ],
      [
        "allows ws:// hostnames with OPENCLAW_ALLOW_INSECURE_PRIVATE_WS=1",
        {
          status: "intentionally_different",
          rationale:
            "CoreBlow keeps insecure hostname WS opt-in under CoreBlow-branded configuration.",
        },
      ],
    ]),
  ],
  [
    "src/gateway/connection-auth.test.ts",
    new Map([
      [
        "resolves local SecretRef token when OPENCLAW env is absent",
        {
          status: "intentionally_different",
          rationale:
            "CoreBlow's fallback contract is validated against CoreBlow config/env naming.",
        },
      ],
      [
        "resolves config-first token SecretRef even when OPENCLAW env token exists",
        {
          status: "intentionally_different",
          rationale:
            "OpenClaw env precedence scenarios are not canonical CoreBlow auth behavior.",
        },
      ],
      [
        "resolves config-first password SecretRef even when OPENCLAW env password exists",
        {
          status: "intentionally_different",
          rationale:
            "OpenClaw env precedence scenarios are not canonical CoreBlow auth behavior.",
        },
      ],
    ]),
  ],
  [
    "src/gateway/embeddings-http.test.ts",
    new Map([
      [
        "rejects disallowed x-openclaw-model provider overrides",
        {
          status: "intentionally_different",
          rationale:
            "CoreBlow's OpenAI-compatible provider override header uses CoreBlow naming.",
        },
      ],
    ]),
  ],
  [
    "src/gateway/http-utils.request-context.test.ts",
    new Map([
      [
        "uses normalized x-openclaw-message-channel when enabled",
        {
          status: "intentionally_different",
          rationale: "CoreBlow request-context channel headers use CoreBlow naming.",
        },
      ],
    ]),
  ],
  [
    "src/gateway/models-http.test.ts",
    new Map([
      [
        "rejects requests with no declared operator scopes",
        {
          status: "intentionally_different",
          rationale:
            "CoreBlow intentionally keeps model-list bearer access on explicit least-privilege scopes.",
        },
      ],
    ]),
  ],
  [
    "src/gateway/openai-http.message-channel.test.ts",
    new Map([
      [
        "passes x-openclaw-message-channel through to agentCommand",
        {
          status: "intentionally_different",
          rationale:
            "CoreBlow preserves OpenAI-compatible message-channel behavior with CoreBlow header naming.",
        },
      ],
    ]),
  ],
]);

// Anti-bloat policy (docs/PRD.md & docs/ARCHITECTURE.md):
// Exclude obsolete legacy migration chains and deprecated upstream wrappers
// from parity gap counts.
const INTENTIONALLY_DEPRECATED_UPSTREAM_PATHS = new Set([
  // src/commands doctor legacy-config migration chains & obsolete helpers
  "src/commands/auth-choice-legacy.ts",
  "src/commands/auth-choice-legacy.test.ts",
  "src/commands/doctor-auth-legacy-oauth.ts",
  "src/commands/doctor-cron-dreaming-payload-migration.constants-drift.test.ts",
  "src/commands/doctor-cron-dreaming-payload-migration.test.ts",
  "src/commands/doctor-cron-dreaming-payload-migration.ts",
  "src/commands/doctor-cron-legacy-delivery.test.ts",
  "src/commands/doctor-cron-legacy-delivery.ts",
  "src/commands/doctor-cron-payload-migration.ts",
  "src/commands/doctor-cron-store-migration.test.ts",
  "src/commands/doctor-cron-store-migration.ts",
  "src/commands/doctor-legacy-config.migrations.test.ts",
  "src/commands/doctor-legacy-config.test.ts",
  "src/commands/doctor-legacy-config.ts",
  "src/commands/doctor-state-migrations.test.ts",
  "src/commands/doctor-state-migrations.ts",
  "src/commands/doctor.runs-legacy-state-migrations-yes-mode-without.e2e.test.ts",
  "src/commands/doctor/legacy-config-repair.ts",
  "src/commands/doctor/shared/allowfrom-fallback-migration.test.ts",
  "src/commands/doctor/shared/allowfrom-fallback-migration.ts",
  "src/commands/doctor/shared/channel-legacy-config-migrate.test.ts",
  "src/commands/doctor/shared/channel-legacy-config-migrate.ts",
  "src/commands/doctor/shared/legacy-config-compat.ts",
  "src/commands/doctor/shared/legacy-config-compatibility-base.ts",
  "src/commands/doctor/shared/legacy-config-core-migrate.ts",
  "src/commands/doctor/shared/legacy-config-core-normalizers.ts",
  "src/commands/doctor/shared/legacy-config-issues.ts",
  "src/commands/doctor/shared/legacy-config-migrate.provider-shapes.test.ts",
  "src/commands/doctor/shared/legacy-config-migrate.test.ts",
  "src/commands/doctor/shared/legacy-config-migrate.ts",
  "src/commands/doctor/shared/legacy-config-migrate.validation.test.ts",
  "src/commands/doctor/shared/legacy-config-migrations.audio.ts",
  "src/commands/doctor/shared/legacy-config-migrations.channels.ts",
  "src/commands/doctor/shared/legacy-config-migrations.queue.ts",
  "src/commands/doctor/shared/legacy-config-migrations.runtime.agents.ts",
  "src/commands/doctor/shared/legacy-config-migrations.runtime.diagnostics.ts",
  "src/commands/doctor/shared/legacy-config-migrations.runtime.gateway.ts",
  "src/commands/doctor/shared/legacy-config-migrations.runtime.mcp.ts",
  "src/commands/doctor/shared/legacy-config-migrations.runtime.providers.ts",
  "src/commands/doctor/shared/legacy-config-migrations.runtime.session.ts",
  "src/commands/doctor/shared/legacy-config-migrations.runtime.ts",
  "src/commands/doctor/shared/legacy-config-migrations.runtime.tts.ts",
  "src/commands/doctor/shared/legacy-config-migrations.ts",
  "src/commands/doctor/shared/legacy-config-migrations.web-search.ts",
  "src/commands/doctor/shared/legacy-config-record-shared.ts",
  "src/commands/doctor/shared/legacy-config-rules.ts",
  "src/commands/doctor/shared/legacy-config-write-ownership.test.ts",
  "src/commands/doctor/shared/legacy-models-add-metadata.test.ts",
  "src/commands/doctor/shared/legacy-models-add-metadata.ts",
  "src/commands/doctor/shared/legacy-talk-config-normalizer.ts",
  "src/commands/doctor/shared/legacy-tools-by-sender.test.ts",
  "src/commands/doctor/shared/legacy-tools-by-sender.ts",
  "src/commands/doctor/shared/legacy-web-fetch-migrate.test.ts",
  "src/commands/doctor/shared/legacy-web-fetch-migrate.ts",
  "src/commands/doctor/shared/legacy-web-search-migrate.test.ts",
  "src/commands/doctor/shared/legacy-web-search-migrate.ts",
  "src/commands/doctor/shared/legacy-x-search-migrate.test.ts",
  "src/commands/doctor/shared/legacy-x-search-migrate.ts",
  "src/commands/doctor/shared/plugin-registry-migration.test.ts",
  "src/commands/doctor/shared/plugin-registry-migration.ts",

  // src/plugins legacy OpenClaw marketplace & migration providers
  "src/plugins/clawhub.ts",
  "src/plugins/clawhub.test.ts",
  "src/plugins/migration-provider-runtime.ts",
  "src/plugins/migration-provider-runtime.test.ts",

  // src/agents legacy OpenClaw shims & marketplace
  "src/agents/skills-clawhub.ts",
  "src/agents/skills-clawhub.test.ts",
  "src/agents/openclaw-plugin-tools.ts",
  "src/agents/openclaw-plugin-tools.test.ts",
  "src/agents/test-helpers/fast-openclaw-tools-sessions.ts",
  "src/agents/test-helpers/fast-openclaw-tools.ts",
  "src/agents/test-helpers/fast-openclaw-tools.test.ts",
  "src/agents/openclaw-gateway-tool.test.ts",
  "src/agents/openclaw-tools.agents.test.ts",
  "src/agents/openclaw-tools.browser-plugin.integration.test.ts",
  "src/agents/openclaw-tools.camera.test.ts",
  "src/agents/openclaw-tools.image-generation.test.ts",
  "src/agents/openclaw-tools.owner-authorization.test.ts",
  "src/agents/openclaw-tools.pdf-registration.test.ts",
  "src/agents/openclaw-tools.plugin-context.test.ts",
  "src/agents/openclaw-tools.runtime.ts",
  "src/agents/openclaw-tools.session-status.test.ts",
  "src/agents/openclaw-tools.sessions-visibility.test.ts",
  "src/agents/openclaw-tools.sessions.test.ts",
  "src/agents/openclaw-tools.subagents.scope.test.ts",
  "src/agents/openclaw-tools.subagents.sessions-spawn-applies-thinking-default.test.ts",
  "src/agents/openclaw-tools.subagents.sessions-spawn-default-timeout-absent.test.ts",
  "src/agents/openclaw-tools.subagents.sessions-spawn-default-timeout.test.ts",
  "src/agents/openclaw-tools.subagents.sessions-spawn-depth-limits.test.ts",
  "src/agents/openclaw-tools.subagents.sessions-spawn.allowlist.test.ts",
  "src/agents/openclaw-tools.subagents.sessions-spawn.cron-note.test.ts",
  "src/agents/openclaw-tools.subagents.sessions-spawn.lifecycle.test.ts",
  "src/agents/openclaw-tools.subagents.sessions-spawn.model.test.ts",
  "src/agents/openclaw-tools.subagents.sessions-spawn.test-harness.ts",
  "src/agents/openclaw-tools.subagents.steer-failure-clears-suppression.test.ts",
  "src/agents/openclaw-tools.subagents.test-harness.ts",
  "src/agents/openclaw-tools.ts",
  "src/agents/openclaw-tools.web-runtime.test.ts",
  "src/agents/pi-tools.create-openclaw-coding-tools.adds-claude-style-aliases-schemas-without-dropping.test.ts",
  "src/agents/pi-tools.create-openclaw-coding-tools.adds-claude-style-aliases-schemas-without-dropping-b.test.ts",
  "src/agents/pi-tools.create-openclaw-coding-tools.adds-claude-style-aliases-schemas-without-dropping-d.test.ts",
  "src/agents/pi-tools.create-openclaw-coding-tools.adds-claude-style-aliases-schemas-without-dropping-f.test.ts",
  "src/agents/pi-tools.create-openclaw-coding-tools.adds-claude-style-aliases-schemas-without-dropping-s.test.ts",

  // src/gateway legacy dreaming migration repair shim
  "src/gateway/server-methods/doctor.memory-core-runtime.ts",
]);

function resolveIntentionalTestScenarioDifference(file, scenario) {
  return INTENTIONAL_TEST_SCENARIO_DIFFERENCES.get(file)?.get(scenario);
}

function domainFor(path) {
  const parts = path.split("/");
  if (parts[0] === "extensions") return `extensions/${parts[1]}`;
  if (parts[0] === "packages") return `packages/${parts[1]}`;
  return parts.slice(0, 2).join("/");
}

function addDomainCount(map, path) {
  const domain = domainFor(path);
  map.set(domain, (map.get(domain) || 0) + 1);
}

function countByDomain(paths) {
  const counts = new Map();
  for (const path of paths) addDomainCount(counts, path);
  return counts;
}

function countFor(map, domain) {
  return map.get(domain) || 0;
}

function domainStatus({ shared, missing, coreOnly }) {
  if (missing > 0 && shared > 0) return "partial";
  if (missing > 0 && shared === 0) return "missing";
  if (missing === 0 && shared > 0) return "done";
  if (missing === 0 && coreOnly > 0) return "intentionally_different";
  return "missing";
}

function domainPriority({ missingSource, missingTests }) {
  const totalGap = missingSource + missingTests;
  if (totalGap >= 200) return "P0";
  if (totalGap >= 80) return "P1";
  if (totalGap >= 20) return "P2";
  return "P3";
}

function buildDomainSummary(results) {
  const sharedSource = countByDomain(results.source.both);
  const coreOnlySource = countByDomain(results.source.cb_only);
  const missingSource = countByDomain(results.source.oc_only);
  const sharedTests = countByDomain(results.tests.both_have_test);
  const coreOnlyTests = countByDomain(results.tests.cb_has_test_oc_does_not);
  const missingTests = countByDomain(results.tests.oc_has_test_cb_does_not);
  const domains = [
    ...new Set([
      ...sharedSource.keys(),
      ...coreOnlySource.keys(),
      ...missingSource.keys(),
      ...sharedTests.keys(),
      ...coreOnlyTests.keys(),
      ...missingTests.keys(),
    ]),
  ].sort();

  return domains
    .map((domain) => {
      const counts = {
        shared_source: countFor(sharedSource, domain),
        coreblow_only_source: countFor(coreOnlySource, domain),
        openclaw_only_source: countFor(missingSource, domain),
        shared_tests: countFor(sharedTests, domain),
        coreblow_only_tests: countFor(coreOnlyTests, domain),
        openclaw_test_gaps: countFor(missingTests, domain),
      };
      return {
        domain,
        status: domainStatus({
          shared: counts.shared_source,
          missing: counts.openclaw_only_source,
          coreOnly: counts.coreblow_only_source,
        }),
        priority: domainPriority({
          missingSource: counts.openclaw_only_source,
          missingTests: counts.openclaw_test_gaps,
        }),
        counts,
      };
    })
    .sort((a, b) => {
      const order = { P0: 0, P1: 1, P2: 2, P3: 3 };
      const aGap = a.counts.openclaw_only_source + a.counts.openclaw_test_gaps;
      const bGap = b.counts.openclaw_only_source + b.counts.openclaw_test_gaps;
      return (
        order[a.priority] - order[b.priority] ||
        bGap - aGap ||
        a.domain.localeCompare(b.domain)
      );
    });
}

// ─── collect files ──────────────────────────────────────────────────────────

/**
 * Auto-discover all extension src directories from a repo root.
 * Scans extensions/*, packages/*, and root src/.
 * This ensures 100% coverage without hardcoding extension names.
 */
function discoverScanDirs(root) {
  const dirs = ["src"]; // always include root src/

  // Scan all extensions — include BOTH root-level .ts files and src/ subdir
  // when both exist (CB extensions often have root files + src/ OOP layer).
  const extRoot = join(root, "extensions");
  if (existsSync(extRoot)) {
    try {
      const entries = readdirSync(extRoot, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith(".")) continue;
        const extSrc = join("extensions", entry.name, "src");
        if (existsSync(join(root, extSrc))) {
          dirs.push(extSrc);
        }
        // Always also scan root-level .ts files in the extension dir
        const extDir = join("extensions", entry.name);
        const hasRootTs = existsSync(join(root, extDir)) &&
          readdirSync(join(root, extDir)).some(f => f.endsWith(".ts"));
        if (hasRootTs) dirs.push(extDir);
      }
    } catch { /* skip unreadable dirs */ }
  }

  // Scan packages/*/src
  const pkgRoot = join(root, "packages");
  if (existsSync(pkgRoot)) {
    try {
      const entries = readdirSync(pkgRoot, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
        const pkgSrc = join("packages", entry.name, "src");
        if (existsSync(join(root, pkgSrc))) dirs.push(pkgSrc);
      }
    } catch { /* skip */ }
  }

  return dirs;
}

// CB and OC may have different extension sets — use their own discovered dirs
const CB_SCAN_DIRS = discoverScanDirs(CB_ROOT);
const OC_SCAN_DIRS = discoverScanDirs(OC_ROOT);

function collectFiles(root, dirs) {
  const sourceFiles = new Map(); // relPath → fullPath
  const testFiles = new Map();

  for (const dir of dirs) {
    const fullDir = join(root, dir);
    if (!existsSync(fullDir)) continue;

    walk(fullDir, isSourceFile).forEach((fp) => {
      const rel = relTo(root, fp);
      if (isTestFile(basename(fp))) {
        testFiles.set(rel, fp);
      } else {
        sourceFiles.set(rel, fp);
      }
    });
  }
  return { sourceFiles, testFiles };
}

// ─── main audit ─────────────────────────────────────────────────────────────

const cbFiles = collectFiles(CB_ROOT, CB_SCAN_DIRS);
const ocFiles = collectFiles(OC_ROOT, OC_SCAN_DIRS);

// Apply module filter
function applyFilter(map) {
  if (!MODULE_FILTER) return map;
  return new Map([...map].filter(([k]) => k.startsWith(MODULE_FILTER)));
}

const cbSrc = applyFilter(cbFiles.sourceFiles);
const cbTest = applyFilter(cbFiles.testFiles);
const ocSrc = applyFilter(ocFiles.sourceFiles);
const ocTest = applyFilter(ocFiles.testFiles);

// ─── source file analysis ───────────────────────────────────────────────────

const results = {
  summary: {},
  source: {
    cb_only: [],      // in CB, not in OC (CB-exclusive features)
    oc_only: [],      // in OC, not in CB (missing from CB)
    both: [],         // in both (parity match)
  },
  tests: {
    cb_has_test_oc_does_not: [],  // CB has test, OC doesn't
    oc_has_test_cb_does_not: [],  // OC has test, CB doesn't → GAP
    both_have_test: [],            // both covered
    neither_covered: [],           // source exists in both, no test anywhere
    cb_test_only: [],              // only CB has source + test
  },
  exports: {
    gaps: [],  // functions in OC source not in CB source
  },
  test_scenarios: {
    gaps: [],  // OC test scenarios not in CB tests
    intentional_differences: [], // OC scenarios deliberately not ported as CoreBlow behavior
  },
  domain_summary: [],
};

// Source file comparison
const cbSrcKeys = new Set(cbSrc.keys());
const ocSrcKeys = new Set(ocSrc.keys());

if (!TESTS_ONLY) {
  for (const k of cbSrcKeys) {
    if (ocSrcKeys.has(k)) {
      results.source.both.push(k);
    } else {
      results.source.cb_only.push(k);
    }
  }
  for (const k of ocSrcKeys) {
    if (!cbSrcKeys.has(k)) {
      if (INTENTIONALLY_DEPRECATED_UPSTREAM_PATHS.has(k)) {
        results.source.intentionally_deprecated = results.source.intentionally_deprecated || [];
        results.source.intentionally_deprecated.push(k);
      } else {
        results.source.oc_only.push(k);
      }
    }
  }
}

// Test coverage analysis
const cbTestKeys = new Set(cbTest.keys());
const ocTestKeys = new Set(ocTest.keys());

// OC test files that don't exist in CB → gaps
function isLiveOrE2e(path) {
  return path.includes(".live.") || path.includes(".e2e.") ||
         path.includes(".contract.") || path.endsWith(".live.test.ts") ||
         path.endsWith(".e2e.test.ts");
}

for (const k of ocTestKeys) {
  if (SKIP_LIVE && isLiveOrE2e(k)) continue; // skip live/e2e tests
  if (cbTestKeys.has(k)) {
    results.tests.both_have_test.push(k);
  } else if (INTENTIONALLY_DEPRECATED_UPSTREAM_PATHS.has(k)) {
    results.tests.intentionally_deprecated = results.tests.intentionally_deprecated || [];
    results.tests.intentionally_deprecated.push(k);
  } else {
    results.tests.oc_has_test_cb_does_not.push(k);
  }
}

// CB test files not in OC (CB-exclusive or superset)
for (const k of cbTestKeys) {
  if (!ocTestKeys.has(k)) {
    results.tests.cb_has_test_oc_does_not.push(k);
  }
}

// Source exists in both but neither has test
if (!TESTS_ONLY) {
  for (const k of results.source.both) {
    const srcBase = k.replace(/\.tsx?$/, "");
    const cbHasTest = [...cbTestKeys].some((t) => t.startsWith(srcBase));
    const ocHasTest = [...ocTestKeys].some((t) => t.startsWith(srcBase));
    if (!cbHasTest && !ocHasTest) {
      results.tests.neither_covered.push(k);
    }
  }
}

// Export gap analysis (functions in OC not in CB) — scan all shared files
const EXPORT_GAP_LIMIT = 200; // increased from 100
for (const commonSrc of results.source.both.slice(0, EXPORT_GAP_LIMIT)) {
  const cbExports = extractExports(join(CB_ROOT, commonSrc));
  const ocExports = extractExports(join(OC_ROOT, commonSrc));
  const missing = ocExports.filter((e) => !cbExports.includes(e));
  if (missing.length > 0) {
    results.exports.gaps.push({ file: commonSrc, missing_in_cb: missing });
  }
}

// Test scenario gap analysis (OC test scenarios not in CB tests)
const SCENARIO_SAMPLE_LIMIT = 50;
let scenarioCount = 0;
for (const k of results.tests.both_have_test) {
  if (scenarioCount >= SCENARIO_SAMPLE_LIMIT) break;
  const cbScenarios = new Set(extractTestScenarios(join(CB_ROOT, k)));
  const ocScenarios = extractTestScenarios(join(OC_ROOT, k));
  const missingScenarios = [];
  const intentionalDifferences = [];
  for (const scenario of ocScenarios) {
    if (cbScenarios.has(scenario)) {
      continue;
    }
    const decision = resolveIntentionalTestScenarioDifference(k, scenario);
    if (decision) {
      intentionalDifferences.push({
        scenario,
        ...decision,
      });
      continue;
    }
    missingScenarios.push(scenario);
  }
  if (missingScenarios.length > 0) {
    results.test_scenarios.gaps.push({
      file: k,
      oc_scenarios_missing_in_cb: missingScenarios,
    });
  }
  if (intentionalDifferences.length > 0) {
    results.test_scenarios.intentional_differences.push({
      file: k,
      scenarios: intentionalDifferences,
    });
  }
  scenarioCount++;
}

// Summary
results.summary = {
  cb_source_files: cbSrcKeys.size,
  oc_source_files: ocSrcKeys.size,
  source_parity_both: results.source.both.length,
  source_cb_exclusive: results.source.cb_only.length,
  source_missing_from_cb: results.source.oc_only.length,
  source_intentionally_deprecated: results.source.intentionally_deprecated?.length ?? 0,
  test_files_cb: cbTestKeys.size,
  test_files_oc: ocTestKeys.size,
  tests_both_covered: results.tests.both_have_test.length,
  tests_gap_oc_has_cb_missing: results.tests.oc_has_test_cb_does_not.length,
  tests_intentionally_deprecated: results.tests.intentionally_deprecated?.length ?? 0,
  tests_cb_exclusive: results.tests.cb_has_test_oc_does_not.length,
  export_files_with_gaps: results.exports.gaps.length,
  test_scenario_files_with_gaps: results.test_scenarios.gaps.length,
  test_scenario_files_intentionally_different:
    results.test_scenarios.intentional_differences.length,
};

results.domain_summary = buildDomainSummary(results);

// ─── output ─────────────────────────────────────────────────────────────────

if (DOMAIN_SUMMARY_OUTPUT) {
  if (JSON_OUTPUT) {
    console.log(JSON.stringify({
      summary: results.summary,
      domain_summary: results.domain_summary,
    }, null, 2));
    process.exit(0);
  }

  console.log("CoreBlow / OpenClaw parity domain summary");
  console.log(`OpenClaw root: ${OC_ROOT}`);
  if (MODULE_FILTER) console.log(`Filter: ${MODULE_FILTER}`);
  console.log();
  console.log("priority status  oc_src oc_tests shared_src domain");
  console.log("-------- ------- ------ -------- ---------- ------");
  for (const row of results.domain_summary.slice(0, 40)) {
    const c = row.counts;
    console.log(
      `${row.priority.padEnd(8)} ${row.status.padEnd(7)} ` +
      `${String(c.openclaw_only_source).padStart(6)} ` +
      `${String(c.openclaw_test_gaps).padStart(8)} ` +
      `${String(c.shared_source).padStart(10)} ${row.domain}`,
    );
  }
  if (results.domain_summary.length > 40) {
    console.log(`... and ${results.domain_summary.length - 40} more domains`);
  }
  process.exit(0);
}

if (JSON_OUTPUT) {
  console.log(JSON.stringify(results, null, 2));
  process.exit(0);
}

// Human-readable output
console.log("╔══════════════════════════════════════════════════════════════╗");
console.log("║          CoreBlow — Architecture Parity Audit                 ║");
console.log("╚══════════════════════════════════════════════════════════════╝");
if (MODULE_FILTER) console.log(`  Filter: ${MODULE_FILTER}`);
console.log();

console.log("📊 SUMMARY");
console.log("─".repeat(60));
const s = results.summary;
console.log(`  CB source files     : ${s.cb_source_files}`);
console.log(`  OC source files     : ${s.oc_source_files}`);
console.log(`  Both repos (parity) : ${s.source_parity_both}`);
console.log(`  CB-exclusive (new)  : ${s.source_cb_exclusive}`);
console.log(`  Missing from CB ❌  : ${s.source_missing_from_cb}`);
console.log();
console.log(`  CB test files       : ${s.test_files_cb}`);
console.log(`  OC test files       : ${s.test_files_oc}`);
console.log(`  Both covered ✅     : ${s.tests_both_covered}`);
console.log(`  OC has, CB missing ❌: ${s.tests_gap_oc_has_cb_missing}`);
console.log(`  CB-exclusive tests  : ${s.tests_cb_exclusive}`);
console.log();

console.log("TOP DOMAIN GAPS");
console.log("─".repeat(60));
results.domain_summary
  .filter((row) => row.counts.openclaw_only_source > 0 || row.counts.openclaw_test_gaps > 0)
  .slice(0, 12)
  .forEach((row) => {
    const c = row.counts;
    console.log(
      `  ${row.priority} ${row.domain}: ${c.openclaw_only_source} source, ` +
      `${c.openclaw_test_gaps} tests missing (${row.status})`,
    );
  });
console.log();

if (results.source.oc_only.length > 0) {
  console.log("❌ SOURCE FILES MISSING FROM CB (OC has, CB doesn't):");
  console.log("─".repeat(60));
  results.source.oc_only.slice(0, 30).forEach((f) => console.log(`  - ${f}`));
  if (results.source.oc_only.length > 30)
    console.log(`  ... and ${results.source.oc_only.length - 30} more`);
  console.log();
}

if (results.tests.oc_has_test_cb_does_not.length > 0) {
  console.log("❌ TEST GAPS — OC has test, CB doesn't:");
  console.log("─".repeat(60));
  results.tests.oc_has_test_cb_does_not.slice(0, 30).forEach((f) =>
    console.log(`  - ${f}`)
  );
  if (results.tests.oc_has_test_cb_does_not.length > 30)
    console.log(
      `  ... and ${results.tests.oc_has_test_cb_does_not.length - 30} more`
    );
  console.log();
}

if (results.exports.gaps.length > 0) {
  console.log("⚠️  EXPORT GAPS — Functions in OC missing from CB:");
  console.log("─".repeat(60));
  results.exports.gaps.slice(0, 20).forEach(({ file, missing_in_cb }) => {
    console.log(`  ${file}:`);
    missing_in_cb.forEach((fn) => console.log(`    - ${fn}`));
  });
  console.log();
}

if (results.test_scenarios.gaps.length > 0) {
  console.log("⚠️  SCENARIO GAPS — OC test scenarios missing from CB tests:");
  console.log("─".repeat(60));
  results.test_scenarios.gaps.slice(0, 20).forEach(({ file, oc_scenarios_missing_in_cb }) => {
    console.log(`  ${file}:`);
    oc_scenarios_missing_in_cb.forEach((s) => console.log(`    - "${s}"`));
  });
  console.log();
}

if (results.test_scenarios.intentional_differences.length > 0) {
  console.log("ℹ️  SCENARIO DIFFERENCES — intentionally different:");
  console.log("─".repeat(60));
  results.test_scenarios.intentional_differences
    .slice(0, 20)
    .forEach(({ file, scenarios }) => {
      console.log(`  ${file}:`);
      scenarios.forEach((entry) => {
        console.log(`    - "${entry.scenario}" (${entry.status})`);
        console.log(`      ${entry.rationale}`);
      });
    });
  console.log();
}

console.log("✅ CB-EXCLUSIVE tests (CB has, OC doesn't — CB-original features):");
console.log("─".repeat(60));
results.tests.cb_has_test_oc_does_not.slice(0, 20).forEach((f) =>
  console.log(`  + ${f}`)
);
if (results.tests.cb_has_test_oc_does_not.length > 20)
  console.log(`  ... and ${results.tests.cb_has_test_oc_does_not.length - 20} more`);
console.log();

console.log("─".repeat(60));
console.log(
  `✅ Parity: ${s.source_parity_both} shared | ${s.source_cb_exclusive} CB-only | ${s.source_missing_from_cb} missing`
);
console.log(
  `✅ Tests:  ${s.tests_both_covered} covered | ${s.tests_gap_oc_has_cb_missing} gaps | ${s.tests_cb_exclusive} CB-exclusive`
);
console.log();
console.log("Run with --json for machine-readable output.");
console.log("Run with --module=src/tui to filter by module.");
console.log("Run with --tests-only to skip source file analysis.");
