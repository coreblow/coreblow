import type { CoreBlowConfig } from "../config/types.coreblow.js";

type SessionMigrationLogger = {
  info: (message: string) => void;
  warn: (message: string) => void;
};

/**
 * Run orphan-key session migration at gateway startup.
 *
 * Idempotent and best-effort: if the migration fails, gateway startup
 * continues normally.
 */
export async function runStartupSessionMigration(params: {
  cfg: CoreBlowConfig;
  env?: NodeJS.ProcessEnv;
  log: SessionMigrationLogger;
  deps?: {
    migrateOrphanedSessionKeys?: (opts: { cfg: CoreBlowConfig; env: NodeJS.ProcessEnv }) => Promise<{
      changes: string[];
      warnings: string[];
    }>;
  };
}): Promise<void> {
  // ponytail: skipped migrateOrphanedSessionKeys dep — not in CoreBlow state-migrations.ts
  // Add when orphaned session key migration is ported.
  void params;
}
