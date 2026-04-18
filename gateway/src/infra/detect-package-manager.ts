/** CoreBlow — Package Manager Detection */
import fs from "node:fs";
import path from "node:path";
export type PackageManager = "npm" | "yarn" | "pnpm" | "bun";
export function detectPackageManager(cwd: string = process.cwd()): PackageManager {
  if (fs.existsSync(path.join(cwd, "bun.lockb"))) return "bun";
  if (fs.existsSync(path.join(cwd, "pnpm-lock.yaml"))) return "pnpm";
  if (fs.existsSync(path.join(cwd, "yarn.lock"))) return "yarn";
  return "npm";
}
