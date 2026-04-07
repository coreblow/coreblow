/**
 * agents/sandbox-paths.ts
 * Sandbox path utilities.
 */
import path from 'node:path';
export function normalizeSandboxPath(p: string, baseDir: string): string { return path.resolve(baseDir, p); }
export function isPathTraversal(p: string): boolean { return p.includes('..') || p.includes('\0'); }
export function stripPathPrefix(fullPath: string, baseDir: string): string { const rel = path.relative(baseDir, fullPath); return rel.startsWith('..') ? fullPath : rel; }
export function isHiddenPath(p: string): boolean { return path.basename(p).startsWith('.'); }
export function ensureWithinBase(targetPath: string, baseDir: string): { valid: boolean; resolved: string } {
    const resolved = path.resolve(baseDir, targetPath);
    return { valid: resolved.startsWith(path.resolve(baseDir)), resolved };
}
