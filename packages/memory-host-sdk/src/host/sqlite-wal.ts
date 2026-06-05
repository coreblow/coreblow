export const DEFAULT_SQLITE_WAL_AUTOCHECKPOINT_PAGES = 1000;
export const DEFAULT_SQLITE_WAL_TRUNCATE_INTERVAL_MS = 30 * 60 * 1000;

export { configureSqliteWalMaintenance } from "../../../../src/infra/sqlite-wal.js";
export type {
  SqliteWalMaintenance,
  SqliteWalMaintenanceOptions,
} from "../../../../src/infra/sqlite-wal.js";
