/** CoreBlow — Install Package Dir */
import path from "node:path";
import fs from "node:fs";
export function resolvePackageDir(stateDir: string, packageName: string): string { return path.join(stateDir, "packages", packageName.replace(/\//g, "__")); }
export function ensurePackageDir(stateDir: string, packageName: string): string { const dir = resolvePackageDir(stateDir, packageName); fs.mkdirSync(dir, { recursive: true }); return dir; }
