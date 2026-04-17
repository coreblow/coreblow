/**
 * plugins/path-jail.ts
 *
 * Filesystem isolation — constrains plugin file operations to
 * designated directories, preventing path traversal attacks.
 *
 * Following CoreBlow's sandbox bind-mount + readOnlyRoot pattern
 * adapted for CoreBlow's process-level enforcement.
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('plugin:path-jail');

// ─── Types ───────────────────────────────────────────────────────

/** Path jail configuration */
export interface PathJailConfig {
    /** Plugin identifier */
    pluginId: string;
    /** Allowed root directories for read/write */
    allowedRoots: string[];
    /** Read-only directories (can read but not write) */
    readOnlyRoots?: string[];
    /** Explicitly blocked paths (even if under allowed roots) */
    blockedPaths?: string[];
    /** Blocked filename patterns (regex) */
    blockedPatterns?: RegExp[];
    /** Whether to allow following symlinks outside jail */
    allowSymlinkEscape?: boolean;
    /** Maximum path depth from root */
    maxPathDepth?: number;
}

/** Path check result */
export type PathCheckResult =
    | { allowed: true; resolvedPath: string }
    | { allowed: false; reason: string };

/** Access mode */
export type AccessMode = 'read' | 'write' | 'delete' | 'list';

// ─── Default Blocked Patterns ────────────────────────────────────

const DEFAULT_BLOCKED_PATTERNS = [
    /\.env$/i,
    /\.env\..+$/i,
    /\/\.ssh\//,
    /\/\.gnupg\//,
    /\/\.aws\//,
    /\/\.config\/coreblow\/secrets/,
    /id_rsa/,
    /id_ed25519/,
    /\.pem$/,
    /\.key$/,
    /\/node_modules\/.package-lock\.json$/,
];

const DEFAULT_BLOCKED_PATHS = [
    '/etc/passwd',
    '/etc/shadow',
    '/etc/sudoers',
    '/proc',
    '/sys',
    '/dev',
];

// ─── PathJail ────────────────────────────────────────────────────

/**
 * CoreBlow Path Jail
 *
 * Constrains plugin filesystem access to designated directories.
 * Prevents path traversal attacks, symlink escapes, and access to
 * sensitive system files.
 */
export class PathJail {
    private config: PathJailConfig;
    private resolvedAllowedRoots: string[];
    private resolvedReadOnlyRoots: string[];
    private blockedPaths: Set<string>;
    private blockedPatterns: RegExp[];
    private violations: Array<{ path: string; mode: AccessMode; reason: string; timestamp: number }> = [];

    constructor(config: PathJailConfig) {
        this.config = config;

        // Resolve all roots to absolute paths
        this.resolvedAllowedRoots = config.allowedRoots.map((r) => path.resolve(r));
        this.resolvedReadOnlyRoots = (config.readOnlyRoots ?? []).map((r) => path.resolve(r));

        // Build blocked set
        this.blockedPaths = new Set([
            ...DEFAULT_BLOCKED_PATHS,
            ...(config.blockedPaths ?? []).map((p) => path.resolve(p)),
        ]);

        this.blockedPatterns = [
            ...DEFAULT_BLOCKED_PATTERNS,
            ...(config.blockedPatterns ?? []),
        ];
    }

    /**
     * Create a jail for a plugin data directory.
     */
    static forPlugin(pluginId: string, dataDir: string, workspaceDir?: string): PathJail {
        const roots = [dataDir];
        if (workspaceDir) roots.push(workspaceDir);

        return new PathJail({
            pluginId,
            allowedRoots: roots,
            readOnlyRoots: workspaceDir ? [workspaceDir] : [],
            maxPathDepth: 20,
        });
    }

    // ─── Check Methods ───────────────────────────────────────────

    /**
     * Check if a path is allowed for the given access mode.
     */
    check(targetPath: string, mode: AccessMode): PathCheckResult {
        // 1. Resolve to absolute path
        const resolved = path.resolve(targetPath);

        // 2. Check path traversal (.. sequences)
        if (this.hasTraversal(targetPath)) {
            return this.deny(resolved, mode, 'path traversal detected');
        }

        // 3. Check max depth
        if (this.config.maxPathDepth) {
            const depth = resolved.split(path.sep).length;
            if (depth > this.config.maxPathDepth) {
                return this.deny(resolved, mode, `path depth ${depth} exceeds max ${this.config.maxPathDepth}`);
            }
        }

        // 4. Check blocked paths
        if (this.blockedPaths.has(resolved)) {
            return this.deny(resolved, mode, 'path is explicitly blocked');
        }

        // 5. Check blocked patterns
        for (const pattern of this.blockedPatterns) {
            if (pattern.test(resolved)) {
                return this.deny(resolved, mode, `path matches blocked pattern: ${pattern.source}`);
            }
        }

        // 6. Check symlink escape
        if (!this.config.allowSymlinkEscape && fs.existsSync(resolved)) {
            try {
                const realPath = fs.realpathSync(resolved);
                if (realPath !== resolved) {
                    // Symlink — check if real path is still in jail
                    if (!this.isUnderAllowedRoot(realPath, mode)) {
                        return this.deny(resolved, mode, `symlink escapes jail: → ${realPath}`);
                    }
                }
            } catch {
                // Can't resolve symlink — deny for safety
            }
        }

        // 7. Check if under allowed root
        if (!this.isUnderAllowedRoot(resolved, mode)) {
            return this.deny(resolved, mode, 'path is outside allowed roots');
        }

        // 8. Write to read-only root?
        if (mode === 'write' || mode === 'delete') {
            if (this.isUnderReadOnlyRoot(resolved) && !this.isUnderWritableRoot(resolved)) {
                return this.deny(resolved, mode, 'path is in read-only root');
            }
        }

        return { allowed: true, resolvedPath: resolved };
    }

    /**
     * Check read access.
     */
    checkRead(targetPath: string): PathCheckResult {
        return this.check(targetPath, 'read');
    }

    /**
     * Check write access.
     */
    checkWrite(targetPath: string): PathCheckResult {
        return this.check(targetPath, 'write');
    }

    /**
     * Check delete access.
     */
    checkDelete(targetPath: string): PathCheckResult {
        return this.check(targetPath, 'delete');
    }

    /**
     * Guard function — throws on violation.
     */
    guard(targetPath: string, mode: AccessMode): string {
        const result = this.check(targetPath, mode);
        if (!result.allowed) {
            throw new Error(
                `Plugin "${this.config.pluginId}" path access denied [${mode}]: ${result.reason} — ${targetPath}`,
            );
        }
        return result.resolvedPath;
    }

    // ─── Info ────────────────────────────────────────────────────

    getViolations() {
        return [...this.violations];
    }

    getViolationCount(): number {
        return this.violations.length;
    }

    getAllowedRoots(): string[] {
        return [...this.resolvedAllowedRoots];
    }

    getReadOnlyRoots(): string[] {
        return [...this.resolvedReadOnlyRoots];
    }

    getInfo(): {
        pluginId: string;
        allowedRoots: string[];
        readOnlyRoots: string[];
        violations: number;
    } {
        return {
            pluginId: this.config.pluginId,
            allowedRoots: this.resolvedAllowedRoots,
            readOnlyRoots: this.resolvedReadOnlyRoots,
            violations: this.violations.length,
        };
    }

    // ─── Private ─────────────────────────────────────────────────

    private hasTraversal(targetPath: string): boolean {
        const normalized = path.normalize(targetPath);
        return normalized.includes('..' + path.sep) || normalized.endsWith('..');
    }

    private isUnderAllowedRoot(resolved: string, mode: AccessMode): boolean {
        // Write roots
        for (const root of this.resolvedAllowedRoots) {
            if (resolved === root || resolved.startsWith(root + path.sep)) {
                return true;
            }
        }
        // Read-only roots (only for read/list)
        if (mode === 'read' || mode === 'list') {
            for (const root of this.resolvedReadOnlyRoots) {
                if (resolved === root || resolved.startsWith(root + path.sep)) {
                    return true;
                }
            }
        }
        return false;
    }

    private isUnderReadOnlyRoot(resolved: string): boolean {
        for (const root of this.resolvedReadOnlyRoots) {
            if (resolved === root || resolved.startsWith(root + path.sep)) {
                return true;
            }
        }
        return false;
    }

    private isUnderWritableRoot(resolved: string): boolean {
        for (const root of this.resolvedAllowedRoots) {
            if (resolved === root || resolved.startsWith(root + path.sep)) {
                return true;
            }
        }
        return false;
    }

    private deny(resolvedPath: string, mode: AccessMode, reason: string): PathCheckResult {
        this.violations.push({
            path: resolvedPath,
            mode,
            reason,
            timestamp: Date.now(),
        });
        log.warn({ plugin: this.config.pluginId, path: resolvedPath, mode, reason }, 'Path access denied');
        return { allowed: false, reason };
    }
}
