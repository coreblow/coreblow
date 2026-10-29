import "./fs-safe-defaults.js";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { sleep } from "../utils.js";
import { sameFileIdentity, type FileIdentityStat } from "./file-identity.js";
import { shouldRemoveDeadOwnerOrExpiredLock } from "./stale-lock-file.js";

export type SidecarLockRetryOptions = {
  retries?: number;
  factor?: number;
  minTimeout?: number;
  maxTimeout?: number;
  randomize?: boolean;
};

export type SidecarLockStaleRecovery = "fail-closed" | "remove-if-unchanged";

export type SidecarLockStaleSnapshot = {
  lockPath: string;
  normalizedTargetPath: string;
  raw: string;
  payload: Record<string, unknown> | null;
  stat?: FileIdentityStat;
};

export type FileLockRetryOptions = SidecarLockRetryOptions;
export type FileLockStaleRecovery = SidecarLockStaleRecovery;

export type FileLockAcquireOptions<TPayload extends Record<string, unknown> = Record<string, unknown>> = {
  managerKey?: string;
  lockPath?: string;
  staleMs?: number;
  timeoutMs?: number;
  retry?: SidecarLockRetryOptions;
  staleRecovery?: SidecarLockStaleRecovery;
  allowReentrant?: boolean;
  payload: () => TPayload | Promise<TPayload>;
  shouldReclaim?: (params: {
    lockPath: string;
    normalizedTargetPath: string;
    payload: Record<string, unknown> | null;
    staleMs: number;
    nowMs: number;
    heldByThisProcess: boolean;
  }) => boolean | Promise<boolean>;
  shouldRemoveStaleLock?: (snapshot: SidecarLockStaleSnapshot) => boolean | Promise<boolean>;
  metadata?: Record<string, unknown>;
};

export type FileLockHandle = {
  lockPath: string;
  normalizedTargetPath: string;
  release: () => Promise<void>;
  [Symbol.asyncDispose](): Promise<void>;
};

export type FileLockHeldEntry = {
  normalizedTargetPath: string;
  lockPath: string;
  acquiredAt: number;
  metadata: Record<string, unknown>;
  forceRelease: () => Promise<boolean>;
};

export type FileLockManager = {
  acquire<TPayload extends Record<string, unknown>>(
    targetPath: string,
    options: FileLockAcquireOptions<TPayload>,
  ): Promise<FileLockHandle>;
  withLock<T, TPayload extends Record<string, unknown>>(
    targetPath: string,
    options: FileLockAcquireOptions<TPayload>,
    fn: () => Promise<T>,
  ): Promise<T>;
  drain(): Promise<void>;
  reset(): void;
  heldEntries(): FileLockHeldEntry[];
};

type HeldLockInternal = {
  count: number;
  handle: fs.FileHandle;
  lockPath: string;
  normalizedTargetPath: string;
  acquiredAt: number;
  metadata: Record<string, unknown>;
  snapshot: { raw: string; payload: Record<string, unknown> | null; stat?: FileIdentityStat };
};

type ManagerState = {
  cleanupRegistered: boolean;
  held: Map<string, HeldLockInternal>;
};

const GLOBAL_MANAGERS_KEY = Symbol.for("coreblow.fileLockManagers");

function getGlobalManagers(): Map<string, ManagerState> {
  const globalWithState = globalThis as typeof globalThis & {
    [GLOBAL_MANAGERS_KEY]?: Map<string, ManagerState>;
  };
  if (!globalWithState[GLOBAL_MANAGERS_KEY]) {
    globalWithState[GLOBAL_MANAGERS_KEY] = new Map();
  }
  return globalWithState[GLOBAL_MANAGERS_KEY]!;
}

function resolveManagerState(key: string): ManagerState {
  const managers = getGlobalManagers();
  let state = managers.get(key);
  if (!state) {
    state = { cleanupRegistered: false, held: new Map() };
    managers.set(key, state);
  }
  return state;
}

async function resolveNormalizedTargetPath(targetPath: string): Promise<string> {
  const resolved = path.resolve(targetPath);
  const dir = path.dirname(resolved);
  await fs.mkdir(dir, { recursive: true });
  try {
    const realDir = await fs.realpath(dir);
    return path.join(realDir, path.basename(resolved));
  } catch {
    return resolved;
  }
}

async function readLockSnapshot(lockPath: string): Promise<{
  raw: string;
  payload: Record<string, unknown> | null;
  stat?: FileIdentityStat;
} | null> {
  try {
    const stat = await fs.lstat(lockPath);
    const raw = await fs.readFile(lockPath, "utf8");
    try {
      const parsed = JSON.parse(raw);
      const payload =
        parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : null;
      return { raw, payload, stat: { dev: stat.dev, ino: stat.ino } };
    } catch {
      return { raw, payload: null, stat: { dev: stat.dev, ino: stat.ino } };
    }
  } catch {
    return null;
  }
}

function snapshotMatches(
  current: { raw: string; stat?: FileIdentityStat },
  observed: { raw?: string; stat?: FileIdentityStat },
): boolean {
  if (observed.stat && current.stat && !sameFileIdentity(observed.stat, current.stat)) {
    return false;
  }
  if (observed.raw !== undefined) {
    return current.raw === observed.raw;
  }
  return observed.stat !== undefined && current.stat !== undefined;
}

async function removeLockIfUnchanged(
  lockPath: string,
  observed?: { raw?: string; stat?: FileIdentityStat } | null,
): Promise<boolean> {
  const current = await readLockSnapshot(lockPath);
  if (!current || !observed) {
    return false;
  }
  if (!snapshotMatches(current, observed)) {
    return false;
  }
  await fs.rm(lockPath, { force: true }).catch(() => undefined);
  return true;
}

async function releaseHeldLock(
  state: ManagerState,
  normalizedTargetPath: string,
  held: HeldLockInternal,
): Promise<void> {
  held.count -= 1;
  if (held.count > 0) {
    return;
  }
  state.held.delete(normalizedTargetPath);
  try {
    await held.handle.close();
  } catch {
    // Ignore close errors
  }
  await fs.rm(held.lockPath, { force: true }).catch(() => undefined);
}

function releaseAllLocksSync(state: ManagerState): void {
  for (const [targetPath, held] of state.held) {
    try {
      fsSync.rmSync(held.lockPath, { force: true });
    } catch {
      // Best-effort
    }
    state.held.delete(targetPath);
  }
}

function computeRetryDelay(retry: SidecarLockRetryOptions, attempt: number): number {
  const minTimeout = retry.minTimeout ?? 50;
  const maxTimeout = retry.maxTimeout ?? 1000;
  const factor = retry.factor ?? 1.5;
  const base = Math.min(maxTimeout, Math.max(minTimeout, minTimeout * factor ** attempt));
  const jitter = retry.randomize ? 1 + Math.random() : 1;
  return Math.min(maxTimeout, Math.round(base * jitter));
}

export function createFileLockManager(key: string): FileLockManager {
  const state = resolveManagerState(key);

  function ensureExitCleanupRegistered(): void {
    if (state.cleanupRegistered) {
      return;
    }
    state.cleanupRegistered = true;
    process.on("exit", () => releaseAllLocksSync(state));
  }

  async function acquire<TPayload extends Record<string, unknown>>(
    targetPath: string,
    options: FileLockAcquireOptions<TPayload>,
  ): Promise<FileLockHandle> {
    ensureExitCleanupRegistered();
    const normalizedTargetPath = await resolveNormalizedTargetPath(targetPath);
    const lockPath = options.lockPath ?? `${normalizedTargetPath}.lock`;
    const held = state.held.get(normalizedTargetPath);
    if (held && options.allowReentrant) {
      held.count += 1;
      const release = () => releaseHeldLock(state, normalizedTargetPath, held);
      return {
        lockPath,
        normalizedTargetPath,
        release,
        [Symbol.asyncDispose]: release,
      };
    }

    const startedAt = Date.now();
    const timeoutMs = options.timeoutMs ?? 30_000;
    const staleMs = options.staleMs ?? 30_000;
    const retry = options.retry ?? {};
    let attempt = 0;

    while (true) {
      let handle: fs.FileHandle | null = null;
      try {
        handle = await fs.open(lockPath, "wx");
        const payload = await options.payload();
        const raw = `${JSON.stringify(payload, null, 2)}\n`;
        await handle.writeFile(raw, "utf8");
        const stat = await handle.stat();
        const createdHeld: HeldLockInternal = {
          count: 1,
          handle,
          lockPath,
          normalizedTargetPath,
          acquiredAt: Date.now(),
          metadata: options.metadata ?? {},
          snapshot: { raw, payload, stat: { dev: stat.dev, ino: stat.ino } },
        };
        state.held.set(normalizedTargetPath, createdHeld);
        const release = () => releaseHeldLock(state, normalizedTargetPath, createdHeld);
        return {
          lockPath,
          normalizedTargetPath,
          release,
          [Symbol.asyncDispose]: release,
        };
      } catch (err: unknown) {
        if (handle) {
          state.held.delete(normalizedTargetPath);
          await fs.rm(lockPath, { force: true }).catch(() => undefined);
          await handle.close().catch(() => undefined);
        }
        const code = (err as { code?: string }).code;
        if (code !== "EEXIST") {
          throw err;
        }

        const nowMs = Date.now();
        const snapshot = await readLockSnapshot(lockPath);
        if (snapshot) {
          let shouldReclaim = false;
          if (options.shouldReclaim) {
            shouldReclaim = await options.shouldReclaim({
              lockPath,
              normalizedTargetPath,
              payload: snapshot.payload,
              staleMs,
              nowMs,
              heldByThisProcess: state.held.has(normalizedTargetPath),
            });
          } else {
            shouldReclaim = shouldRemoveDeadOwnerOrExpiredLock({
              payload: snapshot.payload,
              staleMs,
              nowMs,
            });
          }

          if (shouldReclaim) {
            if (options.staleRecovery === "remove-if-unchanged") {
              await removeLockIfUnchanged(lockPath, snapshot);
            } else {
              await fs.rm(lockPath, { force: true }).catch(() => undefined);
            }
            continue;
          }
        }

        if (timeoutMs !== Number.POSITIVE_INFINITY && nowMs - startedAt >= timeoutMs) {
          const timeoutError = new Error(`file lock timeout for ${normalizedTargetPath}`) as Error & {
            code: string;
            lockPath: string;
          };
          timeoutError.code = "file_lock_timeout";
          timeoutError.lockPath = lockPath;
          throw timeoutError;
        }

        attempt += 1;
        await sleep(computeRetryDelay(retry, attempt));
      }
    }
  }

  async function withLock<T, TPayload extends Record<string, unknown>>(
    targetPath: string,
    options: FileLockAcquireOptions<TPayload>,
    fn: () => Promise<T>,
  ): Promise<T> {
    const handle = await acquire(targetPath, options);
    try {
      return await fn();
    } finally {
      await handle.release();
    }
  }

  async function drain(): Promise<void> {
    for (const [targetPath, held] of Array.from(state.held.entries())) {
      state.held.delete(targetPath);
      await held.handle.close().catch(() => undefined);
      await fs.rm(held.lockPath, { force: true }).catch(() => undefined);
    }
  }

  function reset(): void {
    releaseAllLocksSync(state);
  }

  function heldEntries(): FileLockHeldEntry[] {
    return Array.from(state.held.values()).map((held) => ({
      normalizedTargetPath: held.normalizedTargetPath,
      lockPath: held.lockPath,
      acquiredAt: held.acquiredAt,
      metadata: held.metadata,
      forceRelease: async () => {
        state.held.delete(held.normalizedTargetPath);
        await held.handle.close().catch(() => undefined);
        await fs.rm(held.lockPath, { force: true }).catch(() => undefined);
        return true;
      },
    }));
  }

  return {
    acquire,
    withLock,
    drain,
    reset,
    heldEntries,
  };
}

export async function acquireFileLock<TPayload extends Record<string, unknown>>(
  targetPath: string,
  options: FileLockAcquireOptions<TPayload>,
): Promise<FileLockHandle> {
  const managerKey = options.managerKey ?? `coreblow.file-lock:${targetPath}`;
  return createFileLockManager(managerKey).acquire(targetPath, options);
}

export async function withFileLock<T, TPayload extends Record<string, unknown>>(
  targetPath: string,
  options: FileLockAcquireOptions<TPayload>,
  fn: () => Promise<T>,
): Promise<T> {
  const managerKey = options.managerKey ?? `coreblow.file-lock:${targetPath}`;
  return createFileLockManager(managerKey).withLock(targetPath, options, fn);
}

export async function drainFileLockManagerForTest(
  targetPath: string,
  managerKey?: string,
): Promise<void> {
  const key = managerKey ?? `coreblow.file-lock:${targetPath}`;
  await createFileLockManager(key).drain();
}

export function resetFileLockManagerForTest(targetPath: string, managerKey?: string): void {
  const key = managerKey ?? `coreblow.file-lock:${targetPath}`;
  createFileLockManager(key).reset();
}
