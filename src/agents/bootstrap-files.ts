/**
 * agents/bootstrap-files.ts
 * Bootstrap file discovery & loading for agent initialization.
 * Ported from CoreBlow reference src/agents/bootstrap-files.ts.
 */

import fs from 'node:fs';
import path from 'node:path';

export interface BootstrapFile {
    path: string;
    content: string;
    size: number;
    relativePath: string;
}

const BOOTSTRAP_PATTERNS = [
    'AGENTS.md', '.agents/AGENTS.md', '.coreblow/AGENTS.md',
    'SOUL.md', '.coreblow/SOUL.md',
    'CLAUDE.md', '.claude/settings.json',
    '.coreblow/context.md', '.coreblow/instructions.md',
    '.coreblow/config.yaml', '.coreblow/config.json',
];

/**
 * Discover bootstrap files in a workspace directory.
 */
export function discoverBootstrapFiles(workspaceDir: string, extraPatterns?: string[]): BootstrapFile[] {
    const patterns = [...BOOTSTRAP_PATTERNS, ...(extraPatterns ?? [])];
    const files: BootstrapFile[] = [];
    for (const pattern of patterns) {
        const fullPath = path.join(workspaceDir, pattern);
        try {
            if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
                const content = fs.readFileSync(fullPath, 'utf-8');
                if (content.trim().length > 0) {
                    files.push({ path: fullPath, content, size: content.length, relativePath: pattern });
                }
            }
        } catch { /* skip */ }
    }
    return files;
}

/**
 * Load a single bootstrap file.
 */
export function loadBootstrapFile(filePath: string): BootstrapFile | null {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return { path: filePath, content, size: content.length, relativePath: path.basename(filePath) };
    } catch { return null; }
}

/**
 * Merge bootstrap file contents into a single string for system prompt injection.
 */
export function mergeBootstrapContents(files: BootstrapFile[], separator = '\n\n---\n\n'): string {
    return files.map((f) => `<!-- ${f.relativePath} -->\n${f.content}`).join(separator);
}

/**
 * Check if a workspace has any bootstrap files.
 */
export function hasBootstrapFiles(workspaceDir: string): boolean {
    return discoverBootstrapFiles(workspaceDir).length > 0;
}
