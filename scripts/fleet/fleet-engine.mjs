#!/usr/bin/env node

/**
 * CoreBlow — Satellite Fleet Engine (Phase 1B)
 *
 * Thin, declarative orchestrator driven by ./scripts/fleet/fleet-manifest.json.
 * Strictly dev/CI tooling — never import from runtime src/** or packages/**.
 */

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const MANIFEST_PATH = path.join(__dirname, "fleet-manifest.json");
const SPLIT_ROOT = path.resolve(REPO_ROOT, "../coreblow-split");

export function loadFleetManifest() {
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
}

function resolveCheckoutDir(repo) {
  if (repo.name === "coreblow") return REPO_ROOT;
  if (repo.tier === "internal") return path.resolve(REPO_ROOT, "..", repo.name);
  if (!repo.siblingDir) return null;
  return path.join(SPLIT_ROOT, repo.siblingDir);
}

function runGit(cwd, args) {
  return execFileSync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function checkVersionSync(repo, checkoutDir, canonicalVersion) {
  if (!repo.syncVersion || repo.name === "coreblow" || !canonicalVersion) {
    return "n/a";
  }
  const files = repo.syncFiles ?? [];
  if (files.length === 0) return "n/a";
  for (const rel of files) {
    const full = path.join(checkoutDir, rel);
    if (!fs.existsSync(full)) return `missing:${rel}`;
    const text = fs.readFileSync(full, "utf8");
    if (repo.name === "homebrew-tap") {
      if (!text.includes(`coreblow-${canonicalVersion}.tgz`)) return `drift:${rel}`;
    } else if (repo.name === "nix-coreblow") {
      const matches = text.match(/version\s*=\s*"([^"]+)"/g) ?? [];
      if (matches.length === 0 || matches.some((m) => !m.includes(`"${canonicalVersion}"`))) {
        return `drift:${rel}`;
      }
    } else if (!text.includes(canonicalVersion)) {
      return `drift:${rel}`;
    }
  }
  return `v${canonicalVersion}`;
}

function runStatus() {
  const manifest = loadFleetManifest();
  const rootPkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"));
  const canonicalVersion = rootPkg.version;
  const activeRepos = manifest.repositories.filter((r) => r.status === "active");

  console.log(`=== CoreBlow Satellite Fleet Status (Canonical v${canonicalVersion}) ===`);
  console.log(
    "Repository".padEnd(20) +
      "Tier".padEnd(14) +
      "Vis".padEnd(9) +
      "Branch/SHA".padEnd(18) +
      "State".padEnd(9) +
      "Sync",
  );
  console.log("─".repeat(82));

  let syncErrors = 0;
  let presentCount = 0;
  for (const repo of activeRepos) {
    const dir = resolveCheckoutDir(repo);
    const exists = Boolean(dir && fs.existsSync(dir));
    if (!exists) {
      console.log(
        repo.name.padEnd(20) +
          repo.tier.padEnd(14) +
          repo.visibility.padEnd(9) +
          "-".padEnd(18) +
          "absent".padEnd(9) +
          "n/a",
      );
      continue;
    }

    presentCount++;
    let branchSha = "non-git";
    let state = "unknown";
    try {
      const branch = runGit(dir, ["rev-parse", "--abbrev-ref", "HEAD"]);
      const sha = runGit(dir, ["rev-parse", "--short", "HEAD"]);
      const dirtyLines = runGit(dir, ["status", "--porcelain"])
        .split("\n")
        .filter((l) => l && !l.endsWith(".DS_Store"));
      branchSha = `${branch}@${sha}`;
      state = dirtyLines.length === 0 ? "clean" : `dirty(${dirtyLines.length})`;
    } catch {
      // Ignore git metadata failures on non-git fixtures
    }

    const syncState = checkVersionSync(repo, dir, canonicalVersion);
    if (syncState.startsWith("drift:") || syncState.startsWith("missing:")) {
      syncErrors++;
    }

    console.log(
      repo.name.padEnd(20) +
        repo.tier.padEnd(14) +
        repo.visibility.padEnd(9) +
        branchSha.padEnd(18) +
        state.padEnd(9) +
        syncState,
    );
  }

  const pubCount = activeRepos.filter((r) => r.visibility === "public").length;
  const privCount = activeRepos.filter((r) => r.visibility === "private").length;
  console.log(
    `\nActive manifest repos: ${activeRepos.length} (${pubCount} public, ${privCount} private) | Present locally: ${presentCount}/${activeRepos.length}`,
  );
  if (syncErrors > 0) {
    console.error(`FAIL: ${syncErrors} distribution sync misalignment(s) detected.`);
    return 1;
  }
  return 0;
}

function validateManifestSchema(manifest) {
  const required = [
    "name",
    "tier",
    "status",
    "visibility",
    "toolchain",
    "binary",
    "siblingDir",
    "releaseWorkflow",
    "syncVersion",
    "testCommand",
  ];
  const seen = new Set();
  for (const repo of manifest.repositories ?? []) {
    for (const key of required) {
      if (!(key in repo)) {
        throw new Error(`Manifest repo '${repo.name ?? "unknown"}' missing field '${key}'`);
      }
    }
    if (seen.has(repo.name)) {
      throw new Error(`Duplicate repository entry in fleet-manifest.json: ${repo.name}`);
    }
    seen.add(repo.name);
  }
}

function runVerify(localOnly) {
  const manifest = loadFleetManifest();
  validateManifestSchema(manifest);
  console.log(
    `[fleet-verify] Manifest schema verified (${manifest.repositories.length} active repositories, localOnly=${localOnly}).`,
  );

  const gateArgs = localOnly ? ["--local-only"] : [];
  const gates = [
    path.join(REPO_ROOT, "scripts/check-ecosystem-contracts.mjs"),
    path.join(REPO_ROOT, "scripts/check-fleet-supply-chain.mjs"),
  ];

  for (const scriptPath of gates) {
    const res = spawnSync(process.execPath, [scriptPath, ...gateArgs], {
      cwd: REPO_ROOT,
      stdio: "inherit",
      env: process.env,
    });
    if ((res.status ?? 1) !== 0) {
      return res.status ?? 1;
    }
  }
  return 0;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
) {
  const args = process.argv.slice(2);
  const subcommand = args.find((a) => !a.startsWith("-")) ?? "status";
  const localOnly = args.includes("--local-only");

  if (subcommand === "status") {
    process.exit(runStatus());
  } else if (subcommand === "verify") {
    process.exit(runVerify(localOnly));
  } else {
    console.error(
      `Unknown fleet subcommand '${subcommand}'. Supported in Phase 1B: status, verify [--local-only]`,
    );
    process.exit(1);
  }
}
