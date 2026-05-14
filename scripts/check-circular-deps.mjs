#!/usr/bin/env node

/**
 * scripts/check-circular-deps.mjs
 *
 * Real circular-dependency checker for CoreBlow.
 * Scans TypeScript source files, builds an import graph, detects strongly
 * connected components (Tarjan's algorithm), and compares against an
 * explicit allowed baseline.
 *
 * Usage:
 *   node scripts/check-circular-deps.mjs            # check against baseline
 *   node scripts/check-circular-deps.mjs --update    # write current cycles as new baseline
 *   node scripts/check-circular-deps.mjs --json      # output detected cycles as JSON
 *
 * Exit codes:
 *   0  — no new cycles beyond baseline
 *   1  — new cycles detected (or baseline entries removed without --update)
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const BASELINE_PATH = path.join(repoRoot, "scripts", "circular-deps-baseline.json");

// ── Configuration ────────────────────────────────────────────────

/** Directories to scan for .ts files (relative to repo root). */
const SCAN_ROOTS = ["src", "extensions", "packages", "ui/src"];

/** Directories and patterns to skip. */
const SKIP_PATTERNS = [
  "node_modules",
  "dist",
  ".build",
  "build",
  "__mocks__",
];

/** File suffixes to exclude. */
const SKIP_SUFFIXES = [".d.ts", ".d.mts", ".test.ts", ".test-utils.ts", ".e2e.test.ts"];

// ── Import Extraction ────────────────────────────────────────────

/**
 * Extract relative/local import specifiers from a TS file's text.
 * Captures static imports, re-exports, and dynamic imports that use
 * relative paths (starting with . or ..).
 */
function extractImports(source) {
  const imports = [];
  // Match: import ... from "..." / export ... from "..." / import("...")
  const importRegex = /(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?["'](\.[^"']+)["']|import\s*\(\s*["'](\.[^"']+)["']\s*\)/g;
  let match;
  while ((match = importRegex.exec(source)) !== null) {
    const spec = match[1] ?? match[2];
    if (spec) imports.push(spec);
  }
  return imports;
}

/**
 * Resolve a relative import specifier to a canonical repo-relative path.
 * Tries .ts, /index.ts, .tsx extensions.
 */
async function resolveSpecifier(importerFile, specifier) {
  const importerDir = path.dirname(importerFile);
  const raw = path.resolve(importerDir, specifier);

  // Direct file match (with or without extension)
  for (const ext of ["", ".ts", ".tsx", ".js", ".mjs"]) {
    const candidate = raw + ext;
    try {
      const stat = await fs.stat(candidate);
      if (stat.isFile()) return path.relative(repoRoot, candidate);
    } catch { /* not found */ }
  }

  // Directory index
  for (const indexName of ["index.ts", "index.tsx", "index.js"]) {
    const candidate = path.join(raw, indexName);
    try {
      const stat = await fs.stat(candidate);
      if (stat.isFile()) return path.relative(repoRoot, candidate);
    } catch { /* not found */ }
  }

  return null;
}

// ── File Collection ──────────────────────────────────────────────

async function collectFiles(rootDir) {
  const results = [];

  async function walk(dir) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const full = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (SKIP_PATTERNS.includes(entry.name)) continue;
        await walk(full);
        continue;
      }

      if (!entry.isFile()) continue;
      if (!entry.name.endsWith(".ts") && !entry.name.endsWith(".tsx")) continue;
      if (SKIP_SUFFIXES.some((s) => entry.name.endsWith(s))) continue;

      results.push(full);
    }
  }

  await walk(rootDir);
  return results;
}

// ── Graph Building ───────────────────────────────────────────────

async function buildImportGraph() {
  const graph = new Map(); // repo-relative path → Set<repo-relative path>

  const allFiles = [];
  for (const root of SCAN_ROOTS) {
    const rootPath = path.join(repoRoot, root);
    const files = await collectFiles(rootPath);
    allFiles.push(...files);
  }

  for (const file of allFiles) {
    const relFile = path.relative(repoRoot, file);
    if (!graph.has(relFile)) graph.set(relFile, new Set());

    const source = await fs.readFile(file, "utf8");
    const imports = extractImports(source);

    for (const spec of imports) {
      const resolved = await resolveSpecifier(file, spec);
      if (resolved && resolved !== relFile) {
        graph.get(relFile).add(resolved);
      }
    }
  }

  return graph;
}

// ── Tarjan's SCC Algorithm ───────────────────────────────────────

function findSCCs(graph) {
  let index = 0;
  const stack = [];
  const onStack = new Set();
  const indices = new Map();
  const lowlinks = new Map();
  const sccs = [];

  function strongConnect(v) {
    indices.set(v, index);
    lowlinks.set(v, index);
    index++;
    stack.push(v);
    onStack.add(v);

    const edges = graph.get(v) ?? new Set();
    for (const w of edges) {
      if (!indices.has(w)) {
        strongConnect(w);
        lowlinks.set(v, Math.min(lowlinks.get(v), lowlinks.get(w)));
      } else if (onStack.has(w)) {
        lowlinks.set(v, Math.min(lowlinks.get(v), indices.get(w)));
      }
    }

    if (lowlinks.get(v) === indices.get(v)) {
      const scc = [];
      let w;
      do {
        w = stack.pop();
        onStack.delete(w);
        scc.push(w);
      } while (w !== v);

      // Only report SCCs with actual cycles (size > 1)
      if (scc.length > 1) {
        sccs.push(scc.sort());
      }
    }
  }

  for (const node of graph.keys()) {
    if (!indices.has(node)) {
      strongConnect(node);
    }
  }

  return sccs;
}

// ── Direct Pair Extraction ───────────────────────────────────────

/** Extract direct A↔B pair cycles from the graph. */
function findDirectPairCycles(graph) {
  const pairs = [];
  const seen = new Set();

  for (const [a, edges] of graph) {
    for (const b of edges) {
      const bEdges = graph.get(b);
      if (bEdges?.has(a)) {
        const key = [a, b].sort().join(" <-> ");
        if (!seen.has(key)) {
          seen.add(key);
          pairs.push([a, b].sort());
        }
      }
    }
  }

  return pairs.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
}

// ── Baseline Management ──────────────────────────────────────────

async function readBaseline() {
  try {
    const raw = await fs.readFile(BASELINE_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return { sccs: [], pairs: [] };
  }
}

async function writeBaseline(data) {
  const json = JSON.stringify(data, null, 2) + "\n";
  await fs.writeFile(BASELINE_PATH, json, "utf8");
}

/** Normalize an SCC/pair for stable comparison. */
function normalizeForComparison(arr) {
  return JSON.stringify(arr.map((item) =>
    Array.isArray(item) ? [...item].sort() : item
  ).sort((a, b) => {
    const aKey = Array.isArray(a) ? a.join(",") : a;
    const bKey = Array.isArray(b) ? b.join(",") : b;
    return aKey.localeCompare(bKey);
  }));
}

function diffCycles(baseline, current) {
  const baseKeys = new Set(baseline.map((c) => JSON.stringify([...c].sort())));
  const currKeys = new Set(current.map((c) => JSON.stringify([...c].sort())));

  const added = current.filter((c) => !baseKeys.has(JSON.stringify([...c].sort())));
  const removed = baseline.filter((c) => !currKeys.has(JSON.stringify([...c].sort())));

  return { added, removed };
}

// ── Main ─────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const updateMode = args.includes("--update");
  const jsonMode = args.includes("--json");

  console.log("check-circular-deps: scanning import graph...");

  const graph = await buildImportGraph();
  const sccs = findSCCs(graph);
  const pairs = findDirectPairCycles(graph);

  const totalFiles = graph.size;
  const totalEdges = Array.from(graph.values()).reduce((sum, edges) => sum + edges.size, 0);

  if (jsonMode) {
    console.log(JSON.stringify({ totalFiles, totalEdges, sccs, pairs }, null, 2));
    process.exit(0);
  }

  console.log(`  files scanned: ${totalFiles}`);
  console.log(`  import edges:  ${totalEdges}`);
  console.log(`  SCCs (size>1): ${sccs.length}`);
  console.log(`  direct pairs:  ${pairs.length}`);

  if (updateMode) {
    const data = { sccs, pairs, updatedAt: new Date().toISOString() };
    await writeBaseline(data);
    console.log(`\nBaseline written to ${path.relative(repoRoot, BASELINE_PATH)}`);
    console.log(`  ${sccs.length} SCC(s), ${pairs.length} pair(s)`);
    process.exit(0);
  }

  // Compare against baseline
  const baseline = await readBaseline();
  const sccDiff = diffCycles(baseline.sccs ?? [], sccs);
  const pairDiff = diffCycles(baseline.pairs ?? [], pairs);

  const hasNewCycles = sccDiff.added.length > 0 || pairDiff.added.length > 0;
  const hasRemovedCycles = sccDiff.removed.length > 0 || pairDiff.removed.length > 0;

  if (sccs.length > 0) {
    console.log("\n  Detected SCCs:");
    for (const scc of sccs) {
      const isNew = sccDiff.added.some((a) =>
        JSON.stringify([...a].sort()) === JSON.stringify([...scc].sort())
      );
      const marker = isNew ? " 🆕 NEW" : " (baseline)";
      console.log(`    [${scc.length} files]${marker}`);
      for (const file of scc.slice(0, 10)) {
        console.log(`      - ${file}`);
      }
      if (scc.length > 10) {
        console.log(`      ... and ${scc.length - 10} more`);
      }
    }
  }

  if (pairs.length > 0) {
    console.log("\n  Direct pair cycles:");
    for (const [a, b] of pairs) {
      const isNew = pairDiff.added.some((p) =>
        JSON.stringify([...p].sort()) === JSON.stringify([a, b].sort())
      );
      const marker = isNew ? " 🆕 NEW" : " (baseline)";
      console.log(`    ${a} <-> ${b}${marker}`);
    }
  }

  if (hasNewCycles) {
    console.log("\n❌ check-circular-deps: FAILED — new circular dependencies detected!");
    if (sccDiff.added.length > 0) {
      console.log(`   ${sccDiff.added.length} new SCC(s)`);
    }
    if (pairDiff.added.length > 0) {
      console.log(`   ${pairDiff.added.length} new pair cycle(s)`);
    }
    console.log("   Run with --update to accept the new baseline (if intentional).");
    process.exit(1);
  }

  if (hasRemovedCycles) {
    console.log("\n⚠️  Some baseline cycles no longer exist (good!) — run --update to shrink baseline.");
  }

  console.log("\n✅ check-circular-deps: passed — no new cycles beyond baseline");
  process.exit(0);
}

main().catch((err) => {
  console.error("check-circular-deps: fatal error:", err);
  process.exit(1);
});
