import type { DatabaseSync } from "node:sqlite";

type SqliteVecModule = {
  getLoadablePath(): string;
  load(db: DatabaseSync): void;
};

const SQLITE_VEC_MODULE = "sqlite-vec";

export async function loadSqliteVecExtension(params: {
  db: DatabaseSync;
  extensionPath?: string;
}): Promise<{ ok: boolean; extensionPath?: string; error?: string }> {
  try {
    const sqliteVec = (await import(SQLITE_VEC_MODULE)) as SqliteVecModule;
    const resolvedPath = params.extensionPath?.trim() ? params.extensionPath.trim() : undefined;
    const extensionPath = resolvedPath ?? sqliteVec.getLoadablePath();

    params.db.enableLoadExtension(true);
    if (resolvedPath) {
      params.db.loadExtension(extensionPath);
    } else {
      sqliteVec.load(params.db);
    }

    return { ok: true, extensionPath };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
