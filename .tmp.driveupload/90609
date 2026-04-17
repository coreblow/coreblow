/**
 * infra/boundary-path.ts
 * Path boundary enforcement — prevent directory traversal.
 */

import { resolve, relative, isAbsolute } from 'node:path';

/** Check if a path stays within a boundary directory. */
export function isWithinBoundary(targetPath: string, boundaryDir: string): boolean {
    const resolved = resolve(boundaryDir, targetPath);
    const rel = relative(boundaryDir, resolved);
    // Must not start with ".." and must not be absolute (escaping boundary)
    return !rel.startsWith('..') && !isAbsolute(rel);
}

/** Sanitize a filename to prevent traversal. */
export function sanitizeFilename(filename: string): string {
    return filename
        .replace(/\.\./g, '') // remove ..
        .replace(/[/\\]/g, '_') // replace path separators
        .replace(/[<>:"|?*\0]/g, '_') // remove invalid chars
        .replace(/^\.+/, '') // remove leading dots
        .trim();
}

/** Resolve a path safely within a boundary. Throws if it escapes. */
export function safePath(targetPath: string, boundaryDir: string): string {
    const resolved = resolve(boundaryDir, targetPath);
    if (!isWithinBoundary(targetPath, boundaryDir)) {
        throw new Error(`Path traversal detected: ${targetPath} escapes ${boundaryDir}`);
    }
    return resolved;
}

/** Check if a path looks suspicious. */
export function isSuspiciousPath(path: string): boolean {
    return /\.\.|\/etc\/|\/proc\/|\/sys\/|~\/\.ssh|~\/\.aws|~\/\.config/i.test(path);
}
