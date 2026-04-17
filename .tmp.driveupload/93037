/**
 * CoreBlow — Apply Patch Tool
 *
 * Applies unified diff patches to files with validation,
 * dry-run support, backup creation, and conflict detection.
 * Follows CoreBlow's patch application semantics.
 */

import { createChildLogger } from '../../utils/logger.js';

const log = createChildLogger('tool:apply-patch');

/** Patch hunk — a single change block */
export interface PatchHunk {
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
    lines: string[];
}

/** Parsed patch for a single file */
export interface FilePatch {
    oldPath: string;
    newPath: string;
    hunks: PatchHunk[];
    isNew: boolean;
    isDeleted: boolean;
    isBinary: boolean;
}

/** Patch application result */
export interface PatchResult {
    success: boolean;
    filesModified: string[];
    filesCreated: string[];
    filesDeleted: string[];
    errors: string[];
    /** If dry-run, contains the would-be result */
    preview?: Record<string, string>;
}

/** Apply patch options */
export interface ApplyPatchOptions {
    /** Don't actually write — just validate and return preview */
    dryRun?: boolean;
    /** Create .bak backups before modifying */
    backup?: boolean;
    /** Fuzz factor for context matching (lines of tolerance) */
    fuzz?: number;
    /** Strip leading path components (like `patch -p1`) */
    stripPrefix?: number;
    /** Base directory to apply patch relative to */
    cwd?: string;
}

/**
 * Parse a unified diff string into structured FilePatch objects.
 */
export function parseUnifiedDiff(diff: string): FilePatch[] {
    const patches: FilePatch[] = [];
    const lines = diff.split('\n');
    let i = 0;

    while (i < lines.length) {
        // Look for --- / +++ header
        if (lines[i]?.startsWith('---') && lines[i + 1]?.startsWith('+++')) {
            const oldPath = extractPath(lines[i]!.slice(4));
            const newPath = extractPath(lines[i + 1]!.slice(4));
            i += 2;

            const isNew = oldPath === '/dev/null';
            const isDeleted = newPath === '/dev/null';

            const hunks: PatchHunk[] = [];

            while (i < lines.length && lines[i]?.startsWith('@@')) {
                const hunk = parseHunkHeader(lines[i]!);
                if (!hunk) { i++; continue; }

                i++;
                const hunkLines: string[] = [];

                while (i < lines.length && !lines[i]?.startsWith('@@') && !lines[i]?.startsWith('---')) {
                    if (lines[i] === undefined) break;
                    const line = lines[i]!;
                    if (line.startsWith('+') || line.startsWith('-') || line.startsWith(' ') || line === '') {
                        hunkLines.push(line);
                    } else if (line.startsWith('\\')) {
                        // "\ No newline at end of file" — skip
                    } else {
                        break;
                    }
                    i++;
                }

                hunks.push({ ...hunk, lines: hunkLines });
            }

            patches.push({ oldPath, newPath, hunks, isNew, isDeleted, isBinary: false });
        } else {
            i++;
        }
    }

    return patches;
}

/**
 * Apply a parsed patch to file contents.
 */
export function applyPatchToContent(original: string, hunks: PatchHunk[], fuzz = 0): {
    success: boolean;
    result: string;
    errors: string[];
} {
    const errors: string[] = [];
    const originalLines = original.split('\n');
    const resultLines = [...originalLines];
    let offset = 0;

    for (const hunk of hunks) {
        const targetLine = hunk.oldStart - 1 + offset;

        // Verify context (with fuzz tolerance)
        const contextOk = verifyContext(originalLines, hunk, fuzz);
        if (!contextOk) {
            errors.push(`Context mismatch at line ${hunk.oldStart} (fuzz=${fuzz})`);
            continue;
        }

        // Apply hunk line-by-line with a cursor
        let cursor = targetLine;
        const newLines: string[] = [];
        let removeCount = 0;
        const spliceStart = targetLine;

        // Count old lines to determine splice range
        for (const line of hunk.lines) {
            if (line.startsWith('-')) {
                removeCount++;
            } else if (line.startsWith('+')) {
                newLines.push(line.slice(1));
            } else if (line.startsWith(' ')) {
                removeCount++;
                newLines.push(line.slice(1));
            }
        }

        resultLines.splice(spliceStart, removeCount, ...newLines);
        offset += newLines.length - removeCount;
    }

    return {
        success: errors.length === 0,
        result: resultLines.join('\n'),
        errors,
    };
}

/**
 * Apply a full unified diff to the filesystem.
 */
export async function applyPatch(
    diff: string,
    options: ApplyPatchOptions = {},
): Promise<PatchResult> {
    const { promises: fs } = await import('node:fs');
    const path = await import('node:path');

    const patches = parseUnifiedDiff(diff);
    const result: PatchResult = {
        success: true,
        filesModified: [],
        filesCreated: [],
        filesDeleted: [],
        errors: [],
        preview: options.dryRun ? {} : undefined,
    };

    const cwd = options.cwd ?? process.cwd();
    const strip = options.stripPrefix ?? 1;

    for (const patch of patches) {
        const targetPath = stripPathPrefix(patch.isNew ? patch.newPath : patch.oldPath, strip);
        const fullPath = path.resolve(cwd, targetPath);

        // Security: prevent path traversal
        if (!fullPath.startsWith(path.resolve(cwd))) {
            result.errors.push(`Path traversal blocked: ${targetPath}`);
            result.success = false;
            continue;
        }

        try {
            if (patch.isDeleted) {
                if (options.dryRun) {
                    result.preview![targetPath] = '[DELETED]';
                } else {
                    await fs.unlink(fullPath);
                }
                result.filesDeleted.push(targetPath);
                continue;
            }

            if (patch.isNew) {
                const content = patch.hunks
                    .flatMap(h => h.lines.filter(l => l.startsWith('+')).map(l => l.slice(1)))
                    .join('\n');

                if (options.dryRun) {
                    result.preview![targetPath] = content;
                } else {
                    await fs.mkdir(path.dirname(fullPath), { recursive: true });
                    await fs.writeFile(fullPath, content, 'utf-8');
                }
                result.filesCreated.push(targetPath);
                continue;
            }

            // Modify existing file
            const original = await fs.readFile(fullPath, 'utf-8');

            if (options.backup && !options.dryRun) {
                await fs.writeFile(`${fullPath}.bak`, original, 'utf-8');
            }

            const applied = applyPatchToContent(original, patch.hunks, options.fuzz ?? 0);

            if (!applied.success) {
                result.errors.push(...applied.errors.map(e => `${targetPath}: ${e}`));
                result.success = false;
                continue;
            }

            if (options.dryRun) {
                result.preview![targetPath] = applied.result;
            } else {
                await fs.writeFile(fullPath, applied.result, 'utf-8');
            }
            result.filesModified.push(targetPath);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            result.errors.push(`${targetPath}: ${msg}`);
            result.success = false;
        }
    }

    log.info({
        modified: result.filesModified.length,
        created: result.filesCreated.length,
        deleted: result.filesDeleted.length,
        errors: result.errors.length,
        dryRun: !!options.dryRun,
    }, 'Patch applied');

    return result;
}

// === Helpers ===

function extractPath(raw: string): string {
    return raw.split('\t')[0]?.trim() ?? raw.trim();
}

function parseHunkHeader(line: string): { oldStart: number; oldLines: number; newStart: number; newLines: number } | null {
    const match = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if (!match) return null;
    return {
        oldStart: parseInt(match[1]!, 10),
        oldLines: parseInt(match[2] ?? '1', 10),
        newStart: parseInt(match[3]!, 10),
        newLines: parseInt(match[4] ?? '1', 10),
    };
}

function stripPathPrefix(path: string, count: number): string {
    const parts = path.split('/');
    return parts.slice(count).join('/') || parts[parts.length - 1] || path;
}

function verifyContext(lines: string[], hunk: PatchHunk, fuzz: number): boolean {
    const contextLines = hunk.lines.filter(l => l.startsWith(' ')).map(l => l.slice(1));
    if (contextLines.length === 0) return true; // No context to verify

    const startIdx = Math.max(0, hunk.oldStart - 1 - fuzz);
    const endIdx = Math.min(lines.length, hunk.oldStart - 1 + hunk.oldLines + fuzz);
    const window = lines.slice(startIdx, endIdx);

    // Check if at least half of context lines match
    let matched = 0;
    for (const ctx of contextLines) {
        if (window.includes(ctx)) matched++;
    }
    return matched >= contextLines.length * 0.5;
}
