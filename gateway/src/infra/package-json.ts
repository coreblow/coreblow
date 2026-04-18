/** CoreBlow — Package JSON Reader */
import fs from "node:fs";
import path from "node:path";
export function readPackageJson(dir: string): Record<string, unknown> | null { try { return JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")); } catch { return null; } }
export function getPackageVersion(dir: string): string | null { const pkg = readPackageJson(dir); return typeof pkg?.version === "string" ? pkg.version : null; }
