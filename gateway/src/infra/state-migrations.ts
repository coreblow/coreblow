/** CoreBlow — State Migrations */
import { readMigrationVersion, writeMigrationVersion } from "./state-migrations.fs.js";
export interface Migration { version: number; name: string; up: (stateDir: string) => Promise<void>; }
export async function runMigrations(stateDir: string, migrations: Migration[]): Promise<number> {
  const currentVersion = readMigrationVersion(stateDir);
  const pending = migrations.filter((m) => m.version > currentVersion).sort((a, b) => a.version - b.version);
  for (const m of pending) { await m.up(stateDir); writeMigrationVersion(stateDir, m.version); }
  return pending.length;
}
