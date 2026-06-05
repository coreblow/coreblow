import type { DatabaseSync } from "node:sqlite";

export type SqliteWalMaintenance = {
  checkpoint: () => boolean;
  close: () => boolean;
};

export type SqliteWalMaintenanceOptions = {
  autoCheckpointPages?: number;
  checkpointIntervalMs?: number;
  checkpointMode?: "PASSIVE" | "FULL" | "RESTART" | "TRUNCATE";
  onCheckpointError?: (error: unknown) => void;
};

export function configureSqliteWalMaintenance(
  db: DatabaseSync,
  options: SqliteWalMaintenanceOptions = {},
): SqliteWalMaintenance {
  const mode = options.checkpointMode ?? "TRUNCATE";
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec(`PRAGMA wal_autocheckpoint = ${options.autoCheckpointPages ?? 1000};`);
  const checkpoint = () => {
    try {
      db.exec(`PRAGMA wal_checkpoint(${mode});`);
      return true;
    } catch (error) {
      options.onCheckpointError?.(error);
      return false;
    }
  };
  let timer: ReturnType<typeof setInterval> | undefined;
  if ((options.checkpointIntervalMs ?? 30 * 60 * 1000) > 0) {
    timer = setInterval(checkpoint, options.checkpointIntervalMs ?? 30 * 60 * 1000);
    timer.unref?.();
  }
  return {
    checkpoint,
    close() {
      if (timer) {
        clearInterval(timer);
        timer = undefined;
      }
      return checkpoint();
    },
  };
}
