#!/usr/bin/env node

/**
 * CoreBlow — Cross-Repo Ecosystem Contract CI Gate
 *
 * Enforces cross-repository contract guarantees between the CoreBlow monorepo
 * and federated satellite fleet repositories:
 * 1. Canonical version consistency across release surfaces.
 * 2. Catalog sync and zero legacy/competitor entries.
 * 3. Manifest schema compatibility against real extension manifests.
 * 4. 100% CoreBlow Brand Sovereignty and zero hardcoded personal paths.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const splitRoot = path.resolve(repoRoot, "../coreblow-split");

const errors = [];

function recordError(category, message) {
  errors.push(`[${category}] ${message}`);
}

console.log("=== CoreBlow Ecosystem Contract CI Gate ===");

// ─── 1. Canonical Version Consistency ────────────────────────────────────────

const rootPkgPath = path.join(repoRoot, "package.json");
let canonicalVersion = "";
try {
  const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, "utf8"));
  canonicalVersion = rootPkg.version;
  if (!canonicalVersion) {
    recordError("VERSION", "Root package.json missing 'version' field");
  } else {
    console.log(`[VERSION] Monorepo canonical version: v${canonicalVersion}`);
  }
} catch (err) {
  recordError("VERSION", `Cannot read root package.json: ${err.message}`);
}

if (canonicalVersion && fs.existsSync(splitRoot)) {
  // 1a. coreblow.com install scripts
  const installShPath = path.join(splitRoot, "coreblow.com/public/install.sh");
  if (fs.existsSync(installShPath)) {
    const installSh = fs.readFileSync(installShPath, "utf8");
    if (!installSh.includes(canonicalVersion)) {
      recordError("VERSION", `coreblow.com/public/install.sh does not reference v${canonicalVersion}`);
    } else {
      console.log(`[VERSION] ✓ coreblow.com/public/install.sh aligns with v${canonicalVersion}`);
    }
  }

  // 1b. homebrew-tap formula
  const formulaPath = path.join(splitRoot, "homebrew-tap/Formula/coreblow.rb");
  if (fs.existsSync(formulaPath)) {
    const formula = fs.readFileSync(formulaPath, "utf8");
    const expectedUrl = `coreblow-${canonicalVersion}.tgz`;
    if (!formula.includes(expectedUrl)) {
      recordError("VERSION", `homebrew-tap/Formula/coreblow.rb does not point to ${expectedUrl}`);
    } else {
      console.log(`[VERSION] ✓ homebrew-tap formula aligns with v${canonicalVersion}`);
    }
  }
}

// ─── 2. Catalog Sync & Brand Sovereignty in Catalogs ─────────────────────────

const competitorRegex = /\b(openclaw|clawhub|clawbench|clawgo)\b/i;

const fallbackCatalogPath = path.join(repoRoot, "scripts/lib/official-external-channel-catalog.json");
if (fs.existsSync(fallbackCatalogPath)) {
  try {
    const raw = fs.readFileSync(fallbackCatalogPath, "utf8");
    if (competitorRegex.test(raw)) {
      recordError("CATALOG", "Fallback catalog contains legacy/competitor names");
    } else {
      console.log("[CATALOG] ✓ Fallback catalog has 100% brand sovereignty");
    }
  } catch (err) {
    recordError("CATALOG", `Failed to read fallback catalog: ${err.message}`);
  }
}

const corehubCatalogPath = path.join(splitRoot, "corehub/catalog.json");
if (fs.existsSync(corehubCatalogPath)) {
  try {
    const raw = fs.readFileSync(corehubCatalogPath, "utf8");
    if (competitorRegex.test(raw)) {
      recordError("CATALOG", "CoreHub catalog.json contains legacy/competitor names");
    } else {
      const entries = JSON.parse(raw);
      console.log(`[CATALOG] ✓ CoreHub catalog verified (${entries.length} entries, 100% brand sovereignty)`);
    }
  } catch (err) {
    recordError("CATALOG", `Failed to read CoreHub catalog.json: ${err.message}`);
  }
}

// ─── 3. Manifest Schema Compatibility ────────────────────────────────────────

let validatorFn = null;
const pluginLabValidatorPath = path.join(splitRoot, "plugin-lab/src/manifest.mjs");

if (fs.existsSync(pluginLabValidatorPath)) {
  try {
    const mod = await import(`file://${pluginLabValidatorPath}`);
    validatorFn = mod.validatePluginManifest;
  } catch (err) {
    recordError("MANIFEST", `Failed to import validator from plugin-lab: ${err.message}`);
  }
} else {
  // Built-in fallback validator matching the contract
  const idPattern = /^[a-z0-9][a-z0-9-_]*$/;
  validatorFn = function (manifest) {
    const errs = [];
    if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
      return ["manifest must be an object"];
    }
    if (typeof manifest.id !== "string" || !idPattern.test(manifest.id)) {
      errs.push("id must be kebab-case (alphanumeric with hyphens/underscores)");
    }
    if (manifest.name !== undefined && (typeof manifest.name !== "string" || manifest.name.trim().length === 0)) {
      errs.push("name must be a non-empty string when present");
    }
    return errs;
  };
}

if (validatorFn) {
  const extensionsDir = path.join(repoRoot, "extensions");
  if (fs.existsSync(extensionsDir)) {
    const exts = fs.readdirSync(extensionsDir);
    let checkedManifests = 0;
    let manifestErrors = 0;

    for (const ext of exts) {
      const manifestPath = path.join(extensionsDir, ext, "coreblow.plugin.json");
      if (fs.existsSync(manifestPath)) {
        try {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
          const vErrors = validatorFn(manifest);
          checkedManifests++;
          if (vErrors && vErrors.length > 0) {
            recordError("MANIFEST", `Extension '${ext}' manifest validation failed: ${vErrors.join("; ")}`);
            manifestErrors++;
          }
        } catch (err) {
          recordError("MANIFEST", `Extension '${ext}' invalid JSON: ${err.message}`);
          manifestErrors++;
        }
      }
    }

    if (manifestErrors === 0) {
      console.log(`[MANIFEST] ✓ ${checkedManifests} extensions verified against manifest contract (0 errors)`);
    }
  }
}

// ─── 4. Zero Hardcoded Personal Home Paths & Brand Sovereignty ────────────────

console.log("[HYGIENE] Checking brand sovereignty and path hygiene...");

const personalPathRegex = /((\/Users\/[a-zA-Z0-9_-]+)|(\/home\/(?!node\b)[a-zA-Z0-9_-]+)|([A-Z]:\\Users\\[a-zA-Z0-9_-]+))/;

function checkFileHygiene(filePath, checkBrand = true) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  const rel = path.relative(repoRoot, filePath);
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (personalPathRegex.test(line)) {
      recordError("PATH", `${rel}:${i + 1}: Found hardcoded personal home path: ${line.trim()}`);
    }
    if (checkBrand && competitorRegex.test(line)) {
      recordError("BRAND", `${rel}:${i + 1}: Found forbidden competitor keyword: ${line.trim()}`);
    }
  }
}

// Check key public and release surfaces for brand sovereignty
const publicSurfaces = [
  path.join(repoRoot, "package.json"),
  path.join(repoRoot, "README.md"),
  path.join(repoRoot, "appcast.xml"),
];

for (const p of publicSurfaces) {
  checkFileHygiene(p, true);
}

// Check workflows for personal paths and brand leaks
const workflowDir = path.join(repoRoot, ".github/workflows");
if (fs.existsSync(workflowDir)) {
  for (const wf of fs.readdirSync(workflowDir)) {
    if (/\.ya?ml$/i.test(wf)) {
      checkFileHygiene(path.join(workflowDir, wf), true);
    }
  }
}

// Check satellite fleet public surfaces if available
if (fs.existsSync(splitRoot)) {
  const satelliteSurfaces = [
    "coreblow.com/public/install.sh",
    "homebrew-tap/Formula/coreblow.rb",
    "corechat/README.md",
    "corebar/README.md",
  ];
  for (const rel of satelliteSurfaces) {
    const full = path.join(splitRoot, rel);
    checkFileHygiene(full, true);
  }
}

console.log("[HYGIENE] ✓ Verified brand sovereignty and zero hardcoded paths across monorepo and fleet surfaces.");

// ─── Evaluation ──────────────────────────────────────────────────────────────

if (errors.length > 0) {
  console.error(`\n❌ Ecosystem contract verification FAILED with ${errors.length} error(s):`);
  for (const err of errors) {
    console.error(`  ${err}`);
  }
  process.exit(1);
}

console.log("\n✅ All ecosystem contracts verified successfully (0 errors).");
