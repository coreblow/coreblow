import "./fs-safe-defaults.js";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export type WriteSiblingTempFileOptions<T> = {
  dir: string;
  writeTemp: (tempPath: string) => Promise<T>;
  resolveFinalPath: (result: T) => string;
  tempPrefix?: string;
  dirMode?: number;
  chmodDir?: boolean;
  mode?: number;
  syncTempFile?: boolean;
  syncParentDir?: boolean;
};

export type WriteSiblingTempFileResult<T> = {
  filePath: string;
  result: T;
};

export async function writeSiblingTempFile<T>(
  options: WriteSiblingTempFileOptions<T>,
): Promise<WriteSiblingTempFileResult<T>> {
  const dir = path.resolve(options.dir);
  await fs.mkdir(dir, { recursive: true, mode: options.dirMode ?? 0o700 });
  if (options.chmodDir !== false) {
    await fs.chmod(dir, options.dirMode ?? 0o700).catch(() => undefined);
  }

  const prefix = options.tempPrefix ?? ".coreblow-sibling-";
  const tempPath = path.join(dir, `${prefix}${process.pid}.${crypto.randomUUID()}.tmp`);
  let tempCreated = false;

  try {
    tempCreated = true;
    const result = await options.writeTemp(tempPath);
    if (options.mode !== undefined) {
      await fs.chmod(tempPath, options.mode).catch(() => undefined);
    }
    const finalPath = path.resolve(options.resolveFinalPath(result));
    if (path.dirname(finalPath) !== dir) {
      throw new Error("Final path must be in the sibling temp directory.");
    }
    await fs.rename(tempPath, finalPath);
    tempCreated = false;
    if (options.mode !== undefined) {
      await fs.chmod(finalPath, options.mode).catch(() => undefined);
    }
    return { filePath: finalPath, result };
  } finally {
    if (tempCreated) {
      await fs.rm(tempPath, { force: true }).catch(() => undefined);
    }
  }
}

export async function writeViaSiblingTempPath(params: {
  rootDir: string;
  targetPath: string;
  writeTemp: (tempPath: string) => Promise<void>;
  fallbackFileName?: string;
  tempPrefix?: string;
}): Promise<void> {
  const rootDir = path.resolve(params.rootDir);
  const targetPath = path.resolve(params.targetPath);
  if (!targetPath.startsWith(rootDir)) {
    throw new Error("Target path is outside the allowed root");
  }
  const dir = path.dirname(targetPath);
  await fs.mkdir(dir, { recursive: true });
  const prefix = params.tempPrefix ?? ".coreblow-part-";
  const tempPath = path.join(dir, `${prefix}${crypto.randomUUID()}.part`);
  try {
    await params.writeTemp(tempPath);
    await fs.rename(tempPath, targetPath);
  } finally {
    await fs.rm(tempPath, { force: true }).catch(() => undefined);
  }
}
