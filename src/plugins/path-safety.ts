import fs from "node:fs";
import { isPathInside as isBoundaryPathInside } from "../infra/path-guards.js";

export function isPathInside(baseDir: string, targetPath: string): boolean {
  return isBoundaryPathInside(baseDir, targetPath);
}

export function isPathInsideWithRealpath(
  baseDir: string,
  targetPath: string,
  cache?: Map<string, string>,
): boolean {
  if (!isPathInside(baseDir, targetPath)) {
    return false;
  }
  const realBase = safeRealpathSync(baseDir, cache) ?? baseDir;
  const realTarget = safeRealpathSync(targetPath, cache) ?? targetPath;
  return isPathInside(realBase, realTarget);
}

export function safeRealpathSync(targetPath: string, cache?: Map<string, string>): string | null {
  const cached = cache?.get(targetPath);
  if (cached) {
    return cached;
  }
  try {
    const resolved = fs.realpathSync(targetPath);
    cache?.set(targetPath, resolved);
    return resolved;
  } catch {
    return null;
  }
}

export function safeStatSync(targetPath: string): fs.Stats | null {
  try {
    return fs.statSync(targetPath);
  } catch {
    return null;
  }
}

export function formatPosixMode(mode: number): string {
  return (mode & 0o777).toString(8).padStart(3, "0");
}
