/** CoreBlow — Legacy Config Migration */
export interface MigrationResult { migrated: boolean; version: number; changes: string[]; }
export function migrateConfig(config: Record<string, unknown>, fromVersion: number): MigrationResult { const changes: string[] = []; let v = fromVersion; if (v < 1) { changes.push("Normalized channel config format"); v = 1; } if (v < 2) { changes.push("Added default model settings"); v = 2; } return { migrated: changes.length > 0, version: v, changes }; }
