/** CoreBlow — State Migrations FS */
import fs from "node:fs";
import path from "node:path";
export function readMigrationVersion(stateDir: string): number { try { return parseInt(fs.readFileSync(path.join(stateDir, ".migration-version"), "utf8").trim(), 10) || 0; } catch { return 0; } }
export function writeMigrationVersion(stateDir: string, version: number): void { fs.writeFileSync(path.join(stateDir, ".migration-version"), String(version)); }
