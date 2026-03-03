/**
 * agents/bootstrap-cache.ts
 * Workspace bootstrap file cache keyed by session.
 * Caches loaded bootstrap files per session key to avoid redundant filesystem reads
 * during a single agent run. Provides invalidation hooks for session rollovers.
 */

import { loadWorkspaceBootstrapFiles, type WorkspaceBootstrapFile } from "./workspace.js";

const sessionBootstrapCache = new Map<string, WorkspaceBootstrapFile[]>();

/**
 * Retrieve cached bootstrap files for the given session key,
 * or load them fresh from the workspace directory and cache the result.
 */
export async function getOrLoadBootstrapFiles(params: {
  workspaceDir: string;
  sessionKey: string;
}): Promise<WorkspaceBootstrapFile[]> {
  const cached = sessionBootstrapCache.get(params.sessionKey);
  if (cached) {
    return cached;
  }

  const loaded = await loadWorkspaceBootstrapFiles(params.workspaceDir);
  sessionBootstrapCache.set(params.sessionKey, loaded);
  return loaded;
}

/**
 * Remove the cached bootstrap snapshot for a specific session key.
 */
export function clearBootstrapSnapshot(sessionKey: string): void {
  sessionBootstrapCache.delete(sessionKey);
}

/**
 * Invalidate cached bootstrap data when a session rolls over to a new ID.
 * Only clears if both sessionKey and previousSessionId are provided,
 * indicating an actual rollover rather than a fresh session.
 */
export function clearBootstrapSnapshotOnSessionRollover(params: {
  sessionKey?: string;
  previousSessionId?: string;
}): void {
  if (!params.sessionKey || !params.previousSessionId) {
    return;
  }

  clearBootstrapSnapshot(params.sessionKey);
}

/**
 * Clear all cached bootstrap snapshots across all sessions.
 */
export function clearAllBootstrapSnapshots(): void {
  sessionBootstrapCache.clear();
}

// Stub class — used by agent-engine.ts OOP facade
export class BootstrapCache<T> {
  private cache = new Map<string, T>();
  private maxSize: number;
  constructor(maxSize: number = 100) { this.maxSize = maxSize; }
  get(key: string): T | undefined { return this.cache.get(key); }
  set(key: string, value: T): void { if (this.cache.size >= this.maxSize) { const first = this.cache.keys().next().value; if (first) this.cache.delete(first); } this.cache.set(key, value); }
  delete(key: string): boolean { return this.cache.delete(key); }
}
