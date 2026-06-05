import { resolveAgentWorkspaceDir } from "./_core-imports.js";
import { resolveMemorySearchConfig } from "./_core-imports.js";
import type { CoreBlowConfig } from "./_core-imports.js";
import fs from "node:fs/promises";
import path from "node:path";
import { isFileMissingError, statRegularFile } from "./fs-utils.js";
import { isMemoryPath, normalizeExtraMemoryPaths } from "./internal.js";
import { buildMemoryReadResult } from "./read-file-shared.js";
import type { MemoryReadResult } from "./types.js";

async function pathHasSymlinkDirectoryComponent(
  rootDir: string,
  targetPath: string,
): Promise<boolean> {
  const relative = path.relative(rootDir, targetPath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    return false;
  }
  const parts = relative.split(path.sep).filter(Boolean);
  let cursor = rootDir;
  for (const part of parts.slice(0, -1)) {
    cursor = path.join(cursor, part);
    try {
      const stat = await fs.lstat(cursor);
      if (stat.isSymbolicLink()) {
        return true;
      }
    } catch {
      return false;
    }
  }
  return false;
}

export async function readMemoryFile(params: {
  workspaceDir: string;
  extraPaths?: string[];
  relPath: string;
  from?: number;
  lines?: number;
}): Promise<MemoryReadResult> {
  const rawPath = params.relPath.trim();
  if (!rawPath) {
    throw new Error("path required");
  }
  const absPath = path.isAbsolute(rawPath)
    ? path.resolve(rawPath)
    : path.resolve(params.workspaceDir, rawPath);
  const relPath = path.relative(params.workspaceDir, absPath).replace(/\\/g, "/");
  const inWorkspace = relPath.length > 0 && !relPath.startsWith("..") && !path.isAbsolute(relPath);
  const allowedWorkspace = inWorkspace && isMemoryPath(relPath);
  let allowedAdditional = false;
  if (!allowedWorkspace && (params.extraPaths?.length ?? 0) > 0) {
    const additionalPaths = normalizeExtraMemoryPaths(params.workspaceDir, params.extraPaths);
    for (const additionalPath of additionalPaths) {
      try {
        const stat = await fs.lstat(additionalPath);
        if (stat.isSymbolicLink()) {
          continue;
        }
        if (stat.isDirectory()) {
          if (absPath === additionalPath || absPath.startsWith(`${additionalPath}${path.sep}`)) {
            if (await pathHasSymlinkDirectoryComponent(additionalPath, absPath)) {
              continue;
            }
            allowedAdditional = true;
            break;
          }
          continue;
        }
        if (stat.isFile() && absPath === additionalPath && absPath.endsWith(".md")) {
          allowedAdditional = true;
          break;
        }
      } catch {}
    }
  }
  if (!allowedWorkspace && !allowedAdditional) {
    throw new Error("path required");
  }
  if (!absPath.endsWith(".md")) {
    throw new Error("path required");
  }
  const statResult = await statRegularFile(absPath);
  if (statResult.missing) {
    return { text: "", path: relPath };
  }
  let content: string;
  try {
    content = await fs.readFile(absPath, "utf-8");
  } catch (err) {
    if (isFileMissingError(err)) {
      return { text: "", path: relPath };
    }
    throw err;
  }
  return buildMemoryReadResult({
    content,
    relPath,
    from: params.from,
    lines: params.lines,
  });
}

export async function readAgentMemoryFile(params: {
  cfg: CoreBlowConfig;
  agentId: string;
  relPath: string;
  from?: number;
  lines?: number;
}): Promise<MemoryReadResult> {
  const settings = resolveMemorySearchConfig(params.cfg, params.agentId);
  if (!settings) {
    throw new Error("memory search disabled");
  }
  return await readMemoryFile({
    workspaceDir: resolveAgentWorkspaceDir(params.cfg, params.agentId),
    extraPaths: settings.extraPaths,
    relPath: params.relPath,
    from: params.from,
    lines: params.lines,
  });
}
