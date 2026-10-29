import "./fs-safe-defaults.js";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { sameFileIdentity, type FileIdentityStat } from "./file-identity.js";
import { writeViaSiblingTempPath } from "./sibling-temp-file.js";

export { sameFileIdentity, type FileIdentityStat };
export { writeViaSiblingTempPath };

export type AssertNoSymlinkParentsOptions = {
  rootDir: string;
  targetPath: string;
  allowOutsideRoot?: boolean;
  messagePrefix?: string;
  allowRootChildSymlink?: boolean;
  requireDirectories?: boolean;
  allowMissing?: boolean;
};

export type AssertNoHardlinkedFinalPathOptions = {
  filePath: string;
  root?: string;
  boundaryLabel?: string;
  allowFinalHardlinkForUnlink?: boolean;
};

export function sanitizeUntrustedFileName(fileName?: string, fallbackName = "download.bin"): string {
  const trimmed = typeof fileName === "string" ? fileName.trim() : "";
  if (!trimmed) {
    return fallbackName;
  }
  let base = path.posix.basename(trimmed);
  base = path.win32.basename(base);
  let cleaned = "";
  for (let i = 0; i < base.length; i++) {
    const code = base.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) {
      continue;
    }
    cleaned += base[i];
  }
  base = cleaned.trim();
  if (!base || base === "." || base === "..") {
    return fallbackName;
  }
  if (base.length > 200) {
    base = base.slice(0, 200);
  }
  return base;
}

export async function assertNoHardlinkedFinalPath(
  params: AssertNoHardlinkedFinalPathOptions,
): Promise<void> {
  if (params.allowFinalHardlinkForUnlink) {
    return;
  }
  let stat;
  try {
    stat = await fs.stat(params.filePath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return;
    }
    throw err;
  }
  if (!stat.isFile()) {
    return;
  }
  if (stat.nlink > 1) {
    const boundary = params.boundaryLabel ?? "workspace";
    const rootLabel = params.root ? ` (${params.root})` : "";
    throw new Error(`Hardlinked path is not allowed under ${boundary}${rootLabel}: ${params.filePath}`);
  }
}

function resolvePathWalk(params: AssertNoSymlinkParentsOptions): { root: string; segments: string[] } | null {
  const root = path.resolve(params.rootDir);
  const target = path.resolve(params.targetPath);
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    if (params.allowOutsideRoot) {
      return null;
    }
    throw new Error(`${params.messagePrefix ?? "Path"} must stay under ${root}.`);
  }
  return {
    root,
    segments: relative && relative !== "." ? relative.split(path.sep).filter(Boolean) : [],
  };
}

export async function assertNoSymlinkParents(params: AssertNoSymlinkParentsOptions): Promise<void> {
  const walk = resolvePathWalk(params);
  if (!walk) {
    return;
  }
  let current = walk.root;
  for (const segment of walk.segments) {
    current = path.join(current, segment);
    try {
      const stat = await fs.lstat(current);
      if (stat.isSymbolicLink()) {
        if (params.allowRootChildSymlink && path.dirname(current) === walk.root) {
          continue;
        }
        throw new Error(`${params.messagePrefix ?? "Path"} must not traverse symlinked directory: ${current}`);
      }
      if (params.requireDirectories && !stat.isDirectory()) {
        throw new Error(`${params.messagePrefix ?? "Path"} must traverse directories: ${current}`);
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT" && params.allowMissing !== false) {
        return;
      }
      throw err;
    }
  }
}

export function assertNoSymlinkParentsSync(params: AssertNoSymlinkParentsOptions): void {
  const walk = resolvePathWalk(params);
  if (!walk) {
    return;
  }
  let current = walk.root;
  for (const segment of walk.segments) {
    current = path.join(current, segment);
    try {
      const stat = fsSync.lstatSync(current);
      if (stat.isSymbolicLink()) {
        if (params.allowRootChildSymlink && path.dirname(current) === walk.root) {
          continue;
        }
        throw new Error(`${params.messagePrefix ?? "Path"} must not traverse symlinked directory: ${current}`);
      }
      if (params.requireDirectories && !stat.isDirectory()) {
        throw new Error(`${params.messagePrefix ?? "Path"} must traverse directories: ${current}`);
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT" && params.allowMissing !== false) {
        return;
      }
      throw err;
    }
  }
}
