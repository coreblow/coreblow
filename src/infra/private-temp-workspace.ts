import "./fs-safe-defaults.js";
import crypto from "node:crypto";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileStore, fileStoreSync, type FileStore, type FileStoreSync } from "./file-store.js";

export type TempWorkspaceOptions = {
  rootDir: string;
  prefix: string;
  dirMode?: number;
  mode?: number;
};

export type TempWorkspace = {
  dir: string;
  store: FileStore;
  path(fileName: string): string;
  write(fileName: string, data: string | Uint8Array): Promise<string>;
  writeText(fileName: string, data: string): Promise<string>;
  writeJson(fileName: string, data: unknown, options?: { trailingNewline?: boolean }): Promise<string>;
  copyIn(fileName: string, sourcePath: string): Promise<string>;
  read(fileName: string): Promise<Buffer>;
  cleanup(): Promise<void>;
  [Symbol.asyncDispose](): Promise<void>;
};

export type TempWorkspaceSync = {
  dir: string;
  store: FileStoreSync;
  path(fileName: string): string;
  write(fileName: string, data: string | Uint8Array): string;
  writeText(fileName: string, data: string): string;
  writeJson(fileName: string, data: unknown, options?: { trailingNewline?: boolean }): string;
  read(fileName: string): Buffer;
  cleanup(): void;
  [Symbol.dispose](): void;
};

function sanitizeTempPrefix(prefix: string): string {
  const sanitized = prefix.trim().replace(/[^a-zA-Z0-9._-]/g, "-");
  if (!sanitized || sanitized === "." || sanitized === "..") {
    return "coreblow-temp-";
  }
  return sanitized.endsWith("-") ? sanitized : `${sanitized}-`;
}

function assertSafeFileName(fileName: string): string {
  const val = fileName.trim();
  if (
    !val ||
    val === "." ||
    val === ".." ||
    val.includes("/") ||
    val.includes("\\") ||
    val.includes("\0") ||
    path.basename(val) !== val
  ) {
    throw new Error(`Invalid workspace file name: ${fileName}`);
  }
  return val;
}

export async function tempWorkspace(options: TempWorkspaceOptions): Promise<TempWorkspace> {
  const rootDir = path.resolve(options.rootDir);
  await fs.mkdir(rootDir, { recursive: true, mode: options.dirMode ?? 0o700 });
  const prefix = path.join(rootDir, sanitizeTempPrefix(options.prefix));
  const dir = await fs.mkdtemp(prefix);
  if (options.dirMode !== undefined) {
    await fs.chmod(dir, options.dirMode);
  }
  const store = fileStore({ rootDir: dir, private: true, mode: options.mode });

  const cleanup = async () => {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  };

  return {
    dir,
    store,
    path(fileName: string) {
      return path.join(dir, assertSafeFileName(fileName));
    },
    async write(fileName: string, data: string | Uint8Array) {
      return store.write(assertSafeFileName(fileName), data, { mode: options.mode });
    },
    async writeText(fileName: string, data: string) {
      return store.writeText(assertSafeFileName(fileName), data, { mode: options.mode });
    },
    async writeJson(fileName: string, data: unknown, opts?: { trailingNewline?: boolean }) {
      return store.writeJson(assertSafeFileName(fileName), data, {
        mode: options.mode,
        trailingNewline: opts?.trailingNewline,
      });
    },
    async copyIn(fileName: string, sourcePath: string) {
      return store.copyIn(assertSafeFileName(fileName), sourcePath, { mode: options.mode });
    },
    async read(fileName: string) {
      return store.readBytes(assertSafeFileName(fileName));
    },
    cleanup,
    [Symbol.asyncDispose]: cleanup,
  };
}

export async function withTempWorkspace<T>(
  options: TempWorkspaceOptions,
  run: (workspace: TempWorkspace) => Promise<T>,
): Promise<T> {
  const workspace = await tempWorkspace(options);
  try {
    return await run(workspace);
  } finally {
    await workspace.cleanup();
  }
}

export function tempWorkspaceSync(options: TempWorkspaceOptions): TempWorkspaceSync {
  const rootDir = path.resolve(options.rootDir);
  fsSync.mkdirSync(rootDir, { recursive: true, mode: options.dirMode ?? 0o700 });
  const prefix = path.join(rootDir, sanitizeTempPrefix(options.prefix));
  const dir = fsSync.mkdtempSync(prefix);
  if (options.dirMode !== undefined) {
    fsSync.chmodSync(dir, options.dirMode);
  }
  const store = fileStoreSync({ rootDir: dir, private: true, mode: options.mode });

  const cleanup = () => {
    try {
      fsSync.rmSync(dir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup
    }
  };

  return {
    dir,
    store,
    path(fileName: string) {
      return path.join(dir, assertSafeFileName(fileName));
    },
    write(fileName: string, data: string | Uint8Array) {
      return store.write(assertSafeFileName(fileName), data, { mode: options.mode });
    },
    writeText(fileName: string, data: string) {
      return store.writeText(assertSafeFileName(fileName), data, { mode: options.mode });
    },
    writeJson(fileName: string, data: unknown, opts?: { trailingNewline?: boolean }) {
      return store.writeJson(assertSafeFileName(fileName), data, {
        mode: options.mode,
        trailingNewline: opts?.trailingNewline,
      });
    },
    read(fileName: string) {
      const fullPath = path.join(dir, assertSafeFileName(fileName));
      return fsSync.readFileSync(fullPath);
    },
    cleanup,
    [Symbol.dispose]: cleanup,
  };
}

export function withTempWorkspaceSync<T>(
  options: TempWorkspaceOptions,
  run: (workspace: TempWorkspaceSync) => T,
): T {
  const workspace = tempWorkspaceSync(options);
  try {
    return run(workspace);
  } finally {
    workspace.cleanup();
  }
}
