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
 *   node scripts/audit-oc-parity.mjs --module src/tui
 *   node scripts/audit-oc-parity.mjs --tests-only
 *
 * OC reference: /Users/febrinanda/openclaw-main
 */

import { readdirSync, statSync, existsSync, readFileSync } from "node:fs";
import { join, relative, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const CB_ROOT = join(__dirname, "..");
const OC_ROOT = "/Users/febrinanda/openclaw-main";

const args = process.argv.slice(2);
const JSON_OUTPUT = args.includes("--json");
const TESTS_ONLY = args.includes("--tests-only");
const MODULE_FILTER = args.find((a) => a.startsWith("--module="))?.split("=")[1]
  || args[args.indexOf("--module") + 1];

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

// ─── collect files ──────────────────────────────────────────────────────────

const SCAN_DIRS = [
  "src",
  "extensions/discord/src",
  "extensions/telegram/src",
  "extensions/slack/src",
  "extensions/matrix/src",
  "extensions/browser/src",
];

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

const cbFiles = collectFiles(CB_ROOT, SCAN_DIRS);
const ocFiles = collectFiles(OC_ROOT, SCAN_DIRS);

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
  },
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
      results.source.oc_only.push(k);
    }
  }
}

// Test coverage analysis
const cbTestKeys = new Set(cbTest.keys());
const ocTestKeys = new Set(ocTest.keys());

// OC test files that don't exist in CB → gaps
for (const k of ocTestKeys) {
  if (cbTestKeys.has(k)) {
    results.tests.both_have_test.push(k);
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

// Export gap analysis (functions in OC not in CB)
for (const commonSrc of results.source.both.slice(0, 100)) {
  // Limit to avoid too much I/O
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
  const missingScenarios = ocScenarios.filter((s) => !cbScenarios.has(s));
  if (missingScenarios.length > 0) {
    results.test_scenarios.gaps.push({
      file: k,
      oc_scenarios_missing_in_cb: missingScenarios,
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
  test_files_cb: cbTestKeys.size,
  test_files_oc: ocTestKeys.size,
  tests_both_covered: results.tests.both_have_test.length,
  tests_gap_oc_has_cb_missing: results.tests.oc_has_test_cb_does_not.length,
  tests_cb_exclusive: results.tests.cb_has_test_oc_does_not.length,
  export_files_with_gaps: results.exports.gaps.length,
  test_scenario_files_with_gaps: results.test_scenarios.gaps.length,
};

// ─── output ─────────────────────────────────────────────────────────────────

if (JSON_OUTPUT) {
  console.log(JSON.stringify(results, null, 2));
  process.exit(0);
}

// Human-readable output
console.log("╔══════════════════════════════════════════════════════════════╗");
console.log("║          CoreBlow vs OpenClaw — Parity Audit                 ║");
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
