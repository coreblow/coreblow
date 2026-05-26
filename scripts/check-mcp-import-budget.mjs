#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = path.join(repoRoot, "src");

const budgets = [
  {
    file: "src/gateway/mcp-http.loopback-runtime.ts",
    maxRuntimeFiles: 5,
  },
  {
    file: "src/gateway/mcp-http.ts",
    maxRuntimeFiles: 100,
  },
  {
    file: "src/agents/cli-runner/prepare.ts",
    maxRuntimeFiles: 250,
    forbiddenStaticImports: ["../../gateway/mcp-http.js", "../../gateway/mcp-http.ts"],
  },
];

function exists(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\n)\s*\/\/.*$/gm, "$1");
}

function extractRuntimeStaticImports(filePath) {
  const source = stripComments(fs.readFileSync(filePath, "utf8"));
  const imports = [];
  const staticImport =
    /\b(?:import|export)\s+(?!type\b)(?:[^'"()]*?\s+from\s+)?["']([^"']+)["']/g;
  let match;
  while ((match = staticImport.exec(source))) {
    imports.push(match[1]);
  }
  return imports;
}

function resolveRelativeImport(importer, specifier) {
  if (!specifier.startsWith(".")) {
    return null;
  }
  const raw = path.resolve(path.dirname(importer), specifier);
  const candidates = [
    raw,
    raw.replace(/\.js$/, ".ts"),
    raw.replace(/\.js$/, ".tsx"),
    `${raw}.ts`,
    `${raw}.tsx`,
    path.join(raw, "index.ts"),
  ];
  return candidates.find(exists) ?? null;
}

function collectRuntimeGraph(entry) {
  const seen = new Set();
  const stack = [entry];
  while (stack.length > 0) {
    const file = stack.pop();
    if (!file || seen.has(file)) {
      continue;
    }
    seen.add(file);
    for (const specifier of extractRuntimeStaticImports(file)) {
      const resolved = resolveRelativeImport(file, specifier);
      if (resolved && resolved.startsWith(srcRoot)) {
        stack.push(resolved);
      }
    }
  }
  return seen;
}

let failed = false;
for (const budget of budgets) {
  const filePath = path.join(repoRoot, budget.file);
  const graph = collectRuntimeGraph(filePath);
  if (graph.size > budget.maxRuntimeFiles) {
    failed = true;
    console.error(
      `[mcp-import-budget] ${budget.file} imports ${graph.size} runtime files; budget is ${budget.maxRuntimeFiles}.`,
    );
  }

  if (budget.forbiddenStaticImports) {
    const source = fs.readFileSync(filePath, "utf8");
    const staticImports = extractRuntimeStaticImports(filePath);
    for (const forbidden of budget.forbiddenStaticImports) {
      if (staticImports.includes(forbidden) || source.includes(`from "${forbidden}"`)) {
        failed = true;
        console.error(`[mcp-import-budget] ${budget.file} must not static import ${forbidden}.`);
      }
    }
  }
}

if (failed) {
  process.exitCode = 1;
}
