/**
 * cli/output-formatter.ts
 * Terminal markdown rendering and syntax highlighting.
 */

export function renderMarkdownToTerminal(md: string): string {
    let output = md;
    // Bold
    output = output.replace(/\*\*(.+?)\*\*/g, '\x1b[1m$1\x1b[0m');
    // Italic
    output = output.replace(/\*(.+?)\*/g, '\x1b[3m$1\x1b[0m');
    // Inline code
    output = output.replace(/`([^`]+)`/g, '\x1b[36m$1\x1b[0m');
    // Headers
    output = output.replace(/^### (.+)$/gm, '\x1b[1;33m   $1\x1b[0m');
    output = output.replace(/^## (.+)$/gm, '\x1b[1;34m  $1\x1b[0m');
    output = output.replace(/^# (.+)$/gm, '\x1b[1;35m$1\x1b[0m');
    // Bullet points
    output = output.replace(/^- (.+)$/gm, '  • $1');
    output = output.replace(/^\* (.+)$/gm, '  • $1');
    // Links
    output = output.replace(/\[(.+?)\]\((.+?)\)/g, '\x1b[4;36m$1\x1b[0m (\x1b[90m$2\x1b[0m)');
    // Horizontal rule
    output = output.replace(/^---+$/gm, '─'.repeat(40));
    return output;
}

export function highlightCode(code: string, language: string): string {
    const keywords: Record<string, string[]> = {
        typescript: ['const', 'let', 'var', 'function', 'class', 'interface', 'type', 'export', 'import', 'from', 'return', 'if', 'else', 'for', 'while', 'async', 'await', 'new', 'this', 'true', 'false', 'null', 'undefined'],
        javascript: ['const', 'let', 'var', 'function', 'class', 'export', 'import', 'from', 'return', 'if', 'else', 'for', 'while', 'async', 'await', 'new', 'this', 'true', 'false', 'null'],
        python: ['def', 'class', 'import', 'from', 'return', 'if', 'elif', 'else', 'for', 'while', 'with', 'as', 'try', 'except', 'finally', 'True', 'False', 'None', 'async', 'await', 'yield'],
    };
    const kws = keywords[language] ?? keywords.typescript ?? [];
    let highlighted = code;
    // Strings
    highlighted = highlighted.replace(/(["'])(?:(?=(\\?))\2.)*?\1/g, '\x1b[32m$&\x1b[0m');
    // Comments
    highlighted = highlighted.replace(/\/\/.*/g, '\x1b[90m$&\x1b[0m');
    // Keywords
    for (const kw of kws) { highlighted = highlighted.replace(new RegExp(`\\b${kw}\\b`, 'g'), `\x1b[35m${kw}\x1b[0m`); }
    return highlighted;
}

export function formatCodeBlock(code: string, language: string): string {
    const highlighted = highlightCode(code, language);
    const lines = highlighted.split('\n');
    const numbered = lines.map((line, i) => `\x1b[90m${String(i + 1).padStart(3)}\x1b[0m │ ${line}`);
    return `\x1b[90m┌─ ${language} ${'─'.repeat(30)}\x1b[0m\n${numbered.join('\n')}\n\x1b[90m└${'─'.repeat(35)}\x1b[0m`;
}
