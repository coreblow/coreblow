import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { resolveStateDir } from "../config/paths.js";
import {
  appendTurnToSqliteSession,
  clearSqliteSessions,
  deleteSqliteSession,
  getOrCreateSqliteDb,
  getSqliteSession,
  isSqliteAvailable,
  listSqliteSessions,
  upsertSqliteSession,
} from "./sqlite-session-store.js";

export type SessionSurface = "desktop" | "cli" | "cron" | "channel" | "web";

export interface UnifiedSessionMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: number;
  attachedFiles?: string[];
  toolSteps?: string[];
}

export interface UnifiedSessionRecord {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  cwd?: string;
  executionProfile?: string;
  model?: string;
  surface: SessionSurface;
  messages: UnifiedSessionMessage[];
}

export interface UnifiedSessionStoreFile {
  version: 1;
  sessions: Record<string, UnifiedSessionRecord>;
}

/**
 * Resolves the absolute path to the unified session store JSON file.
 * Defaults to ~/.coreblow/sessions/sessions-store.json (or inside COREBLOW_STATE_DIR).
 */
export function resolveUnifiedSessionStorePath(customPath?: string): string {
  if (customPath && customPath.trim().length > 0) {
    const raw = customPath.trim();
    if (raw.startsWith("~")) {
      const home = process.env.HOME ?? os.homedir();
      return path.resolve(home, raw.slice(1).replace(/^\/+/, ""));
    }
    return path.resolve(raw);
  }

  const envPath = process.env.COREBLOW_SESSION_STORE_PATH?.trim();
  if (envPath) {
    if (envPath.startsWith("~")) {
      const home = process.env.HOME ?? os.homedir();
      return path.resolve(home, envPath.slice(1).replace(/^\/+/, ""));
    }
    return path.resolve(envPath);
  }

  const stateDir = resolveStateDir();
  return path.join(stateDir, "sessions", "sessions-store.json");
}

/**
 * Loads the unified session store synchronously.
 * Prefers SQLite WAL store when available, falling back to JSON.
 */
export function loadUnifiedSessionStoreSync(storePath?: string): UnifiedSessionStoreFile {
  if (isSqliteAvailable()) {
    try {
      const db = getOrCreateSqliteDb(storePath);
      if (db) {
        const list = listSqliteSessions({ storePath, limit: 10000 });
        const sessions: Record<string, UnifiedSessionRecord> = {};
        for (const s of list) {
          sessions[s.id] = s;
        }
        return { version: 1, sessions };
      }
    } catch {
      // Fall through to JSON
    }
  }

  const filePath = resolveUnifiedSessionStorePath(storePath);
  if (!fs.existsSync(filePath)) {
    return { version: 1, sessions: {} };
  }

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<UnifiedSessionStoreFile>;
    if (parsed && typeof parsed === "object" && typeof parsed.sessions === "object") {
      return {
        version: 1,
        sessions: (parsed.sessions ?? {}) as Record<string, UnifiedSessionRecord>,
      };
    }
  } catch {
    // Return empty store on corrupted file
  }

  return { version: 1, sessions: {} };
}

/**
 * Atomically saves the unified session store to disk synchronously.
 * Updates both the SQLite WAL database and sessions-store.json.
 */
export function saveUnifiedSessionStoreSync(
  store: UnifiedSessionStoreFile,
  storePath?: string,
): void {
  // Sync to SQLite store
  if (isSqliteAvailable()) {
    try {
      const db = getOrCreateSqliteDb(storePath);
      if (db) {
        clearSqliteSessions(storePath);
        for (const s of Object.values(store.sessions)) {
          upsertSqliteSession(s, storePath);
        }
      }
    } catch {
      // Non-fatal if SQLite sync fails
    }
  }

  const filePath = resolveUnifiedSessionStorePath(storePath);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const json = JSON.stringify(store, null, 2);
  const tmpFile = `${filePath}.tmp.${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  try {
    fs.writeFileSync(tmpFile, json, "utf-8");
    fs.renameSync(tmpFile, filePath);
  } catch {
    fs.writeFileSync(filePath, json, "utf-8");
    try {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    } catch {}
  }
}

/**
 * Lists unified session records sorted by updatedAt descending.
 * Optionally filters by search query matching title, id, or message contents via FTS5.
 */
export function listUnifiedSessions(options?: {
  query?: string;
  limit?: number;
  storePath?: string;
}): UnifiedSessionRecord[] {
  if (isSqliteAvailable()) {
    try {
      return listSqliteSessions(options);
    } catch {
      // Fall through to JSON-based implementation
    }
  }

  const store = loadUnifiedSessionStoreSync(options?.storePath);
  let list = Object.values(store.sessions);

  const query = options?.query?.trim().toLowerCase();
  if (query) {
    list = list.filter((s) => {
      if (s.id.toLowerCase().includes(query)) return true;
      if (s.title.toLowerCase().includes(query)) return true;
      return s.messages.some((m) => m.content.toLowerCase().includes(query));
    });
  }

  list.sort((a, b) => b.updatedAt - a.updatedAt);

  if (typeof options?.limit === "number" && options.limit > 0) {
    list = list.slice(0, options.limit);
  }

  return list;
}

/**
 * Retrieves a single unified session record by ID.
 */
export function getUnifiedSession(
  id: string,
  storePath?: string,
): UnifiedSessionRecord | undefined {
  const targetId = id.trim();
  if (!targetId) return undefined;

  if (isSqliteAvailable()) {
    try {
      const record = getSqliteSession(targetId, storePath);
      if (record) return record;
    } catch {
      // Fall through to JSON
    }
  }

  const store = loadUnifiedSessionStoreSync(storePath);
  if (store.sessions[targetId]) {
    return store.sessions[targetId];
  }
  // Case-insensitive fallback
  const lower = targetId.toLowerCase();
  for (const s of Object.values(store.sessions)) {
    if (s.id.toLowerCase() === lower) return s;
  }
  return undefined;
}

/**
 * Upserts a session record into the unified store.
 */
export function upsertUnifiedSession(
  session: Partial<UnifiedSessionRecord> & { id: string },
  storePath?: string,
): UnifiedSessionRecord {
  if (isSqliteAvailable()) {
    try {
      const record = upsertSqliteSession(session, storePath);
      // Also update JSON mirror if file exists
      const filePath = resolveUnifiedSessionStorePath(storePath);
      if (fs.existsSync(filePath)) {
        try {
          const store = loadUnifiedSessionStoreSync(storePath);
          store.sessions[record.id] = record;
          const json = JSON.stringify(store, null, 2);
          fs.writeFileSync(filePath, json, "utf-8");
        } catch {}
      }
      return record;
    } catch {
      // Fall through to JSON
    }
  }

  const store = loadUnifiedSessionStoreSync(storePath);
  const id = session.id.trim();
  const existing = store.sessions[id];
  const now = Date.now();

  const title =
    session.title?.trim() ||
    existing?.title ||
    session.messages?.[0]?.content?.slice(0, 48) ||
    "New Chat";

  const record: UnifiedSessionRecord = {
    id,
    title,
    createdAt: existing?.createdAt ?? session.createdAt ?? now,
    updatedAt: session.updatedAt ?? now,
    cwd: session.cwd ?? existing?.cwd,
    executionProfile: session.executionProfile ?? existing?.executionProfile,
    model: session.model ?? existing?.model,
    surface: session.surface ?? existing?.surface ?? "desktop",
    messages: Array.isArray(session.messages) ? [...session.messages] : (existing?.messages ?? []),
  };

  store.sessions[id] = record;
  saveUnifiedSessionStoreSync(store, storePath);
  return record;
}

/**
 * Appends a user/assistant turn to a unified session record.
 * Automatically generates a clean title from prompt if creating a new session.
 */
export function appendTurnToUnifiedSession(params: {
  sessionId?: string;
  prompt: string;
  reply: string;
  toolSteps?: string[];
  attachedFiles?: string[];
  surface?: SessionSurface;
  cwd?: string;
  executionProfile?: string;
  model?: string;
  storePath?: string;
}): UnifiedSessionRecord {
  if (isSqliteAvailable()) {
    try {
      const record = appendTurnToSqliteSession(params);
      // Keep JSON mirror in sync if it exists on disk
      const filePath = resolveUnifiedSessionStorePath(params.storePath);
      if (fs.existsSync(filePath)) {
        try {
          const raw = fs.readFileSync(filePath, "utf-8");
          const parsed = JSON.parse(raw) as Partial<UnifiedSessionStoreFile>;
          if (parsed && typeof parsed === "object" && typeof parsed.sessions === "object") {
            parsed.sessions[record.id] = record;
            fs.writeFileSync(filePath, JSON.stringify(parsed, null, 2), "utf-8");
          }
        } catch {}
      }
      return record;
    } catch {
      // Fall through to JSON
    }
  }

  const id =
    params.sessionId?.trim() ||
    `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const store = loadUnifiedSessionStoreSync(params.storePath);
  const existing = store.sessions[id];
  const now = Date.now();

  // Deduplicate if the last turn already matches this exact prompt and reply within 10 seconds
  if (existing?.messages && existing.messages.length >= 2) {
    const lastUser = existing.messages[existing.messages.length - 2];
    const lastAssistant = existing.messages[existing.messages.length - 1];
    if (
      lastUser.role === "user" &&
      lastUser.content === params.prompt &&
      lastAssistant.role === "assistant" &&
      lastAssistant.content === params.reply &&
      Math.abs(now - lastAssistant.createdAt) < 10000
    ) {
      return existing;
    }
  }

  const userMsgId = `msg_${now}_user_${Math.random().toString(36).slice(2, 6)}`;
  const assistantMsgId = `msg_${now + 1}_assistant_${Math.random().toString(36).slice(2, 6)}`;

  const userMessage: UnifiedSessionMessage = {
    id: userMsgId,
    role: "user",
    content: params.prompt,
    createdAt: now,
    attachedFiles: params.attachedFiles && params.attachedFiles.length > 0 ? [...params.attachedFiles] : undefined,
  };

  const assistantMessage: UnifiedSessionMessage = {
    id: assistantMsgId,
    role: "assistant",
    content: params.reply,
    createdAt: now + 1,
    toolSteps: params.toolSteps && params.toolSteps.length > 0 ? [...params.toolSteps] : undefined,
  };

  const title =
    existing?.title ||
    (params.prompt.length > 48
      ? `${params.prompt.slice(0, 48).trim()}...`
      : params.prompt.trim()) ||
    "New Chat";

  const updatedMessages = existing?.messages ? [...existing.messages] : [];
  updatedMessages.push(userMessage, assistantMessage);

  const record: UnifiedSessionRecord = {
    id,
    title,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now + 1,
    cwd: params.cwd ?? existing?.cwd,
    executionProfile: params.executionProfile ?? existing?.executionProfile,
    model: params.model ?? existing?.model,
    surface: params.surface ?? existing?.surface ?? "desktop",
    messages: updatedMessages,
  };

  store.sessions[id] = record;
  saveUnifiedSessionStoreSync(store, params.storePath);
  return record;
}

/**
 * Deletes a session by ID from the unified session store.
 */
export function deleteUnifiedSession(id: string, storePath?: string): boolean {
  const targetId = id.trim();
  if (!targetId) return false;

  let deletedFromSqlite = false;
  if (isSqliteAvailable()) {
    try {
      deletedFromSqlite = deleteSqliteSession(targetId, storePath);
    } catch {
      // Fall through to JSON
    }
  }

  // Keep JSON mirror in sync if it exists on disk
  const filePath = resolveUnifiedSessionStorePath(storePath);
  let deletedFromJson = false;
  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw) as Partial<UnifiedSessionStoreFile>;
      if (parsed?.sessions && typeof parsed.sessions === "object") {
        if (parsed.sessions[targetId]) {
          delete parsed.sessions[targetId];
          deletedFromJson = true;
        } else {
          const lower = targetId.toLowerCase();
          for (const key of Object.keys(parsed.sessions)) {
            if (key.toLowerCase() === lower) {
              delete parsed.sessions[key];
              deletedFromJson = true;
              break;
            }
          }
        }
        if (deletedFromJson) {
          fs.writeFileSync(filePath, JSON.stringify(parsed, null, 2), "utf-8");
        }
      }
    } catch {}
  }

  if (deletedFromSqlite || deletedFromJson) {
    return true;
  }

  const store = loadUnifiedSessionStoreSync(storePath);
  if (store.sessions[targetId]) {
    delete store.sessions[targetId];
    saveUnifiedSessionStoreSync(store, storePath);
    return true;
  }

  // Case-insensitive check
  const lower = targetId.toLowerCase();
  for (const key of Object.keys(store.sessions)) {
    if (key.toLowerCase() === lower) {
      delete store.sessions[key];
      saveUnifiedSessionStoreSync(store, storePath);
      return true;
    }
  }

  return false;
}

/**
 * Clears all sessions from the unified store (primarily for unit tests).
 */
export function clearUnifiedSessions(storePath?: string): void {
  if (isSqliteAvailable()) {
    try {
      clearSqliteSessions(storePath);
    } catch {}
  }
  const filePath = resolveUnifiedSessionStorePath(storePath);
  if (fs.existsSync(filePath)) {
    try {
      fs.writeFileSync(filePath, JSON.stringify({ version: 1, sessions: {} }, null, 2), "utf-8");
    } catch {}
  }
}
