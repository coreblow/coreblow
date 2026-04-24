#!/usr/bin/env node
/**
 * scripts/port-oc-tests.mjs
 *
 * Ports OC test files to CB with full behavioral logic + CoreBlow branding.
 * Reads the OC test, applies branding replacements, validates imports,
 * and writes the ported test to CB (overwriting existing stubs).
 *
 * Usage:
 *   node scripts/port-oc-tests.mjs --module=src/cron
 *   node scripts/port-oc-tests.mjs --module=src/agents --max-loc=200
 *   node scripts/port-oc-tests.mjs --file=src/cron/service.armtimer-tight-loop.test.ts
 *   node scripts/port-oc-tests.mjs --module=src/gateway --dry-run
 *   node scripts/port-oc-tests.mjs --module=src/cron --validate
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const CB_ROOT = join(__dirname, "..");
const OC_ROOT = "/Users/febrinanda/openclaw-main";

// ─── CLI args ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const VALIDATE = args.includes("--validate");
const MODULE_FILTER = (() => {
  const flag = args.find((a) => a.startsWith("--module="));
  return flag ? flag.split("=").slice(1).join("=") : undefined;
})();
const FILE_FILTER = (() => {
  const flag = args.find((a) => a.startsWith("--file="));
  return flag ? flag.split("=").slice(1).join("=") : undefined;
})();
const MAX_LOC = (() => {
  const flag = args.find((a) => a.startsWith("--max-loc="));
  return flag ? parseInt(flag.split("=")[1], 10) : Infinity;
})();
const LIMIT = (() => {
  const flag = args.find((a) => a.startsWith("--limit="));
  return flag ? parseInt(flag.split("=")[1], 10) : Infinity;
})();

// ─── Branding replacement map ───────────────────────────────────────────────

/**
 * Ordered replacement rules. Applied in sequence.
 * IMPORTANT: More specific patterns MUST come before general ones.
 */
const BRANDING_RULES = [
  // ── Env var prefix (most common) ──
  // Handles OPENCLAW_HOME, OPENCLAW_AGENT_DIR, etc.
  { pattern: /OPENCLAW_/g, replacement: "COREBLOW_" },

  // ── Class / type / interface names ──
  { pattern: /OpenClawConfig/g, replacement: "CoreBlowConfig" },
  { pattern: /OpenClawError/g, replacement: "CoreBlowError" },
  { pattern: /OpenClawPlugin/g, replacement: "CoreBlowPlugin" },
  { pattern: /OpenClawGateway/g, replacement: "CoreBlowGateway" },
  { pattern: /OpenClawAgent/g, replacement: "CoreBlowAgent" },
  { pattern: /OpenClawService/g, replacement: "CoreBlowService" },
  { pattern: /OpenClawClient/g, replacement: "CoreBlowClient" },
  { pattern: /OpenClawSession/g, replacement: "CoreBlowSession" },
  { pattern: /OpenClawChannel/g, replacement: "CoreBlowChannel" },
  { pattern: /OpenClawRuntime/g, replacement: "CoreBlowRuntime" },

  // ── Test harness / temp dir prefixes ──
  { pattern: /openclaw-cron-/g, replacement: "coreblow-cron-" },
  { pattern: /openclaw-gateway-/g, replacement: "coreblow-gateway-" },
  { pattern: /openclaw-agent-/g, replacement: "coreblow-agent-" },
  { pattern: /openclaw-test-/g, replacement: "coreblow-test-" },
  { pattern: /openclaw-cli-/g, replacement: "coreblow-cli-" },
  { pattern: /openclaw-service-/g, replacement: "coreblow-service-" },
  { pattern: /openclaw-infra-/g, replacement: "coreblow-infra-" },
  { pattern: /openclaw-channel-/g, replacement: "coreblow-channel-" },
  { pattern: /openclaw-plugin-/g, replacement: "coreblow-plugin-" },
  { pattern: /openclaw-auth-/g, replacement: "coreblow-auth-" },
  { pattern: /openclaw-sandbox-/g, replacement: "coreblow-sandbox-" },
  { pattern: /openclaw-session-/g, replacement: "coreblow-session-" },
  { pattern: /openclaw-subagent-/g, replacement: "coreblow-subagent-" },

  // ── Tool/function names with "openclaw" prefix ──
  // MUST NOT replace import paths like "./openclaw-tools.js"
  // We handle these separately — see applyBranding()

  // ── Generic PascalCase (catch-all for any remaining OpenClaw* identifiers) ──
  // Applied AFTER specific patterns above
  { pattern: /OpenClaw(?=[A-Z])/g, replacement: "CoreBlow" },

  // ── Standalone "OpenClaw" in strings/comments (NOT in import paths) ──
  // We use a lookahead to avoid breaking import specifiers
  { pattern: /(?<!["'`\.\/])OpenClaw(?!["'`])/g, replacement: "CoreBlow" },
];

/**
 * Apply branding replacements to file content.
 * Carefully avoids modifying relative import paths.
 */
function applyBranding(content) {
  let result = content;

  // Step 1: Protect import/export paths from modification
  // Extract and replace them with placeholders, then restore after branding
  const importPaths = [];
  result = result.replace(
    /(from\s+["'])([^"']+)(["'])/g,
    (match, pre, path, post) => {
      importPaths.push({ pre, path, post });
      return `__IMPORT_PLACEHOLDER_${importPaths.length - 1}__`;
    }
  );

  // Also protect dynamic imports
  const dynamicImports = [];
  result = result.replace(
    /(import\s*\(\s*["'])([^"']+)(["']\s*\))/g,
    (match, pre, path, post) => {
      dynamicImports.push({ pre, path, post });
      return `__DYNAMIC_IMPORT_PLACEHOLDER_${dynamicImports.length - 1}__`;
    }
  );

  // Step 2: Apply branding rules
  for (const rule of BRANDING_RULES) {
    result = result.replace(rule.pattern, rule.replacement);
  }

  // Step 3: Handle "openclaw" in non-import contexts
  // Replace lowercase "openclaw" in string literals, comments, and identifiers
  // but NOT in import paths (which are already protected)
  result = result.replace(/openclaw/gi, (match) => {
    if (match === "openclaw") return "coreblow";
    if (match === "OPENCLAW") return "COREBLOW";
    if (match === "Openclaw") return "Coreblow";
    if (match === "OpenClaw") return "CoreBlow";
    return match.toLowerCase() === "openclaw"
      ? match[0] === match[0].toUpperCase() ? "CoreBlow" : "coreblow"
      : match;
  });

  // Step 4: Restore import paths
  for (let i = importPaths.length - 1; i >= 0; i--) {
    const { pre, path, post } = importPaths[i];
    result = result.replace(
      `__IMPORT_PLACEHOLDER_${i}__`,
      `${pre}${path}${post}`
    );
  }
  for (let i = dynamicImports.length - 1; i >= 0; i--) {
    const { pre, path, post } = dynamicImports[i];
    result = result.replace(
      `__DYNAMIC_IMPORT_PLACEHOLDER_${i}__`,
      `${pre}${path}${post}`
    );
  }

  return result;
}

// ─── File discovery ─────────────────────────────────────────────────────────

function getGapFiles() {
  const auditPath = join(CB_ROOT, "audit-parity-full.json");
  if (!existsSync(auditPath)) {
    console.error("❌ audit-parity-full.json not found. Run: node scripts/audit-oc-parity.mjs --json > audit-parity-full.json");
    process.exit(1);
  }
  const audit = JSON.parse(readFileSync(auditPath, "utf8"));
  let gaps = audit.tests.oc_has_test_cb_does_not;

  if (FILE_FILTER) {
    gaps = [FILE_FILTER];
  } else if (MODULE_FILTER) {
    gaps = gaps.filter((f) => f.startsWith(MODULE_FILTER));
  }

  // Apply LOC filter
  if (MAX_LOC < Infinity) {
    gaps = gaps.filter((f) => {
      const ocPath = join(OC_ROOT, f);
      if (!existsSync(ocPath)) return false;
      const content = readFileSync(ocPath, "utf8");
      return content.split("\n").length <= MAX_LOC;
    });
  }

  return gaps.slice(0, LIMIT);
}

/**
 * For files that already exist in CB (as stubs from gen-missing-tests.mjs),
 * we want to port the FULL OC test content to replace the stub.
 */
function getAllPortableFiles() {
  // If we have a specific file, just use that
  if (FILE_FILTER) {
    return [FILE_FILTER];
  }

  // Otherwise, find all CB test files that are import-contract stubs
  // and have a corresponding OC test with real logic
  const auditPath = join(CB_ROOT, "audit-parity-full.json");

  if (existsSync(auditPath)) {
    const audit = JSON.parse(readFileSync(auditPath, "utf8"));
    // Use all OC test files (both gaps and already-existing)
    // We want to port logic for files that currently have stubs
    let allOcTests = [
      ...audit.tests.oc_has_test_cb_does_not,
      ...audit.tests.both_have_test,
    ];

    if (MODULE_FILTER) {
      allOcTests = allOcTests.filter((f) => f.startsWith(MODULE_FILTER));
    }

    // Filter to only files that exist as stubs in CB
    return allOcTests.filter((f) => {
      const cbPath = join(CB_ROOT, f);
      const ocPath = join(OC_ROOT, f);
      if (!existsSync(ocPath)) return false;

      // If CB file exists, check if it's a stub (contains "resolves all imports without errors")
      if (existsSync(cbPath)) {
        const cbContent = readFileSync(cbPath, "utf8");
        return cbContent.includes("resolves all imports without errors") ||
               cbContent.includes("it.todo(");
      }
      // If CB file doesn't exist, it's a gap — port it
      return true;
    });
  }

  return getGapFiles();
}

// ─── Port logic ─────────────────────────────────────────────────────────────

function portFile(relPath) {
  const ocPath = join(OC_ROOT, relPath);
  const cbPath = join(CB_ROOT, relPath);

  if (!existsSync(ocPath)) {
    return { status: "skip", reason: "OC file not found" };
  }

  const ocContent = readFileSync(ocPath, "utf8");
  const ocLines = ocContent.split("\n").length;

  // Apply LOC filter
  if (ocLines > MAX_LOC) {
    return { status: "skip", reason: `LOC ${ocLines} > max ${MAX_LOC}` };
  }

  // Apply branding
  const ported = applyBranding(ocContent);

  // Validate: check that branding was applied
  const remainingOC = (ported.match(/OPENCLAW/g) || []).length;
  const remainingOc = (ported.match(/OpenClaw(?!["'`])/g) || []).length;

  if (DRY_RUN) {
    return {
      status: "dry",
      lines: ocLines,
      brandingFixed: remainingOC === 0 && remainingOc === 0,
      remainingRefs: remainingOC + remainingOc,
    };
  }

  // Write ported file
  mkdirSync(dirname(cbPath), { recursive: true });
  writeFileSync(cbPath, ported, "utf8");

  return {
    status: "ok",
    lines: ocLines,
    brandingFixed: remainingOC === 0 && remainingOc === 0,
    remainingRefs: remainingOC + remainingOc,
  };
}

// ─── Validation ─────────────────────────────────────────────────────────────

function validateFiles(files) {
  const batchSize = 15;
  let passed = 0;
  let failed = 0;
  const failures = [];

  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    const fileArgs = batch.map((f) => join(CB_ROOT, f)).join(" ");

    try {
      execSync(
        `npx vitest run ${batch.join(" ")} --reporter=verbose 2>&1`,
        { cwd: CB_ROOT, timeout: 120_000, encoding: "utf8" }
      );
      passed += batch.length;
    } catch (err) {
      // Parse output to find which files failed
      const output = err.stdout || err.stderr || "";
      for (const f of batch) {
        if (output.includes(`FAIL  ${f}`)) {
          failed++;
          failures.push(f);
        } else {
          passed++;
        }
      }
    }
  }

  return { passed, failed, failures };
}

// ─── Main ───────────────────────────────────────────────────────────────────

const files = getAllPortableFiles();
console.log(`\n🔄 Port OC Tests → CB (CoreBlow branding)`);
console.log(`   Files to process: ${files.length}`);
if (MODULE_FILTER) console.log(`   Module filter: ${MODULE_FILTER}`);
if (MAX_LOC < Infinity) console.log(`   Max LOC: ${MAX_LOC}`);
if (DRY_RUN) console.log(`   Mode: DRY RUN`);
console.log();

let ported = 0;
let skipped = 0;
let brandingIssues = 0;
let totalLines = 0;

for (const f of files) {
  const result = portFile(f);

  switch (result.status) {
    case "ok":
      totalLines += result.lines;
      if (result.remainingRefs > 0) {
        console.log(`[WARN] ${f} (${result.lines} LOC, ${result.remainingRefs} remaining OC refs)`);
        brandingIssues++;
      } else {
        console.log(`[OK]   ${f} (${result.lines} LOC)`);
      }
      ported++;
      break;
    case "dry":
      totalLines += result.lines;
      const tag = result.brandingFixed ? "OK" : `WARN:${result.remainingRefs}refs`;
      console.log(`[DRY]  ${f} (${result.lines} LOC, ${tag})`);
      ported++;
      break;
    case "skip":
      console.log(`[SKIP] ${f} — ${result.reason}`);
      skipped++;
      break;
  }
}

console.log();
console.log(`✅ Ported: ${ported} files (${totalLines.toLocaleString()} lines)`);
console.log(`⏭️  Skipped: ${skipped}`);
if (brandingIssues > 0) {
  console.log(`⚠️  Branding issues: ${brandingIssues} files still have OC references`);
}

// Validate if requested
if (VALIDATE && !DRY_RUN) {
  console.log(`\n🧪 Validating ported tests with vitest...`);
  const portedFiles = files.filter((f) => existsSync(join(CB_ROOT, f)));
  const results = validateFiles(portedFiles);
  console.log(`   Passed: ${results.passed}`);
  console.log(`   Failed: ${results.failed}`);
  if (results.failures.length > 0) {
    console.log(`   Failures:`);
    results.failures.forEach((f) => console.log(`     - ${f}`));
  }
}
