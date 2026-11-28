import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { resolveStateDir } from "../../config/paths.js";
import { configureSqliteWalMaintenance, type SqliteWalMaintenance } from "../../infra/sqlite-wal.js";

export type GoalStatus = "active" | "paused" | "waiting" | "completed" | "cancelled";

export type GoalContract = {
  id: string;
  sessionId: string;
  objective: string;
  acceptanceCriteria: string[];
  gateCommands: string[];
  status: GoalStatus;
  iterations: number;
  maxIterations: number;
  consecutiveParseFailures: number;
  maxParseFailures: number;
  consecutiveTransportFailures: number;
  maxTransportFailures: number;
  waitPid: number | null;
  lastGateOutput: string | null;
  pauseReason: string | null;
  createdAt: string;
  updatedAt: string;
};

type GoalRow = {
  id: string;
  session_id: string;
  objective: string;
  acceptance_criteria_json: string;
  gate_commands_json: string;
  status: GoalStatus;
  iterations: number;
  max_iterations: number;
  consecutive_parse_failures: number;
  max_parse_failures: number;
  consecutive_transport_failures: number;
  max_transport_failures: number;
  wait_pid: number | null;
  last_gate_output: string | null;
  pause_reason: string | null;
  created_at: string;
  updated_at: string;
};

export function resolveGoalsDbPath(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(resolveStateDir(env), "goals", "goals.db");
}

function rowToContract(row: GoalRow): GoalContract {
  return {
    id: row.id,
    sessionId: row.session_id,
    objective: row.objective,
    acceptanceCriteria: JSON.parse(row.acceptance_criteria_json) as string[],
    gateCommands: JSON.parse(row.gate_commands_json) as string[],
    status: row.status,
    iterations: row.iterations,
    maxIterations: row.max_iterations,
    consecutiveParseFailures: row.consecutive_parse_failures,
    maxParseFailures: row.max_parse_failures,
    consecutiveTransportFailures: row.consecutive_transport_failures,
    maxTransportFailures: row.max_transport_failures,
    waitPid: row.wait_pid,
    lastGateOutput: row.last_gate_output,
    pauseReason: row.pause_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class GoalContractStore {
  private readonly db: DatabaseSync;
  private readonly walMaintenance: SqliteWalMaintenance;
  readonly dbPath: string;

  constructor(env: NodeJS.ProcessEnv = process.env, dbPath?: string) {
    this.dbPath = dbPath ?? resolveGoalsDbPath(env);
    const dir = path.dirname(this.dbPath);
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(this.dbPath);
    try {
      fs.chmodSync(this.dbPath, 0o600);
    } catch {
      // Best-effort on non-POSIX filesystems
    }
    this.walMaintenance = configureSqliteWalMaintenance(this.db, { checkpointMode: "TRUNCATE" });
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS goal_contracts (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        objective TEXT NOT NULL,
        acceptance_criteria_json TEXT NOT NULL,
        gate_commands_json TEXT NOT NULL,
        status TEXT NOT NULL,
        iterations INTEGER NOT NULL DEFAULT 0,
        max_iterations INTEGER NOT NULL DEFAULT 20,
        consecutive_parse_failures INTEGER NOT NULL DEFAULT 0,
        max_parse_failures INTEGER NOT NULL DEFAULT 3,
        consecutive_transport_failures INTEGER NOT NULL DEFAULT 0,
        max_transport_failures INTEGER NOT NULL DEFAULT 5,
        wait_pid INTEGER,
        last_gate_output TEXT,
        pause_reason TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_goal_contracts_session ON goal_contracts(session_id, updated_at);
    `);
  }

  getJournalMode(): string {
    const row = this.db.prepare("PRAGMA journal_mode;").get() as { journal_mode?: string } | undefined;
    return String(row?.journal_mode ?? "").toLowerCase();
  }

  createOrReplaceForSession(params: {
    sessionId: string;
    objective: string;
    acceptanceCriteria?: string[];
    gateCommands?: string[];
    maxIterations?: number;
    maxParseFailures?: number;
    maxTransportFailures?: number;
  }): GoalContract {
    const now = new Date().toISOString();
    // Cancel any prior active/waiting/paused goal for the same session so one session owns one active goal
    this.db
      .prepare(
        `UPDATE goal_contracts SET status = 'cancelled', updated_at = ?
         WHERE session_id = ? AND status IN ('active', 'waiting', 'paused')`,
      )
      .run(now, params.sessionId);

    const id = `goal-${crypto.randomBytes(4).toString("hex")}`;
    const criteria = params.acceptanceCriteria ?? [];
    const gates = params.gateCommands ?? [];
    this.db
      .prepare(
        `INSERT INTO goal_contracts (
          id, session_id, objective, acceptance_criteria_json, gate_commands_json,
          status, iterations, max_iterations,
          consecutive_parse_failures, max_parse_failures,
          consecutive_transport_failures, max_transport_failures,
          wait_pid, last_gate_output, pause_reason, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'active', 0, ?, 0, ?, 0, ?, NULL, NULL, NULL, ?, ?)`,
      )
      .run(
        id,
        params.sessionId,
        params.objective.trim(),
        JSON.stringify(criteria),
        JSON.stringify(gates),
        params.maxIterations ?? 20,
        params.maxParseFailures ?? 3,
        params.maxTransportFailures ?? 5,
        now,
        now,
      );
    return this.getById(id)!;
  }

  getById(id: string): GoalContract | null {
    const row = this.db.prepare("SELECT * FROM goal_contracts WHERE id = ?").get(id) as
      | GoalRow
      | undefined;
    return row ? rowToContract(row) : null;
  }

  getLatestForSession(sessionId: string): GoalContract | null {
    const row = this.db
      .prepare(
        `SELECT * FROM goal_contracts WHERE session_id = ?
         ORDER BY updated_at DESC, rowid DESC LIMIT 1`,
      )
      .get(sessionId) as GoalRow | undefined;
    return row ? rowToContract(row) : null;
  }

  listContracts(sessionId?: string): GoalContract[] {
    const rows = (
      sessionId
        ? this.db
            .prepare(
              "SELECT * FROM goal_contracts WHERE session_id = ? ORDER BY updated_at DESC, rowid DESC",
            )
            .all(sessionId)
        : this.db
            .prepare("SELECT * FROM goal_contracts ORDER BY updated_at DESC, rowid DESC")
            .all()
    ) as GoalRow[];
    return rows.map(rowToContract);
  }

  update(
    id: string,
    patch: Partial<{
      status: GoalStatus;
      iterations: number;
      consecutiveParseFailures: number;
      consecutiveTransportFailures: number;
      waitPid: number | null;
      lastGateOutput: string | null;
      pauseReason: string | null;
    }>,
  ): GoalContract | null {
    const existing = this.getById(id);
    if (!existing) {
      return null;
    }
    const now = new Date().toISOString();
    this.db
      .prepare(
        `UPDATE goal_contracts SET
          status = ?,
          iterations = ?,
          consecutive_parse_failures = ?,
          consecutive_transport_failures = ?,
          wait_pid = ?,
          last_gate_output = ?,
          pause_reason = ?,
          updated_at = ?
         WHERE id = ?`,
      )
      .run(
        patch.status ?? existing.status,
        patch.iterations ?? existing.iterations,
        patch.consecutiveParseFailures ?? existing.consecutiveParseFailures,
        patch.consecutiveTransportFailures ?? existing.consecutiveTransportFailures,
        patch.waitPid !== undefined ? patch.waitPid : existing.waitPid,
        patch.lastGateOutput !== undefined ? patch.lastGateOutput : existing.lastGateOutput,
        patch.pauseReason !== undefined ? patch.pauseReason : existing.pauseReason,
        now,
        id,
      );
    return this.getById(id);
  }

  close(): void {
    this.walMaintenance.close();
    this.db.close();
  }
}
