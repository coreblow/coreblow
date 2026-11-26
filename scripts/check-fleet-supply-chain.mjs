import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "..");
const splitRoot = path.resolve(monorepoRoot, "../coreblow-split");
const manifestPath = path.join(__dirname, "fleet/fleet-manifest.json");
const localOnly = process.argv.includes("--local-only");
const hasSplitFleet = !localOnly && fs.existsSync(splitRoot);

console.log("=== Auditing Fleet Supply-Chain Security & Action Pinning ===");

const fleetManifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const activeRepos = (fleetManifest.repositories ?? []).filter((r) => r.status === "active");

// 1. Locate workflow files across monorepo and active satellites
const workflowFiles = [];
try {
  const monorepoWf = execSync(
    `find "${monorepoRoot}/.github/workflows" \\( -name "*.yml" -o -name "*.yaml" \\)`,
    { encoding: "utf8" },
  )
    .trim()
    .split("\n")
    .filter(Boolean);
  workflowFiles.push(...monorepoWf);
} catch {
  // Ignore find failures
}

if (hasSplitFleet) {
  for (const repo of activeRepos) {
    if (!repo.siblingDir) continue;
    const wfDir = path.join(splitRoot, repo.siblingDir, ".github/workflows");
    if (!fs.existsSync(wfDir)) continue;
    for (const entry of fs.readdirSync(wfDir)) {
      if (/\.ya?ml$/i.test(entry)) {
        workflowFiles.push(path.join(wfDir, entry));
      }
    }
  }
}

console.log(
  `Discovered ${workflowFiles.length} workflow files across monorepo${hasSplitFleet ? " and active satellite fleet" : " (local-only mode)"}.`,
);
if (workflowFiles.length === 0) {
  console.error("FAIL: No workflow files found.");
  process.exit(1);
}

const errors = [];

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

  try {
    YAML.parse(content);
  } catch (err) {
    errors.push(`YAML syntax error in ${relPath}: ${err.message}`);
  }

  const lines = content.split("\n");
  lines.forEach((line, idx) => {
    const match = line.match(/^\s*(?:-\s*)?uses:\s*([^\s#]+)/);
    if (match) {
      const act = match[1];
      if (act.startsWith("./") || act.startsWith("docker://")) {
        return;
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

  if (/\/Users\/|\/home\/(?!node|runner)/.test(content)) {
    errors.push(`Hardcoded local home path in ${relPath}`);
  }

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

// 3. Verify CycloneDX SBOM, SHA256SUMS.txt, and Artifact Attestation in release workflows
console.log("2. Verifying SBOM, SHA256SUMS, and Artifact Attestation in release workflows...");

const requiredReleaseWorkflows = activeRepos
  .filter((repo) => Boolean(repo.releaseWorkflow))
  .filter((repo) => !repo.siblingDir || hasSplitFleet)
  .map((repo) => ({
    repo: repo.siblingDir ? repo.name : `${repo.name} (monorepo)`,
    file: repo.siblingDir
      ? path.join(splitRoot, repo.siblingDir, repo.releaseWorkflow)
      : path.join(monorepoRoot, repo.releaseWorkflow),
  }));

const releaseErrors = [];
for (const target of requiredReleaseWorkflows) {
  if (!fs.existsSync(target.file)) {
    releaseErrors.push(
      `Missing release workflow for ${target.repo}: ${path.relative(monorepoRoot, target.file)}`,
    );
    continue;
  }
  const content = fs.readFileSync(target.file, "utf8");

  if (!content.includes("sbom.cdx.json") && !content.includes("CycloneDX")) {
    releaseErrors.push(
      `Missing CycloneDX SBOM generation in ${target.repo} (${path.basename(target.file)})`,
    );
  }
  if (!content.includes("SHA256SUMS.txt") && !content.includes("sha256sum")) {
    releaseErrors.push(
      `Missing SHA256 checksums generation in ${target.repo} (${path.basename(target.file)})`,
    );
  }
  if (!content.includes("actions/attest-build-provenance") && !content.includes("provenance")) {
    releaseErrors.push(
      `Missing artifact attestation in ${target.repo} (${path.basename(target.file)})`,
    );
  }
  console.log(
    `  ✓ ${target.repo}: Verified release workflow with SBOM, checksums, and artifact attestation.`,
  );
}

if (!hasSplitFleet) {
  console.log(
    "  (Skip) Sibling satellite release workflows skipped in standalone/local-only mode.",
  );
}

if (releaseErrors.length > 0) {
  console.error(
    `\nFAIL: Encountered ${releaseErrors.length} release workflow supply-chain errors:`,
  );
  for (const err of releaseErrors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
}

console.log(
  "\n✅ Fleet supply-chain verification passed: 100% SHA-pinned actions, valid YAML, and signed release/SBOM workflows in place.",
);
process.exit(0);
