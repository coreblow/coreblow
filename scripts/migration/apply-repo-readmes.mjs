#!/usr/bin/env node
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const manifestPath = path.join(__dirname, "repo-family.manifest.json");
const splitRoot = "/Users/febrinanda/coreblow-split";
const manifest = JSON.parse(await readFile(manifestPath, "utf-8"));

const args = new Set(process.argv.slice(2));
const applySeeds = args.has("--seeds");
const applySplit = args.has("--split");
const apply = applySeeds || applySplit;
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

const detailByKind = {
  ansible: {
    role: "Hardened host automation for installing and operating CoreBlow on managed servers.",
    scope: [
      "Ansible playbooks, inventories, and host bootstrap defaults.",
      "Repeatable server setup for self-hosted CoreBlow deployments.",
      "Operational checks that can run before a production install.",
    ],
    outOfScope: ["CoreBlow runtime source code.", "Provider credentials or host-specific inventory values."],
  },
  automation: {
    role: "Maintenance automation for reviewing, planning, and landing focused CoreBlow fixes.",
    scope: [
      "Patch planning primitives.",
      "Repository maintenance workflows.",
      "Small automation contracts that can be tested outside the core runtime.",
    ],
    outOfScope: ["Release publishing.", "Direct changes to the CoreBlow runtime."],
  },
  benchmark: {
    role: "Benchmark harness for measuring CoreBlow behavior across releases.",
    scope: [
      "Score calculation contracts.",
      "Benchmark input and output conventions.",
      "Regression-friendly quality measurements.",
    ],
    outOfScope: ["Synthetic marketing numbers.", "Production telemetry storage."],
  },
  chat: {
    role: "Standalone chat application surface for CoreBlow workflows.",
    scope: [
      "Chat-facing command and session primitives.",
      "Application-specific integration tests.",
      "A small runtime surface that can evolve outside the core repository.",
    ],
    outOfScope: ["Core gateway protocol ownership.", "Provider-specific secret handling."],
  },
  community: {
    role: "Public community operating model for CoreBlow contributors and maintainers.",
    scope: [
      "Contributor roles and onboarding.",
      "Community rules and incident response references.",
      "Governance documentation that should stay separate from runtime code.",
    ],
    outOfScope: ["Security vulnerability intake.", "Core runtime implementation."],
  },
  contacts: {
    role: "Contacts and identity surface for CoreBlow applications.",
    scope: [
      "Identity data structures.",
      "Contact-oriented workflows.",
      "Application tests for the contact surface.",
    ],
    outOfScope: ["Credential storage.", "Messaging provider transport code."],
  },
  "ci-infra": {
    role: "Clean-room validation runner for CoreBlow repositories and release checks.",
    scope: [
      "Bounded command planning.",
      "Workspace preparation contracts.",
      "CI-friendly validation behavior.",
    ],
    outOfScope: ["Long-lived production agents.", "Provider-specific runtime logic."],
  },
  "control-plane": {
    role: "Local desktop control plane for CoreBlow companion applications.",
    scope: [
      "Menu bar and desktop interaction primitives.",
      "Local-first app coordination patterns.",
      "Swift package contracts for the control surface.",
    ],
    outOfScope: ["Core gateway ownership.", "Cloud-hosted management surfaces."],
  },
  directory: {
    role: "Public directory for CoreBlow skills, plugins, and ecosystem metadata.",
    scope: [
      "Catalog entries.",
      "Directory validation.",
      "Compatibility metadata for CoreBlow releases.",
    ],
    outOfScope: [
      "Bundled plugin source code.",
      "A package registry mirror.",
      "A replacement for `coreblow/coreblow` `extensions/*`.",
    ],
  },
  distribution: {
    role: "Distribution metadata for installing CoreBlow through platform package managers.",
    scope: [
      "Package index definitions.",
      "Installer metadata review.",
      "Distribution checks that can run independently from the core runtime.",
    ],
    outOfScope: ["Version bumps without release approval.", "Runtime source code changes."],
  },
  documentation: {
    role: "Published documentation surface for CoreBlow users and operators.",
    scope: [
      "Docs site content.",
      "Link and glossary checks.",
      "Public guidance for installation, configuration, and operations.",
    ],
    outOfScope: ["Product runtime code.", "Personal machine paths or private hostnames."],
  },
  embedded: {
    role: "Embedded node companion for CoreBlow environments.",
    scope: [
      "Embedded node contracts.",
      "Device-facing examples.",
      "Hardware-adjacent integration notes.",
    ],
    outOfScope: ["Core runtime releases.", "Device secrets or production credentials."],
  },
  examples: {
    role: "Example applications and recipes for CoreBlow SDK users.",
    scope: [
      "Small recipes that demonstrate SDK usage.",
      "Runnable examples with direct tests.",
      "Contributor-friendly patterns for ecosystem authors.",
    ],
    outOfScope: ["Reference-only examples that cannot be tested.", "Private customer recipes."],
  },
  library: {
    role: "Shared local-first toolkit for CoreBlow applications.",
    scope: [
      "Reusable library primitives.",
      "Small API contracts for companion apps.",
      "Tests that protect SDK-facing behavior.",
    ],
    outOfScope: ["Application-specific UI.", "Core runtime process ownership."],
  },
  measurement: {
    role: "Round-trip timing measurement surface for CoreBlow releases.",
    scope: [
      "RTT measurement scripts.",
      "Release comparison data.",
      "Small checks that make timing regressions visible.",
    ],
    outOfScope: ["Production monitoring storage.", "Benchmark claims without reproducible data."],
  },
  nix: {
    role: "Nix packaging for CoreBlow.",
    scope: [
      "Nix flake definitions.",
      "Package reproducibility checks.",
      "Installer integration for Nix-based operators.",
    ],
    outOfScope: ["Release version changes without approval.", "Non-Nix installer behavior."],
  },
  "nix-tools": {
    role: "Nix helper tools for CoreBlow development and operations.",
    scope: [
      "Tooling flakes.",
      "Developer environment helpers.",
      "Nix-specific validation surfaces.",
    ],
    outOfScope: ["Core runtime source ownership.", "Non-Nix package manager metadata."],
  },
  platform: {
    role: "Platform companion code for CoreBlow environments.",
    scope: [
      "Platform-specific integration files.",
      "Companion node contracts.",
      "Checks that keep the platform surface buildable.",
    ],
    outOfScope: ["Core runtime releases.", "Cross-platform feature policy."],
  },
  "plugin-fixture": {
    role: "Compatibility testbed for CoreBlow community plugins.",
    scope: [
      "Plugin manifest validation.",
      "Compatibility fixtures.",
      "Ecosystem test cases outside the core runtime.",
    ],
    outOfScope: ["Bundled plugin source ownership.", "A public plugin registry."],
  },
  policy: {
    role: "Trust, security, and safety policy surface for CoreBlow.",
    scope: [
      "Threat categories.",
      "Security response expectations.",
      "Policy review workflows.",
    ],
    outOfScope: ["Runtime security implementation.", "Private incident data."],
  },
  reports: {
    role: "Public quality and performance report storage for CoreBlow.",
    scope: [
      "Report indexes.",
      "Report validation.",
      "Release-adjacent quality evidence.",
    ],
    outOfScope: ["Mutable production telemetry.", "Unreviewed benchmark claims."],
  },
  state: {
    role: "State storage for CoreBlow maintenance and triage automation.",
    scope: [
      "Small state indexes.",
      "Validation for automation state shape.",
      "Auditable storage contracts.",
    ],
    outOfScope: ["Runtime application state.", "Private issue or security data."],
  },
  website: {
    role: "Public website and install landing surface for CoreBlow.",
    scope: [
      "Website worker source.",
      "Install landing content.",
      "Public links to docs and the core repository.",
    ],
    outOfScope: ["Docs site content.", "Runtime package publishing."],
  },
  windows: {
    role: "Windows companion suite for CoreBlow.",
    scope: [
      "Windows node solution files.",
      "Platform-specific build contracts.",
      "Companion app integration points.",
    ],
    outOfScope: ["Non-Windows platform packages.", "Core runtime release ownership."],
  },
  workflow: {
    role: "Typed workflow shell for CoreBlow-native automation.",
    scope: [
      "Workflow parsing and validation.",
      "CLI-facing workflow contracts.",
      "Tests for deterministic workflow behavior.",
    ],
    outOfScope: ["Provider orchestration in the core runtime.", "Secrets or live account actions."],
  },
};

const titleByRepo = {
  community: "CoreBlow Community",
  cookbook: "CoreBlow Cookbook",
  corebar: "CoreBar",
  corebench: "CoreBench",
  "coreblow.com": "CoreBlow Website",
  "coreblow-ansible": "CoreBlow Ansible",
  "coreblow-rtt": "CoreBlow RTT",
  "coreblow-windows-node": "CoreBlow Windows Node",
  corebox: "CoreBox",
  corechat: "CoreChat",
  coredex: "CoreDex",
  "coregrit-reports": "CoreGrit Reports",
  corehub: "CoreHub",
  corekit: "CoreKit",
  corepatch: "CorePatch",
  corewatch: "CoreWatch",
  "corewatch-state": "CoreWatch State",
  docs: "CoreBlow Docs",
  dolphin: "Dolphin",
  "esp-coreblow-node": "ESP CoreBlow Node",
  "homebrew-tap": "Homebrew Tap",
  "nix-coreblow": "Nix CoreBlow",
  "nix-coreblow-tools": "Nix CoreBlow Tools",
  "plugin-lab": "Plugin Lab",
  trust: "CoreBlow Trust",
};

function titleCase(name) {
  return (
    titleByRepo[name] ??
    name
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(root) {
  const ignored = new Set([".build", ".git", ".wrangler", "dist", "node_modules", ".DS_Store"]);
  const entries = [];
  async function walk(current, depth) {
    if (depth > 2) {
      return;
    }
    for (const entry of await readdir(current, { withFileTypes: true })) {
      if (ignored.has(entry.name)) {
        continue;
      }
      const full = path.join(current, entry.name);
      const relative = path.relative(root, full);
      if (entry.isDirectory()) {
        await walk(full, depth + 1);
      } else {
        entries.push(relative);
      }
    }
  }
  await walk(root, 0);
  return entries.sort();
}

async function developmentCommands(root) {
  const commands = [];
  if (await exists(path.join(root, "package.json"))) {
    const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf-8"));
    if (pkg.scripts?.test) {
      commands.push(["Test", "npm test"]);
    }
    if (pkg.scripts?.["docs:check"]) {
      commands.push(["Docs check", "npm run docs:check"]);
    }
    if (pkg.scripts?.dev) {
      commands.push(["Develop", "npm run dev"]);
    }
    if (pkg.scripts?.deploy) {
      commands.push(["Deploy", "npm run deploy"]);
    }
  }
  if (await exists(path.join(root, "go.mod"))) {
    commands.push(["Test", "go test ./..."]);
  }
  if (await exists(path.join(root, "Package.swift"))) {
    commands.push(["Test", "swift test"]);
  }
  if (await exists(path.join(root, "flake.nix"))) {
    commands.push(["Check", "nix flake check"]);
  }
  if (await exists(path.join(root, "playbook.yml"))) {
    commands.push(["Syntax check", "ansible-playbook --syntax-check playbook.yml"]);
  }
  if (await exists(path.join(root, "CoreBlow.WindowsNode.sln"))) {
    commands.push(["Build", "dotnet build CoreBlow.WindowsNode.sln"]);
  }
  return commands;
}

function fencedCommand(command) {
  return ["```sh", command, "```"].join("\n");
}

function bulletList(items) {
  return items.map((item) => `- ${item}`).join("\n");
}

async function renderReadme(repo, root) {
  const detail = detailByKind[repo.kind] ?? detailByKind.platform;
  const files = (await listFiles(root))
    .filter((file) => file !== "README.md")
    .sort((a, b) => {
      const aGovernance = a.startsWith(".github/") || ["CONTRIBUTING.md", "LICENSE", "SECURITY.md"].includes(a);
      const bGovernance = b.startsWith(".github/") || ["CONTRIBUTING.md", "LICENSE", "SECURITY.md"].includes(b);
      if (aGovernance !== bGovernance) {
        return aGovernance ? 1 : -1;
      }
      return a.localeCompare(b);
    })
    .slice(0, 8);
  const commands = await developmentCommands(root);
  const sections = [
    `# ${titleCase(repo.name)}`,
    repo.description,
    "## Overview",
    `${titleCase(repo.name)} is part of the CoreBlow public repository family. ${detail.role}`,
    "This repository follows the same ecosystem split that CoreBlow uses to keep release surfaces small, auditable, and independently governed.",
    "## Repository Role",
    bulletList([
      `Phase: ${repo.phase}`,
      `Priority: ${repo.priority}`,
      `Kind: ${repo.kind}`,
      "Family: CoreBlow public repository family",
      "Branding: CoreBlow",
    ]),
    "## Scope",
    bulletList(detail.scope),
    "## Out of Scope",
    bulletList(detail.outOfScope),
    "## Key Files",
    bulletList(files.map((file) => `\`${file}\``)),
    "## Development",
    commands.length
      ? commands.map(([label, command]) => `### ${label}\n\n${fencedCommand(command)}`).join("\n\n")
      : "This seed does not define an automated development gate yet. Add one before expanding the repository surface.",
    "## Release Policy",
    "Do not publish packages, tags, installers, or release artifacts from this repository without explicit CoreBlow release approval.",
    "Version changes must follow the coordinated CoreBlow release plan.",
    "## Links",
    bulletList([
      "[CoreBlow](https://github.com/coreblow/coreblow)",
      "[Documentation](https://docs.coreblow.com)",
      "[Website](https://coreblow.com)",
      "[Security Policy](SECURITY.md)",
      "[Contributing](CONTRIBUTING.md)",
    ]),
  ];
  return `${sections.join("\n\n")}\n`;
}

function seedRoot(repo) {
  if (!repo.source || repo.source === "." || path.isAbsolute(repo.source)) {
    return null;
  }
  return path.resolve(repoRoot, repo.source);
}

function splitRepoRoot(repo) {
  return path.join(splitRoot, repo.name);
}

const repos = manifest.repositories.filter((repo) => repo.name !== "coreblow" && (!only || only.has(repo.name)));

console.log("CoreBlow repo README pass");
console.log(`mode=${apply ? "apply" : "dry-run"}`);
console.log(`repos=${repos.length}`);
console.log("");

for (const repo of repos) {
  const targets = [];
  if (applySeeds) {
    const root = seedRoot(repo);
    if (root && (await exists(root))) {
      targets.push(["seed", root]);
    }
  }
  if (applySplit) {
    const root = splitRepoRoot(repo);
    if (await exists(root)) {
      targets.push(["split", root]);
    }
  }
  if (!apply) {
    const root = seedRoot(repo) ?? splitRepoRoot(repo);
    targets.push(["dry-run", root]);
  }

  for (const [kind, root] of targets) {
    const readme = await renderReadme(repo, root);
    console.log(`- ${repo.name} ${kind} ${readme.split("\n").length} lines`);
    if (apply) {
      await writeFile(path.join(root, "README.md"), readme, "utf-8");
    }
  }
}
