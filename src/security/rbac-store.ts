/**
 * CoreBlow — Persistent SQLite WAL RBAC Role-Binding Store
 *
 * Implements <COREBLOW_STATE_DIR>/security/rbac.db backed by node:sqlite
 * DatabaseSync with WAL mode, synchronous=NORMAL, busy_timeout=5000,
 * periodic WAL checkpoint maintenance, single-user local bootstrap migration,
 * fail-closed enforcement, and redacted control-plane audit logging.
 */

import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { resolveStateDir } from "../config/paths.js";
import { configureSqliteWalMaintenance, type SqliteWalMaintenance } from "../infra/sqlite-wal.js";
import { redactSensitiveText } from "../logging/redact.js";

type DatabaseSyncConstructor = new (path: string) => DatabaseSync;

let cachedDatabaseClass: DatabaseSyncConstructor | null | undefined;

function getDatabaseSyncConstructor(): DatabaseSyncConstructor | null {
  if (cachedDatabaseClass !== undefined) {
    return cachedDatabaseClass;
  }
  try {
    const req = createRequire(import.meta.url);
    const sqliteModule = req("node:sqlite") as { DatabaseSync?: DatabaseSyncConstructor };
    if (sqliteModule && typeof sqliteModule.DatabaseSync === "function") {
      cachedDatabaseClass = sqliteModule.DatabaseSync;
      return cachedDatabaseClass;
    }
  } catch {
    // node:sqlite is unavailable in this runtime
  }
  cachedDatabaseClass = null;
  return null;
}

export type RbacEnforcementMode = "off" | "advisory" | "enforced";

export interface PersistentRbacRole {
  readonly name: string;
  readonly description: string;
  readonly scopes: readonly string[];
  readonly methods: readonly string[];
  readonly inherits: readonly string[];
  readonly builtin: boolean;
  readonly updatedAtMs: number;
}

export interface PersistentRbacBinding {
  readonly principalId: string;
  readonly roleName: string;
  readonly grantedBy: string;
  readonly grantedAtMs: number;
  readonly expiresAtMs: number | null;
}

export interface RbacEvaluationResult {
  readonly allowed: boolean;
  readonly reason: string;
  readonly principalId: string;
  readonly matchedRoles: readonly string[];
}

const BUILTIN_ROLES: readonly Omit<PersistentRbacRole, "updatedAtMs">[] = [
  {
    name: "owner",
    description: "Full control-plane and config access",
    scopes: ["operator.admin", "*"],
    methods: ["*"],
    inherits: ["admin"],
    builtin: true,
  },
  {
    name: "admin",
    description: "Operational administration",
    scopes: ["operator.read", "operator.write", "operator.approvals", "operator.pairing"],
    methods: ["*"],
    inherits: ["operator"],
    builtin: true,
  },
  {
    name: "operator",
    description: "Standard interactive operator",
    scopes: ["operator.read", "operator.write"],
    methods: ["agent.*", "agents.*", "chat.*", "sessions.*", "models.*", "status", "health"],
    inherits: ["viewer"],
    builtin: true,
  },
  {
    name: "viewer",
    description: "Read-only observability and status",
    scopes: ["operator.read"],
    methods: [
      "status",
      "health",
      "logs.*",
      "agents.list",
      "sessions.list",
      "models.list",
      "channels.status",
      "config.get",
    ],
    inherits: [],
    builtin: true,
  },
];

export function resolveRbacStorePath(customPath?: string): string {
  if (customPath?.trim()) {
    return path.resolve(customPath.trim());
  }
  const envOverride = process.env.COREBLOW_RBAC_STORE_PATH?.trim();
  if (envOverride) {
    return path.resolve(envOverride);
  }
  return path.join(resolveStateDir(), "security", "rbac.db");
}

export function parseDurationToMs(raw: string): number {
  const trimmed = raw.trim().toLowerCase();
  const match = /^(\d+)\s*(ms|s|m|h|d)?$/.exec(trimmed);
  if (!match) {
    throw new Error(`Invalid duration '${raw}': expected e.g. 30m, 24h, 7d`);
  }
  const amount = Number.parseInt(match[1], 10);
  const unit = match[2] ?? "s";
  const multiplier =
    unit === "ms"
      ? 1
      : unit === "s"
        ? 1000
        : unit === "m"
          ? 60_000
          : unit === "h"
            ? 3_600_000
            : 86_400_000;
  return amount * multiplier;
}

function matchMethodPattern(pattern: string, method: string): boolean {
  if (pattern === "*" || pattern === method) {
    return true;
  }
  if (pattern.endsWith(".*")) {
    const prefix = pattern.slice(0, -1);
    return method.startsWith(prefix);
  }
  if (pattern.endsWith("*")) {
    const prefix = pattern.slice(0, -1);
    return method.startsWith(prefix);
  }
  return false;
}

export function formatRedactedRbacAudit(message: string): string {
  return redactSensitiveText(message);
}

export class PersistentRbacStore {
  public readonly dbPath: string;
  private db: DatabaseSync | null = null;
  private walMaintenance: SqliteWalMaintenance | null = null;
  private rolesCache: Map<string, PersistentRbacRole> | null = null;
  private bindingsCache: Map<string, PersistentRbacBinding[]> | null = null;
  private bootstrapModeCache: string | null | undefined;

  constructor(options?: { readonly dbPath?: string; readonly gatewayMode?: "local" | "remote" }) {
    this.dbPath = resolveRbacStorePath(options?.dbPath);
    this.open(options?.gatewayMode ?? "local");
  }

  private open(gatewayMode: "local" | "remote"): void {
    const DatabaseSyncCtor = getDatabaseSyncConstructor();
    if (!DatabaseSyncCtor) {
      throw new Error("node:sqlite DatabaseSync is unavailable in this Node runtime");
    }

    const parentDir = path.dirname(this.dbPath);
    fs.mkdirSync(parentDir, { recursive: true, mode: 0o700 });
    try {
      fs.chmodSync(parentDir, 0o700);
    } catch {
      // Best-effort on non-POSIX filesystems
    }

    const db = new DatabaseSyncCtor(this.dbPath);
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA synchronous = NORMAL;");
    db.exec("PRAGMA busy_timeout = 5000;");
    db.exec("PRAGMA foreign_keys = ON;");
    this.walMaintenance = configureSqliteWalMaintenance(db, { checkpointMode: "TRUNCATE" });

    try {
      fs.chmodSync(this.dbPath, 0o600);
    } catch {
      // Best-effort
    }

    db.exec(`
      CREATE TABLE IF NOT EXISTS rbac_schema_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS rbac_roles (
        name TEXT PRIMARY KEY,
        description TEXT,
        scopes_json TEXT NOT NULL,
        methods_json TEXT NOT NULL,
        inherits_json TEXT NOT NULL,
        builtin INTEGER NOT NULL DEFAULT 0,
        updated_at_ms INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS rbac_bindings (
        principal_id TEXT NOT NULL,
        role_name TEXT NOT NULL REFERENCES rbac_roles(name) ON DELETE RESTRICT,
        granted_by TEXT NOT NULL,
        granted_at_ms INTEGER NOT NULL,
        expires_at_ms INTEGER,
        PRIMARY KEY (principal_id, role_name)
      );

      CREATE INDEX IF NOT EXISTS idx_rbac_bindings_principal
        ON rbac_bindings(principal_id);
    `);

    this.db = db;
    this.seedSchemaAndBuiltinRoles();
    this.bootstrapLocalOwnerIfNeeded(gatewayMode);
    this.invalidateCache();
  }

  private ensureDb(): DatabaseSync {
    if (!this.db) {
      throw new Error("RBAC SQLite store is closed");
    }
    return this.db;
  }

  private seedSchemaAndBuiltinRoles(): void {
    const db = this.ensureDb();
    const now = Date.now();
    db.prepare(
      `INSERT OR IGNORE INTO rbac_schema_meta (key, value) VALUES ('schema_version', '1')`,
    ).run();

    const insertRole = db.prepare(`
      INSERT OR IGNORE INTO rbac_roles (
        name, description, scopes_json, methods_json, inherits_json, builtin, updated_at_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const role of BUILTIN_ROLES) {
      insertRole.run(
        role.name,
        role.description,
        JSON.stringify(role.scopes),
        JSON.stringify(role.methods),
        JSON.stringify(role.inherits),
        role.builtin ? 1 : 0,
        now,
      );
    }
  }

  private bootstrapLocalOwnerIfNeeded(gatewayMode: "local" | "remote"): void {
    const db = this.ensureDb();
    const metaRow = db
      .prepare(`SELECT value FROM rbac_schema_meta WHERE key = 'bootstrap_mode'`)
      .get() as { value: string } | undefined;
    if (metaRow) {
      return;
    }

    const countRow = db
      .prepare(`SELECT COUNT(*) AS cnt FROM rbac_bindings`)
      .get() as { cnt: number };
    if (countRow.cnt > 0) {
      db.prepare(
        `INSERT OR IGNORE INTO rbac_schema_meta (key, value) VALUES ('bootstrap_mode', 'explicit')`,
      ).run();
      return;
    }

    if (gatewayMode === "local") {
      db.prepare(`
        INSERT OR IGNORE INTO rbac_bindings (
          principal_id, role_name, granted_by, granted_at_ms, expires_at_ms
        ) VALUES (?, 'owner', 'bootstrap', ?, NULL)
      `).run("local:default", Date.now());
      db.prepare(
        `INSERT OR REPLACE INTO rbac_schema_meta (key, value) VALUES ('bootstrap_mode', 'single-user-local')`,
      ).run();
    } else {
      db.prepare(
        `INSERT OR REPLACE INTO rbac_schema_meta (key, value) VALUES ('bootstrap_mode', 'remote-explicit')`,
      ).run();
    }
  }

  public invalidateCache(): void {
    this.rolesCache = null;
    this.bindingsCache = null;
    this.bootstrapModeCache = undefined;
  }

  public getBootstrapMode(): string | null {
    if (this.bootstrapModeCache !== undefined) {
      return this.bootstrapModeCache;
    }
    const db = this.ensureDb();
    const row = db
      .prepare(`SELECT value FROM rbac_schema_meta WHERE key = 'bootstrap_mode'`)
      .get() as { value: string } | undefined;
    this.bootstrapModeCache = row?.value ?? null;
    return this.bootstrapModeCache;
  }

  public listRoles(): PersistentRbacRole[] {
    const cache = this.loadRolesMap();
    return Array.from(cache.values());
  }

  private loadRolesMap(): Map<string, PersistentRbacRole> {
    if (this.rolesCache) {
      return this.rolesCache;
    }
    const db = this.ensureDb();
    const rows = db
      .prepare(
        `SELECT name, description, scopes_json, methods_json, inherits_json, builtin, updated_at_ms FROM rbac_roles ORDER BY name ASC`,
      )
      .all() as Array<{
      name: string;
      description: string | null;
      scopes_json: string;
      methods_json: string;
      inherits_json: string;
      builtin: number;
      updated_at_ms: number;
    }>;

    const map = new Map<string, PersistentRbacRole>();
    for (const row of rows) {
      map.set(row.name, {
        name: row.name,
        description: row.description ?? "",
        scopes: JSON.parse(row.scopes_json) as string[],
        methods: JSON.parse(row.methods_json) as string[],
        inherits: JSON.parse(row.inherits_json) as string[],
        builtin: row.builtin === 1,
        updatedAtMs: row.updated_at_ms,
      });
    }
    this.rolesCache = map;
    return map;
  }

  public listBindings(options?: {
    readonly principalId?: string;
    readonly includeExpired?: boolean;
    readonly nowMs?: number;
  }): PersistentRbacBinding[] {
    const now = options?.nowMs ?? Date.now();
    const includeExpired = options?.includeExpired === true;
    const all = this.loadBindingsMap();
    const out: PersistentRbacBinding[] = [];

    const entries = options?.principalId
      ? (all.get(options.principalId) ?? [])
      : Array.from(all.values()).flat();

    for (const binding of entries) {
      if (!includeExpired && binding.expiresAtMs !== null && binding.expiresAtMs <= now) {
        continue;
      }
      out.push(binding);
    }
    return out;
  }

  private loadBindingsMap(): Map<string, PersistentRbacBinding[]> {
    if (this.bindingsCache) {
      return this.bindingsCache;
    }
    const db = this.ensureDb();
    const rows = db
      .prepare(
        `SELECT principal_id, role_name, granted_by, granted_at_ms, expires_at_ms FROM rbac_bindings ORDER BY principal_id ASC, role_name ASC`,
      )
      .all() as Array<{
      principal_id: string;
      role_name: string;
      granted_by: string;
      granted_at_ms: number;
      expires_at_ms: number | null;
    }>;

    const map = new Map<string, PersistentRbacBinding[]>();
    for (const row of rows) {
      const list = map.get(row.principal_id) ?? [];
      list.push({
        principalId: row.principal_id,
        roleName: row.role_name,
        grantedBy: row.granted_by,
        grantedAtMs: row.granted_at_ms,
        expiresAtMs: row.expires_at_ms,
      });
      map.set(row.principal_id, list);
    }
    this.bindingsCache = map;
    return map;
  }

  public grantBinding(params: {
    readonly principalId: string;
    readonly roleName: string;
    readonly grantedBy?: string;
    readonly expiresAtMs?: number | null;
  }): PersistentRbacBinding {
    const principalId = params.principalId.trim();
    const roleName = params.roleName.trim();
    if (!principalId) {
      throw new Error("principalId must be non-empty");
    }
    const roles = this.loadRolesMap();
    if (!roles.has(roleName)) {
      throw new Error(`Unknown RBAC role '${roleName}'`);
    }

    const db = this.ensureDb();
    const grantedBy = params.grantedBy?.trim() || "operator";
    const grantedAtMs = Date.now();
    const expiresAtMs = params.expiresAtMs ?? null;

    db.exec("BEGIN IMMEDIATE;");
    try {
      db.prepare(`
        INSERT INTO rbac_bindings (principal_id, role_name, granted_by, granted_at_ms, expires_at_ms)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(principal_id, role_name) DO UPDATE SET
          granted_by = excluded.granted_by,
          granted_at_ms = excluded.granted_at_ms,
          expires_at_ms = excluded.expires_at_ms
      `).run(principalId, roleName, grantedBy, grantedAtMs, expiresAtMs);
      db.exec("COMMIT;");
    } catch (err) {
      try {
        db.exec("ROLLBACK;");
      } catch {
        // Ignore rollback failure
      }
      throw err;
    }

    this.invalidateCache();
    return { principalId, roleName, grantedBy, grantedAtMs, expiresAtMs };
  }

  public revokeBinding(params: {
    readonly principalId: string;
    readonly roleName: string;
  }): boolean {
    const db = this.ensureDb();
    db.exec("BEGIN IMMEDIATE;");
    let changes = 0;
    try {
      const res = db
        .prepare(`DELETE FROM rbac_bindings WHERE principal_id = ? AND role_name = ?`)
        .run(params.principalId.trim(), params.roleName.trim()) as { changes?: number | bigint };
      changes = Number(res.changes ?? 0);
      db.exec("COMMIT;");
    } catch (err) {
      try {
        db.exec("ROLLBACK;");
      } catch {
        // Ignore rollback failure
      }
      throw err;
    }

    this.invalidateCache();
    return changes > 0;
  }

  private collectInheritedRoles(roleName: string, visited = new Set<string>()): PersistentRbacRole[] {
    if (visited.has(roleName)) {
      return [];
    }
    visited.add(roleName);
    const roles = this.loadRolesMap();
    const role = roles.get(roleName);
    if (!role) {
      return [];
    }
    const collected = [role];
    for (const parent of role.inherits) {
      collected.push(...this.collectInheritedRoles(parent, visited));
    }
    return collected;
  }

  public evaluateMethodAccess(params: {
    readonly principalId: string;
    readonly method: string;
    readonly isLocalBootstrapEligible?: boolean;
    readonly nowMs?: number;
  }): RbacEvaluationResult {
    const now = params.nowMs ?? Date.now();
    let activeBindings = this.listBindings({ principalId: params.principalId, nowMs: now });

    // Backward-compatible single-user local migration fallback:
    // If this local operator has no explicit bindings yet and the store was
    // initialized in single-user-local mode with local:default -> owner, honor it.
    if (
      activeBindings.length === 0 &&
      params.isLocalBootstrapEligible &&
      this.getBootstrapMode() === "single-user-local"
    ) {
      activeBindings = this.listBindings({ principalId: "local:default", nowMs: now });
    }

    if (activeBindings.length === 0) {
      return {
        allowed: false,
        reason: `no active RBAC binding for ${params.principalId}`,
        principalId: params.principalId,
        matchedRoles: [],
      };
    }

    const matchedRoles = activeBindings.map((b) => b.roleName);
    for (const binding of activeBindings) {
      const effectiveRoles = this.collectInheritedRoles(binding.roleName);
      for (const role of effectiveRoles) {
        if (role.methods.some((pattern) => matchMethodPattern(pattern, params.method))) {
          return {
            allowed: true,
            reason: `permitted by role '${binding.roleName}'`,
            principalId: params.principalId,
            matchedRoles,
          };
        }
      }
    }

    return {
      allowed: false,
      reason: `method '${params.method}' not permitted for roles [${matchedRoles.join(", ")}]`,
      principalId: params.principalId,
      matchedRoles,
    };
  }

  public close(): void {
    try {
      this.walMaintenance?.close();
    } catch {
      // Best-effort WAL flush
    }
    this.walMaintenance = null;
    try {
      this.db?.close();
    } catch {
      // Best-effort close
    }
    this.db = null;
    this.invalidateCache();
  }
}
