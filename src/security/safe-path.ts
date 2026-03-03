/**
 * CoreBlow — Safe Path Resolution
 *
 * Prevents path traversal attacks by enforcing that resolved
 * paths stay within a declared base directory boundary.
 */

import path from 'node:path';

/**
 * Resolve a user-supplied path safely, ensuring it stays within the base directory.
 * Returns the resolved absolute path, or null if it escapes the boundary.
 *
 * @param base - The trusted base directory (must be absolute)
 * @param userInput - The untrusted user-supplied path segment
 * @returns Resolved absolute path within base, or null if unsafe
 */
export function resolveSafePath(base: string, userInput: string): string | null {
    if (!base || !path.isAbsolute(base)) {
        throw new Error('Base path must be absolute');
    }

    // Strip null bytes (used in null-byte injection attacks)
    const cleaned = userInput.replace(/\0/g, '');

    // Resolve the path relative to base
    const resolved = path.resolve(base, cleaned);

    // Normalize both for comparison
    const normalizedBase = path.resolve(base) + path.sep;
    const normalizedResolved = path.resolve(resolved);

    // Ensure the resolved path starts with the base directory
    if (!normalizedResolved.startsWith(normalizedBase) && normalizedResolved !== path.resolve(base)) {
        return null;
    }

    return normalizedResolved;
}

/**
 * Check if a resolved path is within the base directory boundary.
 */
export function isWithinBase(base: string, resolved: string): boolean {
    const normalizedBase = path.resolve(base) + path.sep;
    const normalizedResolved = path.resolve(resolved);
    return normalizedResolved.startsWith(normalizedBase) || normalizedResolved === path.resolve(base);
}

/**
 * Join path segments safely, preventing traversal beyond base.
 * Unlike path.join, this ensures the result stays within base.
 */
export function safeJoin(base: string, ...segments: string[]): string | null {
    const joined = path.join(base, ...segments);
    return resolveSafePath(base, path.relative(base, joined));
}

/**
 * Validate that a path doesn't contain dangerous components.
 */
export function hasTraversalComponents(input: string): boolean {
    const segments = input.split(/[/\\]/);
    return segments.some(s => s === '..' || s === '.' || s.includes('\0'));
}

/**
 * Create a safe path resolver bound to a specific base directory.
 */
export function createPathResolver(base: string) {
    const resolvedBase = path.resolve(base);

    return {
        resolve(userInput: string): string | null {
            return resolveSafePath(resolvedBase, userInput);
        },

        isWithin(target: string): boolean {
            return isWithinBase(resolvedBase, target);
        },

        join(...segments: string[]): string | null {
            return safeJoin(resolvedBase, ...segments);
        },

        base: resolvedBase,
    };
}
