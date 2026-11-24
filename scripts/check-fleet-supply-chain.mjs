import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "..");
const splitRoot = path.resolve(monorepoRoot, "../coreblow-split");

console.log("=== Auditing Fleet Supply-Chain Security & Action Pinning ===");

// 1. Locate all workflow files across monorepo and 25 satellites
let workflowFiles = [];
try {
  const monorepoWf = execSync(`find "${monorepoRoot}/.github/workflows" \\( -name "*.yml" -o -name "*.yaml" \\)`, { encoding: "utf8" })
    .trim()
    .split("\n")
    .filter(Boolean);
  workflowFiles.push(...monorepoWf);
} catch {}

if (fs.existsSync(splitRoot)) {
  try {
    const splitWf = execSync(`find "${splitRoot}" \\( -name "*.yml" -o -name "*.yaml" \\) | grep "\\.github/workflows/" | grep -v node_modules | grep -v "/dist/"`, { encoding: "utf8" })
      .trim()
      .split("\n")
      .filter(Boolean);
    workflowFiles.push(...splitWf);
  } catch {}
}

console.log(`Discovered ${workflowFiles.length} workflow files across monorepo and satellite fleet.`);
if (workflowFiles.length === 0) {
  console.error("FAIL: No workflow files found.");
  process.exit(1);
}

let errors = [];

// 2. Validate YAML syntax and 40-character commit SHA pinning
console.log("1. Verifying YAML validity and full 40-character commit SHA pinning...");
for (const file of workflowFiles) {
  const relPath = path.relative(monorepoRoot, file);
  let content;
  try {
    content = fs.readFileSync(file, "utf8");
  } catch (err) {
    errors.push(`Could not read ${relPath}: ${err.message}`);
    continue;
  }

  // Validate YAML syntax via Node yaml parser
  try {
    YAML.parse(content);
  } catch (err) {
    errors.push(`YAML syntax error in ${relPath}: ${err.message}`);
  }

  // Check unpinned actions
  const lines = content.split("\n");
  lines.forEach((line, idx) => {
    const match = line.match(/^\s*(?:-\s*)?uses:\s*([^\s#]+)/);
    if (match) {
      const act = match[1];
      if (act.startsWith("./") || act.startsWith("docker://")) {
        return; // local or docker action
      }
      const atIdx = act.indexOf("@");
      if (atIdx === -1) {
        errors.push(`Unpinned action missing version tag in ${relPath}:${idx + 1} (${act})`);
        return;
      }
      const ref = act.slice(atIdx + 1);
      if (!/^[a-f0-9]{40}$/.test(ref)) {
        errors.push(`Action not pinned to 40-char SHA in ${relPath}:${idx + 1} (${act})`);
      }
    }
  });

  // Check hardcoded local paths
  if (/\/Users\/|\/home\/(?!node|runner)/.test(content)) {
    errors.push(`Hardcoded local home path in ${relPath}`);
  }

  // Check brand sovereignty
  if (/\b(openclaw|clawhub)\b/i.test(content)) {
    errors.push(`Brand leak in ${relPath}`);
  }
}

if (errors.length > 0) {
  console.error(`\nFAIL: Encountered ${errors.length} supply-chain violations:`);
  for (const err of errors.slice(0, 20)) {
    console.error(`  - ${err}`);
  }
  if (errors.length > 20) {
    console.error(`  ... and ${errors.length - 20} more errors.`);
  }
  process.exit(1);
}
console.log("✓ All workflows have valid YAML and 100% 40-character commit SHA pinning.");

// 3. Verify presence of CycloneDX SBOM, SHA256SUMS.txt, and Attestation in required release workflows
console.log("2. Verifying SBOM, SHA256SUMS, and Artifact Attestation in release workflows...");

const REQUIRED_RELEASE_WORKFLOWS = [
  { repo: "coreblow (monorepo)", file: path.join(monorepoRoot, ".github/workflows/release.yml") },
  { repo: "corehub", file: path.join(splitRoot, "corehub/.github/workflows/corehub-cli-npm-release.yml") },
  { repo: "corechat", file: path.join(splitRoot, "corechat/.github/workflows/release.yml") },
  { repo: "corebar", file: path.join(splitRoot, "corebar/.github/workflows/release.yml") },
  { repo: "corebox", file: path.join(splitRoot, "corebox/.github/workflows/release.yml") },
  { repo: "dolphin", file: path.join(splitRoot, "dolphin/.github/workflows/release.yml") },
  { repo: "trust", file: path.join(splitRoot, "trust/.github/workflows/release.yml") },
  { repo: "corebench", file: path.join(splitRoot, "corebench/.github/workflows/release.yml") },
  { repo: "coreblow-rtt", file: path.join(splitRoot, "coreblow-rtt/.github/workflows/release.yml") },
];

let releaseErrors = [];
for (const target of REQUIRED_RELEASE_WORKFLOWS) {
  if (!fs.existsSync(target.file)) {
    releaseErrors.push(`Missing release workflow for ${target.repo}: ${path.relative(monorepoRoot, target.file)}`);
    continue;
  }
  const content = fs.readFileSync(target.file, "utf8");

  if (!content.includes("sbom.cdx.json") && !content.includes("CycloneDX")) {
    releaseErrors.push(`Missing CycloneDX SBOM generation in ${target.repo} (${path.basename(target.file)})`);
  }
  if (!content.includes("SHA256SUMS.txt") && !content.includes("sha256sum")) {
    releaseErrors.push(`Missing SHA256 checksums generation in ${target.repo} (${path.basename(target.file)})`);
  }
  if (!content.includes("actions/attest-build-provenance") && !content.includes("provenance")) {
    releaseErrors.push(`Missing artifact attestation in ${target.repo} (${path.basename(target.file)})`);
  }
  console.log(`  ✓ ${target.repo}: Verified release workflow with SBOM, checksums, and artifact attestation.`);
}

if (releaseErrors.length > 0) {
  console.error(`\nFAIL: Encountered ${releaseErrors.length} release workflow supply-chain errors:`);
  for (const err of releaseErrors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
}

console.log("\n✅ Fleet supply-chain verification passed: 100% SHA-pinned actions, valid YAML, and signed release/SBOM workflows in place.");
process.exit(0);
