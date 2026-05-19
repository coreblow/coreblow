#!/usr/bin/env node
import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const manifestPath = path.join(__dirname, "repo-family.manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf-8"));

const args = process.argv.slice(2);
const repoName = args[0];
const force = args.includes("--force");

if (!repoName) {
  console.error("Usage: node scripts/migration/seed-satellite-repo.mjs <repo-name> [--force]");
  process.exit(2);
}

const repo = manifest.repositories.find((entry) => entry.name === repoName);
if (!repo) {
  console.error(`Unknown repo in manifest: ${repoName}`);
  process.exit(2);
}
if (!repo.source || repo.source === ".") {
  console.error(`Repo ${repoName} does not declare a seedable source path.`);
  process.exit(2);
}

const sourceRoot = path.resolve(repo.source);
const targetRoot = path.resolve("/Users/febrinanda/coreblow-split", repoName);

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

const ignoredNames = new Set([
  ".DS_Store",
  ".git",
  ".wrangler",
  "node_modules",
  ...(Array.isArray(repo.seedIgnore) ? repo.seedIgnore : []),
]);

const filter = (source) => {
  const base = path.basename(source);
  return !ignoredNames.has(base);
};

if (await exists(targetRoot)) {
  if (!force) {
    console.error(`Refusing to overwrite existing target without --force: ${targetRoot}`);
    process.exit(2);
  }
  await rm(targetRoot, { recursive: true, force: true });
}

await mkdir(path.dirname(targetRoot), { recursive: true });
await cp(sourceRoot, targetRoot, {
  recursive: true,
  filter,
});

const gitignorePath = path.join(targetRoot, ".gitignore");
const gitignore = [
  "node_modules/",
  ".wrangler/",
  ".DS_Store",
  "dist/",
  ".env",
  ".env.*",
  "",
].join("\n");
await writeFile(gitignorePath, gitignore, "utf-8");

console.log(`Seeded ${repoName}`);
console.log(`source=${sourceRoot}`);
console.log(`target=${targetRoot}`);
