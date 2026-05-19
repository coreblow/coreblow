#!/usr/bin/env node
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const manifestPath = path.join(__dirname, "repo-family.manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf-8"));

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const onlyArg = process.argv.find((arg) => arg.startsWith("--only="));
const only = onlyArg
  ? new Set(
      onlyArg
        .slice("--only=".length)
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean),
    )
  : null;

const owner = manifest.owner;
const baseTopics = [
  "coreblow",
  "ai-assistant",
  "enterprise-ai",
  "local-first",
  "open-source",
];

const labels = [
  ["area: ci", "5319e7", "CI and automation changes"],
  ["area: docs", "5319e7", "Documentation changes"],
  ["area: release", "5319e7", "Release and distribution changes"],
  ["area: security", "b60205", "Security-sensitive changes"],
  ["area: governance", "c2e0c6", "Community, policy, and trust changes"],
  ["area: plugins", "5319e7", "Plugin runtime, SDK, or ecosystem changes"],
  ["type: bug", "d73a4a", "Something is not working"],
  ["type: dependency", "0366d6", "Dependency update or dependency maintenance"],
  ["type: docs", "0075ca", "Documentation-only change"],
  ["type: feature", "a2eeef", "New feature or request"],
  ["type: maintenance", "cfd3d7", "Maintenance, cleanup, or refactor"],
  ["priority: foundation", "fbca04", "Foundation repository priority"],
  ["priority: ecosystem", "0e8a16", "Ecosystem repository priority"],
  ["priority: platform", "1d76db", "Platform repository priority"],
  ["priority: quality", "5319e7", "Quality repository priority"],
  ["priority: distribution", "c5def5", "Distribution repository priority"],
  ["priority: governance", "c2e0c6", "Governance repository priority"],
  ["status: blocked", "b60205", "Blocked by an external dependency or decision"],
  ["status: needs-triage", "ededed", "Needs maintainer triage"],
];

function runGh(args, options = {}) {
  const result = spawnSync("gh", args, {
    cwd: repoRoot,
    encoding: "utf-8",
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(
      [`gh ${args.join(" ")} failed`, result.stdout.trim(), result.stderr.trim()]
        .filter(Boolean)
        .join("\n"),
    );
  }
  return result.stdout;
}

function repoTopics(repo) {
  return [
    ...baseTopics,
    `phase-${repo.phase}`,
    `priority-${repo.priority}`,
    `kind-${repo.kind}`,
  ]
    .map((topic) => topic.toLowerCase().replace(/[^a-z0-9-]/g, "-"))
    .filter((topic, index, topics) => topic.length <= 50 && topics.indexOf(topic) === index);
}

function homepageFor(repo) {
  if (repo.name === "coreblow") {
    return "https://coreblow.com";
  }
  if (repo.name === "docs") {
    return "https://docs.coreblow.com";
  }
  if (repo.name === "coreblow.com") {
    return "https://coreblow.com";
  }
  return "";
}

async function withJsonInput(payload, callback) {
  const dir = await mkdtemp(path.join(tmpdir(), "coreblow-gh-"));
  const file = path.join(dir, "payload.json");
  try {
    await writeFile(file, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
    return callback(file);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function putTopics(repo) {
  const payload = { names: repoTopics(repo) };
  await withJsonInput(payload, (file) =>
    runGh([
      "api",
      "-X",
      "PUT",
      `repos/${owner}/${repo.name}/topics`,
      "-H",
      "Accept: application/vnd.github+json",
      "--input",
      file,
    ]),
  );
}

function repoEditArgs(repo) {
  const args = [
    "repo",
    "edit",
    `${owner}/${repo.name}`,
    "--description",
    repo.description,
    "--enable-issues",
    "--enable-projects=false",
    "--enable-wiki=false",
    "--delete-branch-on-merge",
    "--enable-squash-merge",
    "--enable-rebase-merge",
    "--enable-merge-commit=false",
  ];
  const homepage = homepageFor(repo);
  if (homepage) {
    args.push("--homepage", homepage);
  }
  return args;
}

function existingRulesets(repo) {
  return JSON.parse(
    runGh([
      "api",
      `repos/${owner}/${repo.name}/rulesets`,
      "-H",
      "Accept: application/vnd.github+json",
    ]),
  );
}

async function ensureMainRuleset(repo) {
  const payload = {
    name: "Protect main",
    target: "branch",
    enforcement: "active",
    conditions: {
      ref_name: {
        include: ["~DEFAULT_BRANCH"],
        exclude: [],
      },
    },
    rules: [
      { type: "deletion" },
      { type: "non_fast_forward" },
      { type: "required_linear_history" },
    ],
  };
  const current = existingRulesets(repo).find(
    (ruleset) => ruleset.name === payload.name && ruleset.target === payload.target,
  );
  await withJsonInput(payload, (file) => {
    if (current) {
      return runGh([
        "api",
        "-X",
        "PUT",
        `repos/${owner}/${repo.name}/rulesets/${current.id}`,
        "-H",
        "Accept: application/vnd.github+json",
        "--input",
        file,
      ]);
    }
    return runGh([
      "api",
      "-X",
      "POST",
      `repos/${owner}/${repo.name}/rulesets`,
      "-H",
      "Accept: application/vnd.github+json",
      "--input",
      file,
    ]);
  });
}

function ensureLabel(repo, [name, color, description]) {
  runGh([
    "label",
    "create",
    name,
    "--repo",
    `${owner}/${repo.name}`,
    "--color",
    color,
    "--description",
    description,
    "--force",
  ]);
}

const repos = manifest.repositories.filter((repo) => !only || only.has(repo.name));
if (repos.length === 0) {
  throw new Error("No repositories selected.");
}

console.log(`CoreBlow GitHub metadata pass`);
console.log(`owner=${owner}`);
console.log(`mode=${apply ? "apply" : "dry-run"}`);
console.log(`repos=${repos.length}`);
console.log("");

for (const repo of repos) {
  const topics = repoTopics(repo).join(", ");
  console.log(`- ${repo.name}`);
  console.log(`  description: ${repo.description}`);
  console.log(`  homepage: ${homepageFor(repo) || "(unchanged)"}`);
  console.log(`  topics: ${topics}`);
  console.log(`  labels: ${labels.length}`);
  console.log(`  ruleset: Protect main`);

  if (!apply) {
    continue;
  }

  runGh(repoEditArgs(repo));
  await putTopics(repo);
  for (const label of labels) {
    ensureLabel(repo, label);
  }
  await ensureMainRuleset(repo);
}
