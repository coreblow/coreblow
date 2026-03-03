/**
 * Discord Code Block Formatter — Wraps text in Discord code blocks.
 */
export function codeBlock(text: string, language: string = ''): string {
    return `\`\`\`${language}\n${text}\n\`\`\``;
}

export function inlineCode(text: string): string { return `\`${text}\``; }

export function formatDiff(added: string[], removed: string[]): string {
    const lines = [...removed.map((l) => `- ${l}`), ...added.map((l) => `+ ${l}`)];
    return codeBlock(lines.join('\n'), 'diff');
}

export function formatJson(obj: unknown): string {
    return codeBlock(JSON.stringify(obj, null, 2), 'json');
}
