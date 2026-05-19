#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const manifestPath = path.join(__dirname, "repo-family.manifest.json");

const args = new Set(process.argv.slice(2));
const outputJson = args.has("--json");
const requireAll = args.has("--require-all");

const manifest = JSON.parse(await readFile(manifestPath, "utf-8"));

function listRepos(owner) {
  const result = spawnSync(
    "gh",
    ["repo", "list", owner, "--limit", "200", "--json", "name,visibility,url,description"],
    {
      cwd: repoRoot,
      encoding: "utf-8",
    },
  );
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `gh repo list ${owner} failed`);
  }
  return JSON.parse(result.stdout);
}

const existing = new Map(listRepos(manifest.owner).map((repo) => [repo.name, repo]));
const reference = new Map(listRepos(manifest.referenceOwner).map((repo) => [repo.name, repo]));

const rows = manifest.repositories.map((repo) => {
  const actual = existing.get(repo.name);
  const referenceRepo = reference.get(repo.reference);
  return {
    phase: repo.phase,
    name: repo.name,
    reference: repo.reference,
    kind: repo.kind,
    priority: repo.priority,
    exists: Boolean(actual),
    referenceExists: Boolean(referenceRepo),
    url: actual?.url ?? null,
    description: actual?.description ?? repo.description ?? "",
  };
});

const missing = rows.filter((row) => !row.exists);
const missingReferences = rows.filter((row) => !row.referenceExists);

if (outputJson) {
  console.log(
    JSON.stringify(
      {
        owner: manifest.owner,
        referenceOwner: manifest.referenceOwner,
        pluginAggregatorRepo: manifest.policy.pluginAggregatorRepo,
        total: rows.length,
        existing: rows.length - missing.length,
        missing: missing.length,
        missingReferences: missingReferences.length,
        rows,
      },
      null,
      2,
    ),
  );
} else {
  console.log(`CoreBlow repo family audit`);
  console.log(`owner=${manifest.owner} reference=${manifest.referenceOwner}`);
  console.log(`policy.pluginAggregatorRepo=${manifest.policy.pluginAggregatorRepo}`);
  console.log(`existing=${rows.length - missing.length}/${rows.length}`);
  console.log("");
  console.log("| Phase | Repo | Reference | Status | Kind | Priority |");
  console.log("|:--|:--|:--|:--|:--|:--|");
  for (const row of rows.sort((a, b) => a.phase - b.phase || a.name.localeCompare(b.name))) {
    const status = row.exists ? "present" : "missing";
    const ref = row.referenceExists ? row.reference : `${row.reference} (reference missing)`;
    console.log(
      `| ${row.phase} | ${row.name} | ${ref} | ${status} | ${row.kind} | ${row.priority} |`,
    );
  }
}

if (missingReferences.length > 0) {
  console.error(
    `Reference mismatch: ${missingReferences.map((row) => row.reference).join(", ")}`,
  );
  process.exitCode = 1;
}

if (requireAll && missing.length > 0) {
  console.error(`Missing CoreBlow repos: ${missing.map((row) => row.name).join(", ")}`);
  process.exitCode = 1;
}
