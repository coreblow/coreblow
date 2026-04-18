#!/usr/bin/env node
/**
 * scripts/write-plugin-sdk-entry.mjs
 * [PORT] coreblow-main
 *
 * Reads scripts/lib/plugin-sdk-entrypoints.json and injects plugin-sdk
 * exports into package.json. Safe to run multiple times (idempotent).
 *
 * Usage:
 *   node scripts/write-plugin-sdk-entry.mjs
 *   node scripts/write-plugin-sdk-entry.mjs --dry-run
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const isDryRun = process.argv.includes("--dry-run");

// ─── Load entrypoints ────────────────────────────────────────────────────────
const entrypoints = JSON.parse(
  readFileSync(resolve(__dirname, "lib/plugin-sdk-entrypoints.json"), "utf-8"),
);

console.log(`Loaded ${entrypoints.length} plugin-sdk entrypoints`);

// ─── Build exports map ───────────────────────────────────────────────────────
function buildSdkExports(entries) {
  return Object.fromEntries(
    entries.map((entry) => [
      entry === "index" ? "./plugin-sdk" : `./plugin-sdk/${entry}`,
      {
        types: `./dist/plugin-sdk/${entry}.d.ts`,
        default: `./dist/plugin-sdk/${entry}.js`,
      },
    ]),
  );
}

// ─── Load and patch package.json ─────────────────────────────────────────────
const pkgPath = resolve(ROOT, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

const sdkExports = buildSdkExports(entrypoints);

// Merge: keep existing non-plugin-sdk exports, replace all plugin-sdk exports
const existingExports = pkg.exports ?? {};
const nonSdkExports = Object.fromEntries(
  Object.entries(existingExports).filter(
    ([key]) =>
      key !== "./plugin-sdk" && !key.startsWith("./plugin-sdk/"),
  ),
);

// Standard root exports
const rootExports = {
  ".": {
    types: "./dist/index.d.ts",
    default: "./dist/index.js",
  },
  ...nonSdkExports,
};

const newExports = {
  ...rootExports,
  ...sdkExports,
};

pkg.exports = newExports;

const output = JSON.stringify(pkg, null, 2) + "\n";

if (isDryRun) {
  console.log("DRY RUN — would write package.json with exports:");
  const sdkKeys = Object.keys(sdkExports);
  console.log(`  ${sdkKeys.length} plugin-sdk exports (e.g. ${sdkKeys.slice(0, 3).join(", ")}...)`);
  console.log("  Root exports:", Object.keys(rootExports).join(", "));
} else {
  writeFileSync(pkgPath, output, "utf-8");
  console.log(`✅ package.json updated with ${Object.keys(sdkExports).length} plugin-sdk exports`);
}
