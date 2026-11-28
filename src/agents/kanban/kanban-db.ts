import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { resolveStateDir } from "../../config/paths.js";
import { configureSqliteWalMaintenance, type SqliteWalMaintenance } from "../../infra/sqlite-wal.js";

export type KanbanTaskStatus = "todo" | "in_progress" | "review" | "done" | "blocked";

export type KanbanTask = {
  id: string;
  boardSlug: string;
  title: string;
  description: string;
  status: KanbanTaskStatus;
  assignee: string | null;
  claimLock: string | null;
  coreflowContract: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

type KanbanTaskRow = {
  id: string;
  board_slug: string;
  title: string;
  description: string;
  status: KanbanTaskStatus;
  assignee: string | null;
  claim_lock: string | null;
  coreflow_contract_json: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * `pin_first_board_resolution`: if `COREBLOW_KANBAN_DB` or `COREBLOW_KANBAN_TASK` is pinned
 * in worker environment, callers physically cannot override or escape to another board.
 */
export function resolveKanbanDbPath(params: {
  boardSlug?: string;
  env?: NodeJS.ProcessEnv;
}): string {
  const env = params.env ?? process.env;
  const pinnedDb = env.COREBLOW_KANBAN_DB?.trim();
  const pinnedTask = env.COREBLOW_KANBAN_TASK?.trim();
  if (pinnedDb) {
    if (params.boardSlug && params.boardSlug.trim()) {
      const requestedSlug = params.boardSlug.trim();
      const expectedSuffix = path.join("boards", requestedSlug, "kanban.db");
      if (!pinnedDb.endsWith(expectedSuffix)) {
        throw new Error(
          `pin_first_board_resolution: dispatched worker is pinned to ${pinnedDb} and cannot switch to board "${requestedSlug}".`,
        );
      }
    }
    return pinnedDb;
  }
  if (pinnedTask) {
    throw new Error(
      "pin_first_board_resolution: dispatched worker with COREBLOW_KANBAN_TASK requires pinned COREBLOW_KANBAN_DB.",
    );
  }
  const slug = (params.boardSlug?.trim() || "default").replace(/[^a-zA-Z0-9._-]/g, "_");
  return path.join(resolveStateDir(env), "kanban", "boards", slug, "kanban.db");
}

function rowToTask(row: KanbanTaskRow): KanbanTask {
  return {
    id: row.id,
    boardSlug: row.board_slug,
    title: row.title,
    description: row.description,
    status: row.status,
    assignee: row.assignee,
    claimLock: row.claim_lock,
    coreflowContract: row.coreflow_contract_json
      ? (JSON.parse(row.coreflow_contract_json) as Record<string, unknown>)
      : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class KanbanBoardStore {
  private readonly db: DatabaseSync;
  private readonly walMaintenance: SqliteWalMaintenance;
  readonly dbPath: string;
  readonly boardSlug: string;

  constructor(params: { boardSlug?: string; env?: NodeJS.ProcessEnv } = {}) {
    this.boardSlug = params.boardSlug?.trim() || "default";
    this.dbPath = resolveKanbanDbPath(params);
    fs.mkdirSync(path.dirname(this.dbPath), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(this.dbPath);
    try {
      fs.chmodSync(this.dbPath, 0o600);
    } catch {
      // Best-effort
    }
    this.db.exec("PRAGMA busy_timeout = 5000;");
    this.walMaintenance = configureSqliteWalMaintenance(this.db, { checkpointMode: "TRUNCATE" });
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS kanban_tasks (
        id TEXT PRIMARY KEY,
        board_slug TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'todo',
        assignee TEXT,
        claim_lock TEXT,
        coreflow_contract_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_kanban_tasks_board_status ON kanban_tasks(board_slug, status);
    `);
  }

  getJournalMode(): string {
    const row = this.db.prepare("PRAGMA journal_mode;").get() as { journal_mode?: string } | undefined;
    return String(row?.journal_mode ?? "").toLowerCase();
  }

  createTask(params: {
    id?: string;
    title: string;
    description?: string;
    coreflowContract?: Record<string, unknown>;
  }): KanbanTask {
    const id = params.id?.trim() || `task-${crypto.randomBytes(4).toString("hex")}`;
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO kanban_tasks (
          id, board_slug, title, description, status, assignee, claim_lock,
          coreflow_contract_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'todo', NULL, NULL, ?, ?, ?)`,
      )
      .run(
        id,
        this.boardSlug,
        params.title.trim(),
        params.description?.trim() ?? "",
        params.coreflowContract ? JSON.stringify(params.coreflowContract) : null,
        now,
        now,
      );
    return this.getTask(id)!;
  }

  getTask(id: string): KanbanTask | null {
    const row = this.db.prepare("SELECT * FROM kanban_tasks WHERE id = ?").get(id) as
      | KanbanTaskRow
      | undefined;
    return row ? rowToTask(row) : null;
  }

  /**
   * Atomically claims a `todo` task using `BEGIN IMMEDIATE` + compare-and-swap on `claim_lock`.
   * Only one concurrent worker can win; losers observe `claimed: false`.
   */
  claimTask(params: {
    taskId: string;
    workerId: string;
  }): { claimed: boolean; claimLock?: string; task: KanbanTask | null } {
    const lockToken = `${params.workerId}:${crypto.randomBytes(6).toString("hex")}`;
    const now = new Date().toISOString();
    this.db.exec("BEGIN IMMEDIATE;");
    try {
      const result = this.db
        .prepare(
          `UPDATE kanban_tasks
           SET status = 'in_progress', assignee = ?, claim_lock = ?, updated_at = ?
           WHERE id = ? AND status = 'todo' AND claim_lock IS NULL`,
        )
        .run(params.workerId, lockToken, now, params.taskId);
      this.db.exec("COMMIT;");
      const claimed = Number(result.changes) === 1;
      return {
        claimed,
        ...(claimed ? { claimLock: lockToken } : {}),
        task: this.getTask(params.taskId),
      };
    } catch (err) {
      this.db.exec("ROLLBACK;");
      throw err;
    }
  }

  completeTask(params: { taskId: string; claimLock: string }): boolean {
    const now = new Date().toISOString();
    this.db.exec("BEGIN IMMEDIATE;");
    try {
      const result = this.db
        .prepare(
          `UPDATE kanban_tasks
           SET status = 'done', updated_at = ?
           WHERE id = ? AND claim_lock = ?`,
        )
        .run(now, params.taskId, params.claimLock);
      this.db.exec("COMMIT;");
      return Number(result.changes) === 1;
    } catch (err) {
      this.db.exec("ROLLBACK;");
      throw err;
    }
  }

  listTasks(status?: KanbanTaskStatus): KanbanTask[] {
    const rows = (
      status
        ? this.db
            .prepare("SELECT * FROM kanban_tasks WHERE board_slug = ? AND status = ? ORDER BY created_at ASC")
            .all(this.boardSlug, status)
        : this.db
            .prepare("SELECT * FROM kanban_tasks WHERE board_slug = ? ORDER BY created_at ASC")
            .all(this.boardSlug)
    ) as KanbanTaskRow[];
    return rows.map(rowToTask);
  }

  close(): void {
    this.walMaintenance.close();
    this.db.close();
  }
}
