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

// Class-based cache — used by agent-engine.ts OOP facade
export class BootstrapCache<T> {
  private cache = new Map<string, { value: T; expiresAt: number; ttl: number }>();
  private maxSize: number;
  private defaultTtl: number;
  private totalHits = 0;

  constructor(maxSize: number = 100, defaultTtlMs: number = 0) {
    this.maxSize = maxSize;
    this.defaultTtl = defaultTtlMs;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt > 0 && Date.now() >= entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    this.totalHits++;
    return entry.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const first = this.cache.keys().next().value;
      if (first) this.cache.delete(first);
    }
    const ttl = ttlMs ?? this.defaultTtl;
    const expiresAt = ttl > 0 ? Date.now() + ttl : 0;
    this.cache.set(key, { value, expiresAt, ttl });
  }

  delete(key: string): boolean { return this.cache.delete(key); }
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (entry.expiresAt > 0 && Date.now() >= entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }
  clear(): void { this.cache.clear(); }
  size(): number { return this.cache.size; }
  keys(): string[] { return [...this.cache.keys()]; }
  values(): T[] { return [...this.cache.values()].map(e => e.value); }

  prune(): number {
    const now = Date.now();
    let count = 0;
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt > 0 && now >= entry.expiresAt) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  stats(): { totalHits: number; size: number } {
    return { totalHits: this.totalHits, size: this.cache.size };
  }
}
