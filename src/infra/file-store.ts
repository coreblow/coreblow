import "./fs-safe-defaults.js";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  copyFileWithinRoot,
  openFileWithinRoot,
  readFileWithinRoot,
  writeFileWithinRoot,
} from "./fs-safe.js";

export type FileStoreOptions = {
  rootDir: string;
  private?: boolean;
  dirMode?: number;
  mode?: number;
  maxBytes?: number;
};

export type FileStoreWriteOptions = {
  dirMode?: number;
  mode?: number;
  maxBytes?: number;
  tempPrefix?: string;
};

export type FileStoreReadOptions = {
  encoding?: BufferEncoding;
  maxBytes?: number;
};

export type FileStorePruneOptions = {
  maxAgeMs?: number;
  filter?: (fileName: string) => boolean;
};

export type JsonFileStoreOptions = {
  defaultValue?: unknown;
};

export type JsonStore<T> = {
  get(): Promise<T | null>;
  set(value: T): Promise<void>;
  update(updater: (current: T | null) => T | Promise<T>): Promise<T>;
};

export type FileStore = {
  readonly rootDir: string;
  path(relativePath: string): string;
  root(): Promise<{ rootDir: string }>;
  write(relativePath: string, data: string | Uint8Array, options?: FileStoreWriteOptions): Promise<string>;
  writeStream(relativePath: string, stream: Readable, options?: FileStoreWriteOptions): Promise<string>;
  copyIn(relativePath: string, sourcePath: string, options?: FileStoreWriteOptions): Promise<string>;
  open(relativePath: string): Promise<{ handle: fs.FileHandle; realPath: string }>;
  read(relativePath: string, options?: FileStoreReadOptions): Promise<{ buffer: Buffer }>;
  readBytes(relativePath: string, options?: FileStoreReadOptions): Promise<Buffer>;
  readText(relativePath: string, options?: FileStoreReadOptions): Promise<string>;
  readTextIfExists(relativePath: string, options?: FileStoreReadOptions): Promise<string | null>;
  readJson<T = unknown>(relativePath: string, options?: FileStoreReadOptions): Promise<T>;
  readJsonIfExists<T = unknown>(relativePath: string, options?: FileStoreReadOptions): Promise<T | null>;
  remove(relativePath: string): Promise<void>;
  exists(relativePath: string): Promise<boolean>;
  writeText(relativePath: string, data: string | Uint8Array, options?: FileStoreWriteOptions): Promise<string>;
  writeJson(
    relativePath: string,
    data: unknown,
    options?: FileStoreWriteOptions & { trailingNewline?: boolean },
  ): Promise<string>;
  json<T = unknown>(relativePath: string, options?: JsonFileStoreOptions): JsonStore<T>;
  pruneExpired(options: FileStorePruneOptions): Promise<void>;
};

export type FileStoreSync = {
  readonly rootDir: string;
  path(relativePath: string): string;
  readTextIfExists(relativePath: string, options?: { maxBytes?: number }): string | null;
  readJsonIfExists<T = unknown>(relativePath: string, options?: { maxBytes?: number }): T | null;
  write(relativePath: string, data: string | Uint8Array, options?: FileStoreWriteOptions): string;
  writeText(relativePath: string, data: string | Uint8Array, options?: FileStoreWriteOptions): string;
  writeJson(
    relativePath: string,
    data: unknown,
    options?: FileStoreWriteOptions & { trailingNewline?: boolean },
  ): string;
};

function resolveSafeStorePath(rootDir: string, relativePath: string): string {
  const normalized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "");
  const resolved = path.resolve(rootDir, normalized);
  if (!resolved.startsWith(path.resolve(rootDir))) {
    throw new Error(`Path traversal denied: ${relativePath} escapes root ${rootDir}`);
  }
  return resolved;
}

export function fileStore(options: FileStoreOptions): FileStore {
  const rootDir = path.resolve(options.rootDir);

  function resolvePath(rel: string): string {
    return resolveSafeStorePath(rootDir, rel);
  }

  async function ensureInitialized(): Promise<void> {
    await fs.mkdir(rootDir, { recursive: true, mode: options.dirMode ?? 0o700 });
  }

  return {
    rootDir,
    path(rel: string) {
      return resolvePath(rel);
    },
    async root() {
      await ensureInitialized();
      return { rootDir };
    },
    async write(rel: string, data: string | Uint8Array, opts?: FileStoreWriteOptions) {
      await ensureInitialized();
      const fullPath = resolvePath(rel);
      const relativePath = path.relative(rootDir, fullPath);
      await writeFileWithinRoot({
        rootDir,
        relativePath,
        data: typeof data === "string" ? Buffer.from(data, "utf8") : Buffer.from(data),
      });
      return fullPath;
    },
    async writeStream(rel: string, stream: Readable, opts?: FileStoreWriteOptions) {
      await ensureInitialized();
      const fullPath = resolvePath(rel);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      const tempPath = `${fullPath}.${process.pid}.${Date.now()}.tmp`;
      const outHandle = await fs.open(tempPath, "w", opts?.mode ?? options.mode ?? 0o600);
      try {
        await pipeline(stream, outHandle.createWriteStream());
      } finally {
        await outHandle.close().catch(() => {});
      }
      await fs.rename(tempPath, fullPath);
      return fullPath;
    },
    async copyIn(rel: string, sourcePath: string, opts?: FileStoreWriteOptions) {
      await ensureInitialized();
      const fullPath = resolvePath(rel);
      const relativePath = path.relative(rootDir, fullPath);
      await copyFileWithinRoot({
        rootDir,
        relativePath,
        sourcePath,
      });
      return fullPath;
    },
    async open(rel: string) {
      await ensureInitialized();
      const relativePath = path.relative(rootDir, resolvePath(rel));
      const res = await openFileWithinRoot({
        rootDir,
        relativePath,
      });
      return { handle: res.handle, realPath: res.realPath };
    },
    async read(rel: string, opts?: FileStoreReadOptions) {
      const bytes = await this.readBytes(rel, opts);
      return { buffer: bytes };
    },
    async readBytes(rel: string, opts?: FileStoreReadOptions) {
      const relativePath = path.relative(rootDir, resolvePath(rel));
      const res = await readFileWithinRoot({
        rootDir,
        relativePath,
        maxBytes: opts?.maxBytes ?? options.maxBytes,
      });
      return res.buffer;
    },
    async readText(rel: string, opts?: FileStoreReadOptions) {
      const buf = await this.readBytes(rel, opts);
      return buf.toString(opts?.encoding ?? "utf8");
    },
    async readTextIfExists(rel: string, opts?: FileStoreReadOptions) {
      try {
        return await this.readText(rel, opts);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") {
          return null;
        }
        throw err;
      }
    },
    async readJson<T = unknown>(rel: string, opts?: FileStoreReadOptions): Promise<T> {
      const text = await this.readText(rel, opts);
      return JSON.parse(text) as T;
    },
    async readJsonIfExists<T = unknown>(rel: string, opts?: FileStoreReadOptions): Promise<T | null> {
      const text = await this.readTextIfExists(rel, opts);
      if (text === null) {
        return null;
      }
      return JSON.parse(text) as T;
    },
    async remove(rel: string) {
      const fullPath = resolvePath(rel);
      await fs.rm(fullPath, { force: true });
    },
    async exists(rel: string) {
      const fullPath = resolvePath(rel);
      try {
        await fs.access(fullPath);
        return true;
      } catch {
        return false;
      }
    },
    async writeText(rel: string, data: string | Uint8Array, opts?: FileStoreWriteOptions) {
      return this.write(rel, data, opts);
    },
    async writeJson(
      rel: string,
      data: unknown,
      opts?: FileStoreWriteOptions & { trailingNewline?: boolean },
    ) {
      const str = JSON.stringify(data, null, 2);
      const content = opts?.trailingNewline !== false ? `${str}\n` : str;
      return this.write(rel, content, opts);
    },
    json<T = unknown>(rel: string, jsonOpts?: JsonFileStoreOptions): JsonStore<T> {
      return {
        get: async () => {
          const res = await this.readJsonIfExists<T>(rel);
          return res !== null ? res : ((jsonOpts?.defaultValue ?? null) as T | null);
        },
        set: async (val: T) => {
          await this.writeJson(rel, val);
        },
        update: async (updater: (curr: T | null) => T | Promise<T>) => {
          const curr = await this.readJsonIfExists<T>(rel);
          const next = await updater(curr !== null ? curr : ((jsonOpts?.defaultValue ?? null) as T | null));
          await this.writeJson(rel, next);
          return next;
        },
      };
    },
    async pruneExpired(pruneOpts: FileStorePruneOptions) {
      if (!pruneOpts.maxAgeMs) {
        return;
      }
      try {
        const entries = await fs.readdir(rootDir, { withFileTypes: true });
        const now = Date.now();
        for (const entry of entries) {
          if (!entry.isFile()) continue;
          if (pruneOpts.filter && !pruneOpts.filter(entry.name)) continue;
          const fullPath = path.join(rootDir, entry.name);
          const stat = await fs.stat(fullPath);
          if (now - stat.mtimeMs > pruneOpts.maxAgeMs) {
            await fs.rm(fullPath, { force: true }).catch(() => {});
          }
        }
      } catch {
        // Ignore prune scan failure
      }
    },
  };
}

export function fileStoreSync(options: FileStoreOptions): FileStoreSync {
  const rootDir = path.resolve(options.rootDir);

  function resolvePath(rel: string): string {
    return resolveSafeStorePath(rootDir, rel);
  }

  function ensureInitializedSync(): void {
    fsSync.mkdirSync(rootDir, { recursive: true, mode: options.dirMode ?? 0o700 });
  }

  return {
    rootDir,
    path(rel: string) {
      return resolvePath(rel);
    },
    readTextIfExists(rel: string, opts?: { maxBytes?: number }) {
      const fullPath = resolvePath(rel);
      try {
        const content = fsSync.readFileSync(fullPath, "utf8");
        if (opts?.maxBytes !== undefined && Buffer.byteLength(content) > opts.maxBytes) {
          throw new Error(`File exceeds maxBytes of ${opts.maxBytes}`);
        }
        return content;
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") {
          return null;
        }
        throw err;
      }
    },
    readJsonIfExists<T = unknown>(rel: string, opts?: { maxBytes?: number }): T | null {
      const text = this.readTextIfExists(rel, opts);
      if (text === null) return null;
      return JSON.parse(text) as T;
    },
    write(rel: string, data: string | Uint8Array, opts?: FileStoreWriteOptions) {
      ensureInitializedSync();
      const fullPath = resolvePath(rel);
      fsSync.mkdirSync(path.dirname(fullPath), { recursive: true });
      fsSync.writeFileSync(fullPath, data, {
        mode: opts?.mode ?? options.mode ?? (options.private ? 0o600 : 0o644),
      });
      return fullPath;
    },
    writeText(rel: string, data: string | Uint8Array, opts?: FileStoreWriteOptions) {
      return this.write(rel, data, opts);
    },
    writeJson(
      rel: string,
      data: unknown,
      opts?: FileStoreWriteOptions & { trailingNewline?: boolean },
    ) {
      const str = JSON.stringify(data, null, 2);
      const content = opts?.trailingNewline !== false ? `${str}\n` : str;
      return this.write(rel, content, opts);
    },
  };
}
