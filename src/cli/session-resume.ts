import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { resolveStateDir } from "../config/paths.js";
import {
  getSqliteSession,
  isSqliteAvailable,
  listSqliteSessions,
  upsertSqliteSession,
} from "../sessions/sqlite-session-store.js";
import {
  getUnifiedSession,
  listUnifiedSessions,
  upsertUnifiedSession,
  type UnifiedSessionRecord,
} from "../sessions/unified-session-store.js";

const TERMINAL_SESSIONS_DIR = "terminal-sessions";
const BREADCRUMB_FILE = "last-session.json";

export interface TerminalSessionBreadcrumb {
  sessionId: string;
  cwd: string;
  updatedAt: number;
}

/**
 * Returns the directory used to persist terminal session breadcrumbs.
 */
export function getTerminalSessionsDir(): string {
  const stateDir = resolveStateDir();
  const dir = path.join(stateDir, TERMINAL_SESSIONS_DIR);
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {
      // Ignore directory creation errors if already created concurrently
    }
  }
  return dir;
}

/**
 * Persists the latest active session ID for the current working directory / terminal.
 */
export function recordTerminalSessionBreadcrumb(params: {
  sessionId: string;
  cwd?: string;
}): void {
  try {
    const dir = getTerminalSessionsDir();
    const targetCwd = path.resolve(params.cwd || process.cwd());
    const data: TerminalSessionBreadcrumb = {
      sessionId: params.sessionId,
      cwd: targetCwd,
      updatedAt: Date.now(),
    };
    fs.writeFileSync(path.join(dir, BREADCRUMB_FILE), JSON.stringify(data, null, 2), "utf8");
  } catch {
    // Best-effort persistence
  }
}

/**
 * Resolves the most recent session for current cwd.
 * Checks SQLite/Unified sessions matching cwd, then checks terminal breadcrumb.
 */
export function resolveLatestSessionForCwd(
  cwd?: string,
  storePath?: string,
): UnifiedSessionRecord | null {
  const targetCwd = path.resolve(cwd || process.cwd());

  // 1. Check SQLite sessions filtered by cwd
  const sessions = isSqliteAvailable()
    ? listSqliteSessions({ limit: 100, storePath })
    : listUnifiedSessions({ limit: 100, storePath });

  const matchingCwd = sessions.find((s) => s.cwd && path.resolve(s.cwd) === targetCwd);
  if (matchingCwd) {
    return matchingCwd;
  }

  // 2. Check terminal breadcrumb
  try {
    const dir = getTerminalSessionsDir();
    const breadcrumbPath = path.join(dir, BREADCRUMB_FILE);
    if (fs.existsSync(breadcrumbPath)) {
      const parsed: TerminalSessionBreadcrumb = JSON.parse(
        fs.readFileSync(breadcrumbPath, "utf8"),
      );
      if (parsed.sessionId && (!parsed.cwd || path.resolve(parsed.cwd) === targetCwd)) {
        const found = isSqliteAvailable()
          ? getSqliteSession(parsed.sessionId, storePath)
          : getUnifiedSession(parsed.sessionId, storePath);
        if (found) {
          return found;
        }
      }
    }
  } catch {
    // Ignore read errors
  }

  // 3. Fallback to the latest session overall if exists
  if (sessions.length > 0 && sessions[0]) {
    return sessions[0];
  }

  return null;
}

/**
 * Resolves session by exact ID or FTS5/substring query.
 */
export function resolveSessionByIdOrQuery(
  query: string,
  cwd?: string,
  storePath?: string,
): UnifiedSessionRecord | null {
  const trimmed = query.trim();
  if (!trimmed) {
    return resolveLatestSessionForCwd(cwd, storePath);
  }

  // 1. Direct ID lookup
  const direct = isSqliteAvailable()
    ? getSqliteSession(trimmed, storePath)
    : getUnifiedSession(trimmed, storePath);
  if (direct) {
    return direct;
  }

  // 2. Search by Title or Content via SQLite FTS5 / Unified store
  const results = isSqliteAvailable()
    ? listSqliteSessions({ query: trimmed, limit: 5, storePath })
    : listUnifiedSessions({ query: trimmed, limit: 5, storePath });

  if (results.length > 0 && results[0]) {
    return results[0];
  }

  return null;
}

/**
 * Forks an existing session into a new session record.
 */
export function forkSession(
  sessionId: string,
  newTitle?: string,
  storePath?: string,
): UnifiedSessionRecord {
  const existing = isSqliteAvailable()
    ? getSqliteSession(sessionId, storePath)
    : getUnifiedSession(sessionId, storePath);

  if (!existing) {
    throw new Error(`Cannot fork session: Session '${sessionId}' not found.`);
  }

  const now = Date.now();
  const forkedId = `session_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const title = newTitle?.trim() || `${existing.title} (fork)`;

  const clonedMessages = (existing.messages || []).map((m) => ({
    ...m,
    id: `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
  }));

  const record: UnifiedSessionRecord = {
    id: forkedId,
    title,
    createdAt: now,
    updatedAt: now,
    cwd: existing.cwd || process.cwd(),
    executionProfile: existing.executionProfile,
    model: existing.model,
    surface: existing.surface || "cli",
    messages: clonedMessages,
  };

  if (isSqliteAvailable()) {
    upsertSqliteSession(record, storePath);
  } else {
    upsertUnifiedSession(record, storePath);
  }

  return record;
}

/**
 * Renames an existing session title.
 */
export function renameSession(
  sessionId: string,
  newTitle: string,
  storePath?: string,
): UnifiedSessionRecord {
  const existing = isSqliteAvailable()
    ? getSqliteSession(sessionId, storePath)
    : getUnifiedSession(sessionId, storePath);

  if (!existing) {
    throw new Error(`Cannot rename session: Session '${sessionId}' not found.`);
  }

  const updated: UnifiedSessionRecord = {
    ...existing,
    title: newTitle.trim() || existing.title,
    updatedAt: Date.now(),
  };

  if (isSqliteAvailable()) {
    return upsertSqliteSession(updated, storePath);
  }
  return upsertUnifiedSession(updated, storePath);
}
