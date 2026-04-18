/**
 * agents/sanitize-for-prompt.ts
 * Sanitization utilities for safe embedding in LLM prompts.
 * Ported from CoreBlow src/agents/sanitize-for-prompt.ts + console-sanitize.ts.
 */

/**
 * Sanitize text for safe embedding in system prompts.
 * Strips potential injection markers and control characters.
 */
export function sanitizeForPromptLiteral(text: string): string {
    return text
        .replace(/[<>{}]/g, '')
        .replace(/\0/g, '');
}

/**
 * Strip ANSI escape codes from console output.
 */
export function stripAnsi(text: string): string {
    // eslint-disable-next-line no-control-regex
    return text.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '').replace(/\x1B\].*?\x07/g, '');
}

/**
 * Truncate text to max length with ellipsis.
 */
export function truncateForPrompt(text: string, maxLen: number): string {
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen - 3) + '...';
}

/**
 * Sanitize console output for embedding in tool results.
 */
export function sanitizeConsoleOutput(output: string, opts?: { maxLines?: number; maxChars?: number; stripAnsi?: boolean }): string {
    let result = opts?.stripAnsi !== false ? stripAnsi(output) : output;
    const maxChars = opts?.maxChars ?? 100_000;
    const maxLines = opts?.maxLines ?? 500;
    if (result.length > maxChars) result = result.slice(0, maxChars) + '\n... (truncated)';
    const lines = result.split('\n');
    if (lines.length > maxLines) result = lines.slice(0, maxLines).join('\n') + `\n... (${lines.length - maxLines} more lines)`;
    return result;
}

/**
 * Escape markdown special characters.
 */
export function escapeMarkdown(text: string): string {
    return text.replace(/([*_`~|\\[\]()#>+\-.!{}])/g, '\\$1');
}

/**
 * Strip markdown formatting to plain text.
 */
export function stripMarkdown(text: string): string {
    return text
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`[^`]+`/g, '')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/__([^_]+)__/g, '$1')
        .replace(/_([^_]+)_/g, '$1')
        .replace(/~~([^~]+)~~/g, '$1')
        .replace(/^#+\s*/gm, '')
        .replace(/^\s*[-*+]\s/gm, '')
        .replace(/^\s*\d+\.\s/gm, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');
}

/**
 * Detect potential prompt injection attempts.
 */
export function detectPromptInjection(text: string): { detected: boolean; patterns: string[] } {
    const patterns: string[] = [];
    const markers = [
        { pattern: /system:\s/i, label: 'system-role-marker' },
        { pattern: /<\/?system>/i, label: 'system-tag' },
        { pattern: /ignore.*previous.*instructions/i, label: 'instruction-override' },
        { pattern: /you are now/i, label: 'identity-override' },
        { pattern: /new instructions/i, label: 'new-instructions' },
        { pattern: /disregard.*above/i, label: 'disregard-above' },
    ];
    for (const { pattern, label } of markers) {
        if (pattern.test(text)) patterns.push(label);
    }
    return { detected: patterns.length > 0, patterns };
}
