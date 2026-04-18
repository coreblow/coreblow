/** CoreBlow — Install Safe Path */
import path from "node:path";
export function isPathSafe(targetPath: string, allowedRoot: string): boolean { const resolved = path.resolve(targetPath); const root = path.resolve(allowedRoot); return resolved.startsWith(root + path.sep) || resolved === root; }
export function assertPathSafe(targetPath: string, allowedRoot: string): void { if (!isPathSafe(targetPath, allowedRoot)) throw new Error("Path traversal blocked: " + targetPath); }
