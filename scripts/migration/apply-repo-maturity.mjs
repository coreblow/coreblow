#!/usr/bin/env node
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const manifestPath = path.join(__dirname, "repo-family.manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

const args = new Set(process.argv.slice(2));
const writeSeeds = args.has("--seeds");
const writeSplit = args.has("--split");
const force = args.has("--force");

if (!writeSeeds && !writeSplit) {
  console.error("Usage: node scripts/migration/apply-repo-maturity.mjs [--seeds] [--split] [--force]");
  process.exit(2);
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function titleCase(input) {
  return input
    .split(/[-_\s]+/g)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function displayName(repo) {
  const names = {
    "coreblow.com": "CoreBlow.com",
    "coreblow-rtt": "CoreBlow RTT",
    "coreblow-windows-node": "CoreBlow Windows Node",
    "esp-coreblow-node": "ESP CoreBlow Node",
    "coreblow-ansible": "CoreBlow Ansible",
    "homebrew-tap": "CoreBlow Homebrew Tap",
    "nix-coreblow": "Nix CoreBlow",
    "nix-coreblow-tools": "Nix CoreBlow Tools",
  };
  return names[repo.name] ?? titleCase(repo.name).replace(/^Core/, "Core");
}

function maturityFiles(repo) {
  const name = displayName(repo);
  const repoUrl = `https://github.com/${manifest.owner}/${repo.name}`;
  const contributing = repo.name === "trust"
    ? [
        "# Contributing",
        "",
        "Trust policy changes should be:",
        "",
        "- Specific about risk and affected surfaces.",
        "- Written without private user or customer data.",
        "- Reviewed by maintainers before publication.",
        "",
      ].join("\n")
    : [
        `# Contributing to ${name}`,
        "",
        "Thank you for helping improve CoreBlow.",
        "",
        "## Expectations",
        "",
        "- Keep changes scoped and reviewable.",
        "- Use CoreBlow branding in docs and examples.",
        "- Do not change versions, tags, or release metadata unless a maintainer explicitly asks.",
        "- Do not commit secrets, phone numbers, private hostnames, or live configuration.",
        "- Prefer tests or validation commands that match this repository's CI.",
        "",
        "## Pull Requests",
        "",
        "Open a focused pull request with a short summary, validation evidence, and any known follow-up work.",
        "",
      ].join("\n");
  return new Map([
    [
      ".github/CODEOWNERS",
      [
        "# CoreBlow Code Owners",
        "",
        "* @febrinanda",
        "",
        "# Security-sensitive surfaces",
        "SECURITY.md @febrinanda",
        ".github/workflows/ @febrinanda",
        ".github/dependabot.yml @febrinanda",
        "",
      ].join("\n"),
    ],
    [
      "SECURITY.md",
      [
        `# Security Policy`,
        "",
        `${name} follows the CoreBlow security policy.`,
        "",
        "## Reporting",
        "",
        "Do not open a public issue for secrets, credential exposure, or exploitable behavior.",
        "Report sensitive findings privately to the CoreBlow maintainers.",
        "",
        "## Scope",
        "",
        `- Repository: ${repoUrl}`,
        "- Product: CoreBlow",
        "- Public runtime secrets, phone numbers, private hostnames, and live credentials are never acceptable in issues, examples, or tests.",
        "",
      ].join("\n"),
    ],
    [
      "CONTRIBUTING.md",
      contributing,
    ],
    [
      ".github/pull_request_template.md",
      [
        "## Summary",
        "",
        "- TODO",
        "",
        "## Validation",
        "",
        "- [ ] CI passes",
        "- [ ] Relevant local checks were run",
        "- [ ] No secrets, private paths, phone numbers, or live configuration were added",
        "",
        "## Notes",
        "",
        "- TODO",
        "",
      ].join("\n"),
    ],
    [
      ".github/ISSUE_TEMPLATE/bug_report.yml",
      [
        "name: Bug report",
        "description: Report a focused CoreBlow issue",
        "title: \"[Bug]: \"",
        "labels: [bug]",
        "body:",
        "  - type: textarea",
        "    id: summary",
        "    attributes:",
        "      label: Summary",
        "      description: What happened?",
        "    validations:",
        "      required: true",
        "  - type: textarea",
        "    id: expected",
        "    attributes:",
        "      label: Expected behavior",
        "    validations:",
        "      required: true",
        "  - type: textarea",
        "    id: validation",
        "    attributes:",
        "      label: Validation",
        "      description: Commands, logs, or CI links. Do not include secrets or private data.",
        "    validations:",
        "      required: false",
        "",
      ].join("\n"),
    ],
    [
      ".github/ISSUE_TEMPLATE/config.yml",
      [
        "blank_issues_enabled: true",
        "contact_links:",
        "  - name: Security report",
        "    url: https://github.com/coreblow/trust",
        "    about: Report sensitive findings through the CoreBlow trust process.",
        "",
      ].join("\n"),
    ],
  ]);
}

function dependabotFile() {
  return [
    "version: 2",
    "updates:",
    "  - package-ecosystem: github-actions",
    "    directory: /",
    "    schedule:",
    "      interval: weekly",
    "    labels:",
    "      - dependencies",
    "",
  ].join("\n");
}

function seedTarget(repo) {
  if (!repo.source || repo.source === "." || path.isAbsolute(repo.source)) {
    return null;
  }
  return path.resolve(repoRoot, repo.source);
}

function splitTarget(repo) {
  return path.resolve("/Users/febrinanda/coreblow-split", repo.name);
}

async function writeMaturityFile(root, filePath, contents) {
  const target = path.join(root, filePath);
  if (!force && await exists(target)) {
    return false;
  }
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, contents, "utf8");
  return true;
}

const writes = [];
for (const repo of manifest.repositories) {
  if (repo.name === "coreblow") {
    continue;
  }
  const files = maturityFiles(repo);
  const roots = [];
  if (writeSeeds) {
    const target = seedTarget(repo);
    if (target && await exists(target)) {
      roots.push(["seed", target]);
    }
  }
  if (writeSplit) {
    const target = splitTarget(repo);
    if (await exists(target)) {
      roots.push(["split", target]);
    }
  }

  for (const [kind, root] of roots) {
    for (const [filePath, contents] of files) {
      const changed = await writeMaturityFile(root, filePath, contents);
      if (changed) {
        writes.push(`${kind}:${repo.name}:${filePath}`);
      }
    }
    const dependabotPath = ".github/dependabot.yml";
    if (await exists(path.join(root, ".github/workflows"))) {
      const changed = await writeMaturityFile(root, dependabotPath, dependabotFile());
      if (changed) {
        writes.push(`${kind}:${repo.name}:${dependabotPath}`);
      }
    } else if (force && await exists(path.join(root, dependabotPath))) {
      await rm(path.join(root, dependabotPath));
      writes.push(`${kind}:${repo.name}:removed:${dependabotPath}`);
    }
  }
}

console.log(`Wrote ${writes.length} maturity files.`);
for (const write of writes) {
  console.log(write);
}
