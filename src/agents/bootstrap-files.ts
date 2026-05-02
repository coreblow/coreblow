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

/** OC-compat: warn builder for bootstrap context */
export function makeBootstrapWarn(params: {
  sessionLabel: string;
  warn?: (message: string) => void;
}): ((message: string) => void) | undefined {
  if (!params.warn) return undefined;
  return (message: string) => params.warn?.(`${message} (sessionKey=${params.sessionLabel})`);
}

export type BootstrapContextMode = 'full' | 'lightweight';
export type BootstrapContextRunKind = 'default' | 'heartbeat' | 'cron';

import type { CoreBlowConfig } from '../config/config.js';
import type { EmbeddedContextFile } from './system-prompt.js';
import type { WorkspaceBootstrapFile, WorkspaceBootstrapFileName } from './workspace.js';

/** OC-compat stub: resolves bootstrap files for a run */
export async function resolveBootstrapFilesForRun(params: {
  workspaceDir: string;
  contextMode?: BootstrapContextMode;
}): Promise<BootstrapFile[]> {
  return discoverBootstrapFiles(params.workspaceDir);
}

/** OC-compat: resolves bootstrap context for a run */
export async function resolveBootstrapContextForRun(params: {
  workspaceDir: string;
  config?: CoreBlowConfig;
  contextMode?: BootstrapContextMode;
}): Promise<{
  bootstrapFiles: WorkspaceBootstrapFile[];
  contextFiles: EmbeddedContextFile[];
  /** @deprecated use bootstrapFiles/contextFiles */
  files: BootstrapFile[];
  /** @deprecated use bootstrapFiles/contextFiles */
  content: string;
}> {
  const discovered = discoverBootstrapFiles(params.workspaceDir);
  const content = mergeBootstrapContents(discovered);

  // Map to OC types
  const bootstrapFiles: WorkspaceBootstrapFile[] = discovered.map((f) => ({
    name: f.relativePath as WorkspaceBootstrapFileName,
    path: f.path,
    content: f.content,
    missing: false,
  }));

  // Apply per-file and total truncation limits from config (OC-compat)
  const HEAD_RATIO = 0.7;
  const TAIL_RATIO = 0.2;
  const maxChars = params.config?.agents?.defaults?.bootstrapMaxChars ?? Infinity;
  const totalMaxChars = params.config?.agents?.defaults?.bootstrapTotalMaxChars ?? Infinity;
  let totalUsed = 0;
  const contextFiles: EmbeddedContextFile[] = [];
  for (const file of discovered) {
    const budget = Math.min(maxChars, totalMaxChars - totalUsed);
    if (budget <= 0) break;
    const trimmed = file.content.trimEnd();
    if (trimmed.length <= budget) {
      contextFiles.push({ path: file.path, content: trimmed });
      totalUsed += trimmed.length;
    } else {
      // OC-compat: head/tail split with truncation marker
      const fileName = path.basename(file.relativePath);
      const headChars = Math.floor(budget * HEAD_RATIO);
      const tailChars = Math.floor(budget * TAIL_RATIO);
      const head = trimmed.slice(0, headChars);
      const tail = trimmed.slice(-tailChars);
      const marker = [
        "",
        `[...truncated, read ${fileName} for full content...]`,
        `…(truncated ${fileName}: kept ${headChars}+${tailChars} chars of ${trimmed.length})…`,
        "",
      ].join("\n");
      contextFiles.push({ path: file.path, content: [head, marker, tail].join("\n") });
      totalUsed += budget;
    }
  }

  return { bootstrapFiles, contextFiles, files: discovered, content };
}
