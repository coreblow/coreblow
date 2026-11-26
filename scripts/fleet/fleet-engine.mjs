#!/usr/bin/env node
/** CoreBlow — Satellite Fleet Engine (dev/CI tooling; never import from runtime src/** or packages/**). */
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const MANIFEST_PATH = path.join(__dirname, "fleet-manifest.json");
const DEFAULT_SPLIT_ROOT = path.resolve(REPO_ROOT, "../coreblow-split");

const SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const SHA256_HEX_RE = /^[a-f0-9]{64}$/;
const SRI_SHA256_RE = /^sha256-[A-Za-z0-9+/=]+$/;

export const loadFleetManifest = () => JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));

function resolveCheckoutDir(repo, splitRoot = DEFAULT_SPLIT_ROOT) {
  if (repo.name === "coreblow") return REPO_ROOT;
  if (repo.tier === "internal") return path.resolve(REPO_ROOT, "..", repo.name);
  return repo.siblingDir ? path.join(splitRoot, repo.siblingDir) : null;
}

function runGit(cwd, args) {
  return execFileSync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function checkVersionSync(repo, checkoutDir, canonicalVersion) {
  if (!repo.syncVersion || repo.name === "coreblow" || !canonicalVersion) return "n/a";
  const files = repo.syncFiles ?? [];
  if (files.length === 0) return "n/a";
  for (const rel of files) {
    const full = path.join(checkoutDir, rel);
    if (!fs.existsSync(full)) return `missing:${rel}`;
    const text = fs.readFileSync(full, "utf8");
    if (repo.name === "homebrew-tap") {
      if (!text.includes(`coreblow-${canonicalVersion}.tgz`)) return `drift:${rel}`;
    } else if (repo.name === "nix-coreblow") {
      const m = text.match(/version\s*=\s*"([^"]+)"/g) ?? [];
      if (m.length === 0 || m.some((x) => !x.includes(`"${canonicalVersion}"`)))
        return `drift:${rel}`;
    } else if (!text.includes(canonicalVersion)) {
      return `drift:${rel}`;
    }
  }
  return `v${canonicalVersion}`;
}

const COL_WIDTHS = [20, 14, 9, 18, 9, 0];
const formatRow = (...cols) =>
  cols.map((c, i) => (COL_WIDTHS[i] ? c.padEnd(COL_WIDTHS[i]) : c)).join("");

function runStatus() {
  const manifest = loadFleetManifest();
  const canonicalVersion = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"),
  ).version;
  const activeRepos = manifest.repositories.filter((r) => r.status === "active");
  console.log(`=== CoreBlow Satellite Fleet Status (Canonical v${canonicalVersion}) ===`);
  console.log(formatRow("Repository", "Tier", "Vis", "Branch/SHA", "State", "Sync"));
  console.log("─".repeat(82));

  let syncErrors = 0;
  let presentCount = 0;
  for (const repo of activeRepos) {
    const dir = resolveCheckoutDir(repo);
    if (!dir || !fs.existsSync(dir)) {
      console.log(formatRow(repo.name, repo.tier, repo.visibility, "-", "absent", "n/a"));
      continue;
    }
    presentCount++;
    let branchSha = "non-git";
    let state = "unknown";
    try {
      const branch = runGit(dir, ["rev-parse", "--abbrev-ref", "HEAD"]);
      const sha = runGit(dir, ["rev-parse", "--short", "HEAD"]);
      const dirty = runGit(dir, ["status", "--porcelain"])
        .split("\n")
        .filter((l) => l && !l.endsWith(".DS_Store"));
      branchSha = `${branch}@${sha}`;
      state = dirty.length === 0 ? "clean" : `dirty(${dirty.length})`;
    } catch {
      /* non-git fixture */
    }

    const syncState = checkVersionSync(repo, dir, canonicalVersion);
    if (syncState.startsWith("drift:") || syncState.startsWith("missing:")) syncErrors++;
    console.log(formatRow(repo.name, repo.tier, repo.visibility, branchSha, state, syncState));
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
  const required =
    "name,tier,status,visibility,toolchain,binary,siblingDir,releaseWorkflow,syncVersion,testCommand".split(
      ",",
    );
  const seen = new Set();
  for (const repo of manifest.repositories ?? []) {
    for (const key of required) {
      if (!(key in repo))
        throw new Error(`Manifest repo '${repo.name ?? "unknown"}' missing field '${key}'`);
    }
    if (seen.has(repo.name))
      throw new Error(`Duplicate repository entry in fleet-manifest.json: ${repo.name}`);
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
  for (const rel of [
    "scripts/check-ecosystem-contracts.mjs",
    "scripts/check-fleet-supply-chain.mjs",
  ]) {
    const res = spawnSync(process.execPath, [path.join(REPO_ROOT, rel), ...gateArgs], {
      cwd: REPO_ROOT,
      stdio: "inherit",
      env: process.env,
    });
    if ((res.status ?? 1) !== 0) return res.status ?? 1;
  }
  return 0;
}

const SYNC_RULES = {
  "coreblow.com:install": ({ version }) => [
    [
      /Sovereign Autonomous Agent-OS · v[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)? GA/g,
      `Sovereign Autonomous Agent-OS · v${version} GA`,
      1,
    ],
    [
      /COREBLOW_VERSION="\$\{COREBLOW_VERSION:-[^}]+\}"/g,
      `COREBLOW_VERSION="\${COREBLOW_VERSION:-${version}}"`,
      1,
    ],
  ],
  "coreblow.com:src/index.js": ({ version }) => [
    [/(CoreBlow\s+)v[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?/g, `$1v${version}`, 1],
    [/v[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?=\s+GA\b)/g, `v${version}`, 1],
  ],
  "homebrew-tap:Formula/coreblow.rb": ({ version, sha256 }) => [
    [
      /url "https:\/\/registry\.npmjs\.org\/coreblow\/-\/coreblow-[^"]+\.tgz"/g,
      `url "https://registry.npmjs.org/coreblow/-/coreblow-${version}.tgz"`,
      1,
    ],
    [/sha256 "[a-f0-9]{64}"/g, `sha256 "${sha256}"`, 1],
  ],
  "nix-coreblow:flake.nix": ({ version, sri }) => [
    [/version = "[^"]+";/g, `version = "${version}";`, 2],
    [/sha256 = "(?:sha256-[A-Za-z0-9+/=]+|[a-f0-9]{64})";/g, `sha256 = "${sri}";`, 1],
  ],
};

function applySyncRules(repoName, relPath, text, params) {
  const key =
    repoName === "coreblow.com" &&
    (relPath === "public/install.sh" || relPath === "public/install-cli.sh")
      ? "coreblow.com:install"
      : `${repoName}:${relPath}`;
  const getRules = SYNC_RULES[key];
  if (!getRules) throw new Error(`Unsupported sync target '${repoName}/${relPath}'`);
  let next = text;
  for (const [re, replacement, minCount] of getRules(params)) {
    const matches = next.match(re) ?? [];
    if (matches.length < minCount) {
      throw new Error(
        `Pattern mismatch in ${repoName}/${relPath} for ${re.source} (expected >=${minCount}, found ${matches.length})`,
      );
    }
    next = next.replace(re, replacement);
  }
  return next;
}

export function syncFleet({
  version,
  sha256,
  sri,
  dryRun = false,
  splitRoot = DEFAULT_SPLIT_ROOT,
}) {
  if (!version || !SEMVER_RE.test(version))
    throw new Error(
      `Invalid --version '${version ?? ""}': expected SemVer X.Y.Z without leading 'v'`,
    );
  if (!sha256 || !SHA256_HEX_RE.test(sha256))
    throw new Error(`Invalid --sha256 '${sha256 ?? ""}': expected 64 lowercase hex characters`);
  if (!sri || !SRI_SHA256_RE.test(sri))
    throw new Error(`Invalid --sri '${sri ?? ""}': expected 'sha256-<base64>' SRI digest`);

  const manifest = loadFleetManifest();
  const targets = (manifest.repositories ?? []).filter(
    (r) => r.status === "active" && r.syncVersion && r.name !== "coreblow",
  );
  const planned = [];

  for (const repo of targets) {
    const dir = resolveCheckoutDir(repo, splitRoot);
    if (!dir || !fs.existsSync(dir))
      throw new Error(`Target satellite '${repo.name}' not found at ${dir}`);
    const relFiles = [...(repo.syncFiles ?? [])];
    if (repo.name === "coreblow.com" && fs.existsSync(path.join(dir, "src/index.js")))
      relFiles.push("src/index.js");
    for (const relPath of relFiles) {
      const fullPath = path.join(dir, relPath);
      if (!fs.existsSync(fullPath))
        throw new Error(`Missing sync file '${repo.name}/${relPath}' at ${fullPath}`);
      const prev = fs.readFileSync(fullPath, "utf8");
      const next = applySyncRules(repo.name, relPath, prev, { version, sha256, sri });
      planned.push({ repo: repo.name, relPath, fullPath, changed: prev !== next, next });
    }
  }
  if (!dryRun) {
    for (const item of planned)
      if (item.changed) fs.writeFileSync(item.fullPath, item.next, "utf8");
  }
  return planned;
}

export function parseSyncArgs(args) {
  const opts = { version: "", sha256: "", sri: "", dryRun: false, splitRoot: DEFAULT_SPLIT_ROOT };
  const keys = {
    "--version": "version",
    "--sha256": "sha256",
    "--sri": "sri",
    "--split-root": "splitRoot",
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--dry-run") {
      opts.dryRun = true;
      continue;
    }
    const eqIdx = a.indexOf("=");
    const flag = eqIdx === -1 ? a : a.slice(0, eqIdx);
    const key = keys[flag];
    if (!key) continue;
    const val = eqIdx === -1 ? (args[++i] ?? "") : a.slice(eqIdx + 1);
    opts[key] = key === "splitRoot" ? path.resolve(val) : val;
  }
  return opts;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
) {
  const args = process.argv.slice(2);
  const subcommand = args.find((a) => !a.startsWith("-")) ?? "status";
  if (subcommand === "status") process.exit(runStatus());
  else if (subcommand === "verify") process.exit(runVerify(args.includes("--local-only")));
  else if (subcommand === "sync") {
    try {
      const opts = parseSyncArgs(args);
      const planned = syncFleet(opts);
      const prefix = opts.dryRun ? "[fleet-sync dry-run]" : "[fleet-sync]";
      for (const item of planned)
        console.log(
          `${prefix} ${item.repo}/${item.relPath}: ${item.changed ? "update" : "unchanged"}`,
        );
      process.exit(0);
    } catch (err) {
      console.error(`[fleet-sync] ERROR: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  } else {
    console.error(
      `Unknown fleet subcommand '${subcommand}'. Supported: status, verify [--local-only], sync`,
    );
    process.exit(1);
  }
}
