/**
 * CoreBlow Tool Display Utilities
 *
 * Common utilities for formatting tool call outputs, progress indicators,
 * diff displays, file previews, and structured result rendering.
 *
 * Equivalent: CoreBlow src/agents/tool-display-common.ts (452 LOC)
 */

import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('tool-display');

// ─── Types ────────────────────────────────────────────────────────

export interface ToolDisplayOptions {
    maxOutputLength?: number;
    truncateMiddle?: boolean;
    showTimestamp?: boolean;
    colorize?: boolean;
    indentLevel?: number;
}

export interface FilePreview {
    path: string;
    language: string;
    content: string;
    startLine?: number;
    endLine?: number;
    totalLines: number;
    truncated: boolean;
}

export interface DiffBlock {
    path: string;
    hunks: DiffHunk[];
    additions: number;
    deletions: number;
}

export interface DiffHunk {
    oldStart: number;
    oldCount: number;
    newStart: number;
    newCount: number;
    lines: DiffLine[];
}

export interface DiffLine {
    type: 'add' | 'remove' | 'context';
    content: string;
    oldLineNo?: number;
    newLineNo?: number;
}

export interface ProgressIndicator {
    label: string;
    current: number;
    total: number;
    startedAt: number;
    status: 'running' | 'complete' | 'error';
}

// ─── Output Formatting ───────────────────────────────────────────

/**
 * Truncate output to max length with ellipsis
 */
export function truncateOutput(
    output: string,
    maxLength: number = 8000,
    mode: 'end' | 'middle' = 'end',
): { text: string; truncated: boolean; originalLength: number } {
    const originalLength = output.length;
    if (output.length <= maxLength) {
        return { text: output, truncated: false, originalLength };
    }

    if (mode === 'middle') {
        const half = Math.floor(maxLength / 2);
        const first = output.slice(0, half);
        const last = output.slice(-half);
        const omitted = originalLength - maxLength;
        return {
            text: `${first}\n\n... [${omitted} characters omitted] ...\n\n${last}`,
            truncated: true,
            originalLength,
        };
    }

    return {
        text: `${output.slice(0, maxLength)}\n\n... [truncated, ${originalLength - maxLength} more characters]`,
        truncated: true,
        originalLength,
    };
}

/**
 * Format a tool result for display
 */
export function formatToolResult(params: {
    toolName: string;
    output: string;
    error?: string;
    durationMs: number;
    exitCode?: number;
    options?: ToolDisplayOptions;
}): string {
    const maxLen = params.options?.maxOutputLength ?? 8000;
    const { text, truncated } = truncateOutput(params.output, maxLen);

    const lines: string[] = [];

    // Header
    const statusIcon = params.error ? '❌' : '✅';
    const duration = formatDuration(params.durationMs);
    lines.push(`${statusIcon} **${params.toolName}** (${duration})`);

    // Exit code
    if (params.exitCode !== undefined && params.exitCode !== 0) {
        lines.push(`Exit code: ${params.exitCode}`);
    }

    // Error
    if (params.error) {
        lines.push('', '**Error:**', '```', params.error, '```');
    }

    // Output
    if (text) {
        const lang = inferLanguage(params.toolName, text);
        lines.push('', `\`\`\`${lang}`, text, '```');
    }

    if (truncated) {
        lines.push(`*Output truncated (${params.output.length} chars total)*`);
    }

    return lines.join('\n');
}

/**
 * Format a file preview with line numbers
 */
export function formatFilePreview(preview: FilePreview): string {
    const lines: string[] = [];
    lines.push(`📄 **${preview.path}** (${preview.totalLines} lines)`);

    if (preview.startLine && preview.endLine) {
        lines.push(`Lines ${preview.startLine}-${preview.endLine}`);
    }

    lines.push('', `\`\`\`${preview.language}`);

    const contentLines = preview.content.split('\n');
    const startLine = preview.startLine ?? 1;
    const maxLineNoWidth = String(startLine + contentLines.length).length;

    for (let i = 0; i < contentLines.length; i++) {
        const lineNo = String(startLine + i).padStart(maxLineNoWidth, ' ');
        lines.push(`${lineNo} │ ${contentLines[i]}`);
    }

    lines.push('```');

    if (preview.truncated) {
        lines.push(`*File truncated (${preview.totalLines} lines total)*`);
    }

    return lines.join('\n');
}

/**
 * Format a diff block
 */
export function formatDiff(diff: DiffBlock): string {
    const lines: string[] = [];
    const summary = `+${diff.additions} -${diff.deletions}`;
    lines.push(`📝 **${diff.path}** (${summary})`);
    lines.push('', '```diff');

    for (const hunk of diff.hunks) {
        lines.push(`@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@`);
        for (const line of hunk.lines) {
            const prefix = line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' ';
            lines.push(`${prefix}${line.content}`);
        }
    }

    lines.push('```');
    return lines.join('\n');
}

/**
 * Format a progress indicator
 */
export function formatProgress(indicator: ProgressIndicator): string {
    const percent = indicator.total > 0
        ? Math.round((indicator.current / indicator.total) * 100)
        : 0;
    const elapsed = formatDuration(Date.now() - indicator.startedAt);
    const bar = renderProgressBar(percent);

    const statusIcon = indicator.status === 'complete' ? '✅'
        : indicator.status === 'error' ? '❌'
            : '⏳';

    return `${statusIcon} ${indicator.label}: ${bar} ${percent}% (${indicator.current}/${indicator.total}) [${elapsed}]`;
}

/**
 * Render a text-based progress bar
 */
export function renderProgressBar(percent: number, width: number = 20): string {
    const filled = Math.round((percent / 100) * width);
    const empty = width - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
}

// ─── Duration Formatting ──────────────────────────────────────────

/**
 * Format a duration in milliseconds to human-readable
 */
export function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
    const minutes = Math.floor(ms / 60_000);
    const seconds = Math.round((ms % 60_000) / 1000);
    return `${minutes}m ${seconds}s`;
}

// ─── File Size Formatting ─────────────────────────────────────────

/**
 * Format a file size in bytes to human-readable
 */
export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

// ─── Language Detection ───────────────────────────────────────────

const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'tsx',
    '.js': 'javascript',
    '.jsx': 'jsx',
    '.py': 'python',
    '.rs': 'rust',
    '.go': 'go',
    '.java': 'java',
    '.rb': 'ruby',
    '.php': 'php',
    '.sh': 'bash',
    '.bash': 'bash',
    '.zsh': 'bash',
    '.json': 'json',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.toml': 'toml',
    '.xml': 'xml',
    '.html': 'html',
    '.css': 'css',
    '.scss': 'scss',
    '.md': 'markdown',
    '.sql': 'sql',
    '.graphql': 'graphql',
    '.dockerfile': 'dockerfile',
    '.c': 'c',
    '.cpp': 'cpp',
    '.h': 'c',
    '.hpp': 'cpp',
    '.cs': 'csharp',
    '.swift': 'swift',
    '.kt': 'kotlin',
    '.r': 'r',
    '.lua': 'lua',
    '.vim': 'vim',
};

/**
 * Infer the language of output based on tool name and content
 */
export function inferLanguage(toolName: string, content: string): string {
    // Tool-specific
    if (toolName === 'exec' || toolName === 'process') return 'bash';
    if (toolName === 'web_search' || toolName === 'web_fetch') return '';
    if (toolName === 'grep' || toolName === 'find' || toolName === 'ls') return 'bash';

    // Content-based heuristics
    if (content.startsWith('{') || content.startsWith('[')) return 'json';
    if (content.startsWith('<!DOCTYPE') || content.startsWith('<html')) return 'html';

    return '';
}

/**
 * Get the language for a file path
 */
export function getFileLanguage(filePath: string): string {
    const ext = filePath.toLowerCase().match(/\.[^.]+$/)?.[0];
    if (!ext) return '';
    return EXTENSION_LANGUAGE_MAP[ext] ?? '';
}

// ─── Table Formatting ─────────────────────────────────────────────

/**
 * Format data as a markdown table
 */
export function formatTable(
    headers: string[],
    rows: string[][],
): string {
    if (headers.length === 0 || rows.length === 0) return '';

    // Calculate column widths
    const widths = headers.map((h, i) => {
        const maxRow = Math.max(...rows.map((r) => (r[i] ?? '').length));
        return Math.max(h.length, maxRow);
    });

    const header = '| ' + headers.map((h, i) => h.padEnd(widths[i]!)).join(' | ') + ' |';
    const separator = '| ' + widths.map((w) => '-'.repeat(w)).join(' | ') + ' |';
    const dataRows = rows.map((row) =>
        '| ' + row.map((cell, i) => (cell ?? '').padEnd(widths[i]!)).join(' | ') + ' |',
    );

    return [header, separator, ...dataRows].join('\n');
}

/**
 * Format a key-value list
 */
export function formatKeyValue(pairs: Array<[string, string]>): string {
    const maxKeyLen = Math.max(...pairs.map(([k]) => k.length));
    return pairs.map(([k, v]) => `${k.padEnd(maxKeyLen)} : ${v}`).join('\n');
}
