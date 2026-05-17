#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const srcRoot = path.join(repoRoot, "src");

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      if (entry === "node_modules" || entry === "dist") {
        continue;
      }
      yield* walk(fullPath);
      continue;
    }
    if (entry.endsWith(".ts")) {
      yield fullPath;
    }
  }
}

function stripCommentsAndStrings(line, state) {
  let output = "";
  let index = 0;
  let quote = null;

  while (index < line.length) {
    const char = line[index];

    if (state.inBlockComment) {
      if (char === "*" && line[index + 1] === "/") {
        state.inBlockComment = false;
        index += 2;
      } else {
        index += 1;
      }
      continue;
    }

    if (quote !== null) {
      if (char === "\\") {
        index += 2;
        continue;
      }
      if (char === quote) {
        quote = null;
      }
      index += 1;
      continue;
    }

    if (char === "/" && line[index + 1] === "/") {
      break;
    }

    if (char === "/" && line[index + 1] === "*") {
      state.inBlockComment = true;
      index += 2;
      continue;
    }

    if (char === "'" || char === '"' || char === "`") {
      quote = char;
      index += 1;
      continue;
    }

    output += char;
    index += 1;
  }

  return output;
}

function isTestLikeFile(filePath) {
  const normalized = path.relative(repoRoot, filePath).replaceAll(path.sep, "/");
  return (
    normalized.includes(".test.") ||
    normalized.includes(".spec.") ||
    normalized.includes(".test-support.") ||
    normalized.includes("/test/")
  );
}

function isIntentionalSandboxMethod(line) {
  return /^\s*(?:async\s+)?eval\s*\([^)]*:\s*[^)]*\)\s*[:{]/u.test(line);
}

const hits = [];

for (const filePath of walk(srcRoot)) {
  if (isTestLikeFile(filePath)) {
    continue;
  }

  const state = { inBlockComment: false };
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/u);
  lines.forEach((line, index) => {
    const uncommented = stripCommentsAndStrings(line, state);
    if (isIntentionalSandboxMethod(uncommented)) {
      return;
    }
    if (/(?<![\w$.])eval\s*\(/u.test(uncommented)) {
      hits.push(`${path.relative(repoRoot, filePath)}:${index + 1}:${line}`);
    }
  });
}

if (hits.length > 0) {
  console.error(`Found ${hits.length} raw eval() call${hits.length === 1 ? "" : "s"}:`);
  for (const hit of hits) {
    console.error(hit);
  }
  process.exit(1);
}

console.log("No raw eval() calls");
