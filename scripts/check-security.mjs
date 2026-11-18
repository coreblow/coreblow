// Gate: real security checks (replaces the previous 2-line stub).
// Scans runtime sources for leaked private keys, competitor command strings
// shown to users, and one narrow path-traversal sink pattern.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOTS = ["src", "apps/desktop/src", "apps/desktop/electron"];
const EXTS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".build"]);

const PRIVATE_KEY = /-----BEGIN (?:RSA |OPENSSH |EC |DSA |PGP )?PRIVATE KEY-----/;
const USER_FACING_COMPETITOR_CMD = /(?:^|[^\w@/-])openclaw (?:plugins install|doctor)\b/;
const TRAVERSAL_SINK = /path\.(?:join|resolve)\([^)]*decodeURIComponent\(/;

function walk(dir, out) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (EXTS.has(path.extname(entry.name)) && !/\.test\.(?:ts|tsx|js|mjs)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const files = ROOTS.flatMap((root) => walk(root, []));
const violations = [];

for (const file of files) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const where = `${file}:${i + 1}`;
    if (PRIVATE_KEY.test(line)) {
      violations.push(`${where} leaked private key material`);
    }
    if (USER_FACING_COMPETITOR_CMD.test(line)) {
      violations.push(`${where} user-facing competitor command string`);
    }
    if (TRAVERSAL_SINK.test(line)) {
      violations.push(`${where} path join/resolve fed by decodeURIComponent (traversal sink)`);
    }
  }
}

if (violations.length > 0) {
  console.error(`check-security: ${violations.length} violation(s)`);
  for (const violation of violations.slice(0, 50)) console.error(`  ${violation}`);
  process.exit(1);
}

console.log(`check-security: passed (${files.length} files scanned)`);
