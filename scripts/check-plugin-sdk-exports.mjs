// Gate: every declared coreblow/plugin-sdk subpath export must resolve.
// Replaces the previous 2-line stub. Checks both the published target
// (dist/...) and the in-repo source counterpart (src/...) so the gate works
// before and after a build.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const exportsMap = pkg.exports ?? {};
const keys = Object.keys(exportsMap).filter((key) => key.startsWith("./plugin-sdk/"));

if (keys.length === 0) {
  console.error("check-plugin-sdk-exports: no ./plugin-sdk/* exports declared");
  process.exit(1);
}

function targetsOf(value) {
  if (typeof value === "string") return [value];
  if (value && typeof value === "object") {
    return Object.values(value).filter((entry) => typeof entry === "string");
  }
  return [];
}

function sourceCounterpart(target) {
  const rel = target.replace(/^\.\//, "");
  if (rel.startsWith("dist/")) {
    return rel
      .replace(/^dist\//, "src/")
      .replace(/\.d\.ts$/, ".ts")
      .replace(/\.js$/, ".ts");
  }
  return rel.replace(/\.js$/, ".ts");
}

const missing = [];
for (const key of keys) {
  const targets = targetsOf(exportsMap[key]);
  if (targets.length === 0) {
    missing.push(`${key} (no string target)`);
    continue;
  }
  const resolved = targets.some((target) => {
    const published = path.join(root, target.replace(/^\.\//, ""));
    const source = path.join(root, sourceCounterpart(target));
    return existsSync(published) || existsSync(source);
  });
  if (!resolved) missing.push(`${key} -> ${targets.join(", ")}`);
}

if (missing.length > 0) {
  console.error(`check-plugin-sdk-exports: ${missing.length} unresolved export(s)`);
  for (const entry of missing.slice(0, 50)) console.error(`  ${entry}`);
  process.exit(1);
}

console.log(`check-plugin-sdk-exports: passed (${keys.length} subpath exports resolve)`);
