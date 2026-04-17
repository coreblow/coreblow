/**
 * agents/workspace.ts
 * Agent workspace management.
 * Ported from OpenClaw src/agents/workspace.ts.
 */

import fs from 'node:fs';
import path from 'node:path';

export interface WorkspaceInfo {
    path: string;
    exists: boolean;
    isGitRepo: boolean;
    fileCount: number;
    totalSizeBytes: number;
    /** Legacy compat */
    projectType?: string;
    hasGit?: boolean;
    mainLanguage?: string;
    configFiles?: string[];
}

/**
 * Resolve the effective workspace directory.
 */
export function resolveWorkspaceDir(params: { configured?: string; agentDir?: string; env?: NodeJS.ProcessEnv }): string {
    if (params.configured) return path.resolve(params.configured);
    const env = params.env ?? process.env;
    if (env.COREBLOW_WORKSPACE) return path.resolve(env.COREBLOW_WORKSPACE);
    if (params.agentDir) return path.resolve(params.agentDir, 'workspace');
    return process.cwd();
}

/**
 * Get workspace info.
 */
const CONFIG_FILES = ['package.json', 'tsconfig.json', '.eslintrc.json', '.prettierrc', 'vitest.config.ts', 'jest.config.js', 'Dockerfile', '.env', '.gitignore'];

export function getWorkspaceInfo(workspaceDir: string): WorkspaceInfo {
    const exists = fs.existsSync(workspaceDir);
    if (!exists) return { path: workspaceDir, exists: false, isGitRepo: false, fileCount: 0, totalSizeBytes: 0 };

    const isGitRepo = (() => {
        let dir = workspaceDir;
        while (true) {
            if (fs.existsSync(path.join(dir, '.git'))) return true;
            const parent = path.dirname(dir);
            if (parent === dir) return false;
            dir = parent;
        }
    })();
    let fileCount = 0;
    let totalSizeBytes = 0;

    try {
        const walk = (dir: string, depth = 0) => {
            if (depth > 5) return; // limit depth
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
                const full = path.join(dir, entry.name);
                if (entry.isFile()) {
                    fileCount++;
                    try { totalSizeBytes += fs.statSync(full).size; } catch { /* skip */ }
                } else if (entry.isDirectory()) {
                    walk(full, depth + 1);
                }
            }
        };
        walk(workspaceDir);
    } catch { /* permission errors, etc */ }

    const projectType = detectProjectType(workspaceDir);
    const configFiles = CONFIG_FILES.filter((f) => { try { return fs.existsSync(path.join(workspaceDir, f)); } catch { return false; } });
    return { path: workspaceDir, exists, isGitRepo, fileCount, totalSizeBytes, projectType, hasGit: isGitRepo, mainLanguage: projectType === 'node' ? 'TypeScript/JavaScript' : projectType, configFiles };
}

/**
 * List workspace context files (.coreblow/*.md, AGENTS.md etc).
 */
export function listContextFiles(workspaceDir: string): Array<{ path: string; content: string }> {
    const files: Array<{ path: string; content: string }> = [];
    const candidates = [
        'AGENTS.md', '.coreblow/AGENTS.md', 'SOUL.md', '.coreblow/SOUL.md',
        'CLAUDE.md', '.coreblow/context.md', '.coreblow/instructions.md',
    ];

    for (const candidate of candidates) {
        const fullPath = path.join(workspaceDir, candidate);
        try {
            if (fs.existsSync(fullPath)) {
                const content = fs.readFileSync(fullPath, 'utf-8');
                if (content.trim().length > 0) {
                    files.push({ path: candidate, content });
                }
            }
        } catch { /* skip */ }
    }

    return files;
}

/**
 * Ensure workspace directory exists.
 */
export function ensureWorkspace(workspaceDir: string): void {
    fs.mkdirSync(workspaceDir, { recursive: true });
}

/**
 * Format workspace info for display.
 */
export function formatWorkspaceInfo(info: WorkspaceInfo): string {
    if (!info.exists) return `⚠️ Workspace not found: ${info.path}`;
    const sizeMb = (info.totalSizeBytes / (1024 * 1024)).toFixed(1);
    const git = info.isGitRepo ? ' (git)' : '';
    return `📁 ${info.path}${git} — ${info.fileCount} files, ${sizeMb} MB`;
}

// ─── Legacy API (backward compat) ────────────────────────────────

const PROJECT_MARKERS: Record<string, string[]> = {
    node: ['package.json'],
    python: ['pyproject.toml', 'setup.py', 'Pipfile'],
    rust: ['Cargo.toml'],
    go: ['go.mod'],
    java: ['pom.xml', 'build.gradle'],
    ruby: ['Gemfile'],
};

/**
 * Detect project type from directory contents.
 */
export function detectProjectType(dir: string): string {
    if (!fs.existsSync(dir)) return 'unknown';
    for (const [type, markers] of Object.entries(PROJECT_MARKERS)) {
        for (const marker of markers) {
            if (fs.existsSync(path.join(dir, marker))) return type;
        }
    }
    return 'unknown';
}

const LOCKFILE_PM: Record<string, string> = {
    'package-lock.json': 'npm',
    'yarn.lock': 'yarn',
    'pnpm-lock.yaml': 'pnpm',
    'bun.lockb': 'bun',
};

/**
 * Detect package manager from lockfile.
 */
export function detectPackageManager(dir: string): string | undefined {
    if (!fs.existsSync(dir)) return undefined;
    for (const [lockfile, pm] of Object.entries(LOCKFILE_PM)) {
        if (fs.existsSync(path.join(dir, lockfile))) return pm;
    }
    return undefined;
}



export interface ScanEntry { relativePath: string; type: 'file' | 'directory'; size?: number }

/**
 * Scan workspace files.
 */
export function scanWorkspace(dir: string, opts?: { maxDepth?: number; maxFiles?: number }): ScanEntry[] {
    const maxDepth = opts?.maxDepth ?? 5;
    const maxFiles = opts?.maxFiles ?? 1000;
    const results: ScanEntry[] = [];

    const walk = (d: string, depth: number, rel: string) => {
        if (depth > maxDepth || results.length >= maxFiles) return;
        let entries;
        try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
        for (const entry of entries) {
            if (results.length >= maxFiles) break;
            if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
            const relPath = rel ? `${rel}/${entry.name}` : entry.name;
            if (entry.isFile()) {
                let size: number | undefined;
                try { size = fs.statSync(path.join(d, entry.name)).size; } catch { /* */ }
                results.push({ relativePath: relPath, type: 'file', size });
            } else if (entry.isDirectory()) {
                results.push({ relativePath: relPath, type: 'directory' });
                walk(path.join(d, entry.name), depth + 1, relPath);
            }
        }
    };
    walk(dir, 0, '');
    return results;
}

/**
 * Find files matching a glob pattern (simplified).
 */
export function findFiles(dir: string, pattern: string): string[] {
    const results: string[] = [];
    const ext = pattern.startsWith('*.') ? pattern.slice(1) : null;
    const walk = (d: string) => {
        let entries;
        try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
        for (const entry of entries) {
            if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
            const full = path.join(d, entry.name);
            if (entry.isFile()) {
                if (!ext || entry.name.endsWith(ext)) results.push(full);
            } else if (entry.isDirectory()) {
                walk(full);
            }
        }
    };
    walk(dir);
    return results;
}

/**
 * Resolve workspace-relative directories.
 */
export function resolveWorkspaceDirs(workspace: string): { workspace: string; config: string; sessions: string; logs: string } {
    return {
        workspace,
        config: path.join(workspace, '.coreblow'),
        sessions: path.join(workspace, '.coreblow', 'sessions'),
        logs: path.join(workspace, '.coreblow', 'logs'),
    };
}

/**
 * Ensure directory exists.
 */
export function ensureDir(dir: string): void {
    fs.mkdirSync(dir, { recursive: true });
}

/**
 * Get/create a session directory.
 */
export function getSessionDir(workspace: string, sessionId: string): string {
    const sessDir = path.join(workspace, '.coreblow', 'sessions', sessionId);
    fs.mkdirSync(sessDir, { recursive: true });
    return sessDir;
}
