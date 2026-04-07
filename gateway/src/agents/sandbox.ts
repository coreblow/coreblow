/**
 * agents/sandbox.ts
 * Filesystem sandbox — path validation and confinement.
 */
import path from 'node:path';

export interface SandboxConfig { allowedDirs: string[]; deniedPatterns?: RegExp[]; readOnlyDirs?: string[]; maxFileSize?: number; }

export function createSandbox(config: SandboxConfig): Sandbox { return new Sandbox(config); }

export class Sandbox {
    private config: SandboxConfig;
    constructor(config: SandboxConfig) { this.config = config; }

    isPathAllowed(targetPath: string): { allowed: boolean; reason?: string } {
        const resolved = path.resolve(targetPath);
        for (const pattern of this.config.deniedPatterns ?? []) { if (pattern.test(resolved)) return { allowed: false, reason: `Path matches denied pattern: ${pattern.source}` }; }
        const inAllowedDir = this.config.allowedDirs.some((dir) => resolved.startsWith(path.resolve(dir)));
        if (!inAllowedDir) return { allowed: false, reason: `Path outside allowed directories` };
        return { allowed: true };
    }

    isPathReadOnly(targetPath: string): boolean {
        const resolved = path.resolve(targetPath);
        return (this.config.readOnlyDirs ?? []).some((dir) => resolved.startsWith(path.resolve(dir)));
    }

    isWriteAllowed(targetPath: string): { allowed: boolean; reason?: string } {
        const readCheck = this.isPathAllowed(targetPath);
        if (!readCheck.allowed) return readCheck;
        if (this.isPathReadOnly(targetPath)) return { allowed: false, reason: 'Path is read-only' };
        return { allowed: true };
    }

    validateFileSize(size: number): boolean { return !this.config.maxFileSize || size <= this.config.maxFileSize; }
    getAllowedDirs(): string[] { return [...this.config.allowedDirs]; }
    getConfig(): Readonly<SandboxConfig> { return this.config; }
}

export const DEFAULT_DENIED_PATTERNS = [/node_modules/, /\.git\/objects/, /\.env$/, /\.ssh/, /\/proc\//, /\/sys\//];

export function createDefaultSandbox(workspaceDir: string): Sandbox {
    return createSandbox({ allowedDirs: [workspaceDir], deniedPatterns: DEFAULT_DENIED_PATTERNS, maxFileSize: 10 * 1024 * 1024 });
}
