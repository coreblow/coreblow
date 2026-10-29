import fs from "node:fs";
import path from "node:path";
import { sameFileIdentity } from "./file-identity.js";
import { replaceFileAtomic } from "./replace-file.js";

export const DEFAULT_JSON_DURABLE_QUEUE_ENTRY_MAX_BYTES = 16 * 1024 * 1024;

const SAFE_PATH_SEGMENT_PATTERN = /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/;

function isSafePathSegment(segment: string): boolean {
  return (
    segment !== "" &&
    segment !== "." &&
    segment !== ".." &&
    !segment.includes("/") &&
    !segment.includes("\\") &&
    !segment.includes("\0") &&
    !segment.startsWith(".") &&
    SAFE_PATH_SEGMENT_PATTERN.test(segment)
  );
}

function assertSafeQueueEntryId(id: string): void {
  if (!isSafePathSegment(id)) {
    throw new Error("queue entry id must be a safe path segment");
  }
}

function getErrnoCode(error: unknown): string | null {
  return error && typeof error === "object" && "code" in error
    ? String((error as { code?: unknown }).code)
    : null;
}

export async function unlinkBestEffort(filePath: string): Promise<void> {
  await fs.promises.unlink(filePath).catch(() => undefined);
}

export async function jsonDurableQueueEntryExists(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.promises.lstat(filePath);
    return stat.isFile();
  } catch (error) {
    if (getErrnoCode(error) === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function unlinkStaleTmpBestEffort(filePath: string, now: number, maxAgeMs: number): Promise<void> {
  try {
    const stat = await fs.promises.stat(filePath);
    if (stat.isFile() && now - stat.mtimeMs >= maxAgeMs) {
      await unlinkBestEffort(filePath);
    }
  } catch (error) {
    if (getErrnoCode(error) !== "ENOENT") {
      throw error;
    }
  }
}

export function resolveJsonDurableQueueEntryPaths(
  queueDir: string,
  id: string,
): { jsonPath: string; deliveredPath: string } {
  assertSafeQueueEntryId(id);
  return {
    jsonPath: path.join(queueDir, `${id}.json`),
    deliveredPath: path.join(queueDir, `${id}.delivered`),
  };
}

export async function ensureJsonDurableQueueDirs(params: {
  queueDir: string;
  failedDir: string;
}): Promise<void> {
  await fs.promises.mkdir(params.queueDir, { recursive: true, mode: 0o700 });
  await fs.promises.mkdir(params.failedDir, { recursive: true, mode: 0o700 });
}

export async function writeJsonDurableQueueEntry(params: {
  filePath: string;
  entry: unknown;
  tempPrefix?: string;
}): Promise<void> {
  await replaceFileAtomic({
    filePath: params.filePath,
    content: JSON.stringify(params.entry, null, 2),
    mode: 0o600,
    tempPrefix: params.tempPrefix,
  });
}

async function readBoundedUtf8File(params: {
  filePath: string;
  maxBytes: number;
}): Promise<string> {
  const initialStat = await fs.promises.lstat(params.filePath);
  if (initialStat.isSymbolicLink() || !initialStat.isFile()) {
    throw new Error("queue entry is not a regular file");
  }
  if (initialStat.size > params.maxBytes) {
    throw new Error(`queue entry exceeds ${params.maxBytes} bytes`);
  }
  const noFollow =
    typeof fs.constants.O_NOFOLLOW === "number" && process.platform !== "win32"
      ? fs.constants.O_NOFOLLOW
      : 0;
  const handle = await fs.promises.open(params.filePath, fs.constants.O_RDONLY | noFollow);
  try {
    const openedStat = await handle.stat();
    const pathStat = await fs.promises.lstat(params.filePath);
    if (
      !openedStat.isFile() ||
      pathStat.isSymbolicLink() ||
      !pathStat.isFile() ||
      !sameFileIdentity(initialStat, openedStat) ||
      !sameFileIdentity(pathStat, openedStat)
    ) {
      throw new Error("queue entry changed during read");
    }
    const chunks: Buffer[] = [];
    const scratch = Buffer.allocUnsafe(Math.min(64 * 1024, params.maxBytes + 1));
    let total = 0;
    while (true) {
      const { bytesRead } = await handle.read(scratch, 0, scratch.length, null);
      if (bytesRead === 0) {
        return Buffer.concat(chunks, total).toString("utf8");
      }
      total += bytesRead;
      if (total > params.maxBytes) {
        throw new Error(`queue entry exceeds ${params.maxBytes} bytes`);
      }
      chunks.push(Buffer.from(scratch.subarray(0, bytesRead)));
    }
  } finally {
    await handle.close();
  }
}

export async function readJsonDurableQueueEntry<T = unknown>(
  filePath: string,
  options: { maxBytes?: number } = {},
): Promise<T> {
  return JSON.parse(
    await readBoundedUtf8File({
      filePath,
      maxBytes: options.maxBytes ?? DEFAULT_JSON_DURABLE_QUEUE_ENTRY_MAX_BYTES,
    }),
  ) as T;
}

export async function ackJsonDurableQueueEntry(paths: {
  jsonPath: string;
  deliveredPath: string;
}): Promise<void> {
  try {
    await fs.promises.rename(paths.jsonPath, paths.deliveredPath);
  } catch (error) {
    if (getErrnoCode(error) === "ENOENT") {
      await unlinkBestEffort(paths.deliveredPath);
      return;
    }
    throw error;
  }
  await unlinkBestEffort(paths.deliveredPath);
}

export async function loadJsonDurableQueueEntry<T = unknown>(params: {
  paths: { jsonPath: string; deliveredPath: string };
  tempPrefix?: string;
  maxBytes?: number;
  read?: (entry: T, filePath: string) => Promise<{ entry: T; migrated?: boolean }> | { entry: T; migrated?: boolean };
}): Promise<T | null> {
  try {
    const stat = await fs.promises.lstat(params.paths.jsonPath);
    if (!stat.isFile()) {
      return null;
    }
    const raw = await readJsonDurableQueueEntry<T>(params.paths.jsonPath, {
      maxBytes: params.maxBytes,
    });
    const result = params.read ? await params.read(raw, params.paths.jsonPath) : { entry: raw };
    if (result.migrated) {
      await writeJsonDurableQueueEntry({
        filePath: params.paths.jsonPath,
        entry: result.entry,
        tempPrefix: params.tempPrefix,
      });
    }
    return result.entry;
  } catch (error) {
    if (getErrnoCode(error) === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function loadPendingJsonDurableQueueEntries<T = unknown>(options: {
  queueDir: string;
  tempPrefix?: string;
  cleanupTmpMaxAgeMs?: number;
  maxBytes?: number;
  read?: (entry: T, filePath: string) => Promise<{ entry: T; migrated?: boolean }> | { entry: T; migrated?: boolean };
}): Promise<T[]> {
  let files: string[];
  try {
    files = await fs.promises.readdir(options.queueDir);
  } catch (error) {
    if (getErrnoCode(error) === "ENOENT") {
      return [];
    }
    throw error;
  }
  const now = Date.now();
  for (const file of files) {
    if (file.endsWith(".delivered")) {
      await unlinkBestEffort(path.join(options.queueDir, file));
    } else if (options.cleanupTmpMaxAgeMs !== undefined && file.endsWith(".tmp")) {
      await unlinkStaleTmpBestEffort(
        path.join(options.queueDir, file),
        now,
        options.cleanupTmpMaxAgeMs,
      );
    }
  }
  const entries: T[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) {
      continue;
    }
    const filePath = path.join(options.queueDir, file);
    try {
      const stat = await fs.promises.lstat(filePath);
      if (!stat.isFile()) {
        continue;
      }
      const raw = await readJsonDurableQueueEntry<T>(filePath, { maxBytes: options.maxBytes });
      const result = options.read ? await options.read(raw, filePath) : { entry: raw };
      if (result.migrated) {
        await writeJsonDurableQueueEntry({
          filePath,
          entry: result.entry,
          tempPrefix: options.tempPrefix,
        });
      }
      entries.push(result.entry);
    } catch {
      continue;
    }
  }
  return entries;
}

export async function moveJsonDurableQueueEntryToFailed(params: {
  queueDir: string;
  failedDir: string;
  id: string;
}): Promise<void> {
  assertSafeQueueEntryId(params.id);
  await fs.promises.mkdir(params.failedDir, { recursive: true, mode: 0o700 });
  await fs.promises.rename(
    path.join(params.queueDir, `${params.id}.json`),
    path.join(params.failedDir, `${params.id}.json`),
  );
}
