/**
 * agents/cli-output.ts — CLI output formatting.
 */
export function formatHeader(text: string, width = 60): string { const pad = Math.max(0, width - text.length - 4); return `╔${'═'.repeat(width)}╗\n║  ${text}${' '.repeat(pad)}║\n╚${'═'.repeat(width)}╝`; }
export function formatSection(title: string, content: string): string { return `\n── ${title} ${'─'.repeat(Math.max(0, 40 - title.length))}\n${content}\n`; }
export function formatProgress(current: number, total: number, label = ''): string { const pct = total > 0 ? Math.round((current / total) * 100) : 0; const bar = '█'.repeat(Math.floor(pct / 5)) + '░'.repeat(20 - Math.floor(pct / 5)); return `[${bar}] ${pct}% ${label} (${current}/${total})`; }
export function formatDuration(ms: number): string { if (ms < 1000) return `${ms}ms`; if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`; return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`; }
export function formatBytes(bytes: number): string { if (bytes < 1024) return `${bytes}B`; if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`; return `${(bytes / (1024 * 1024)).toFixed(1)}MB`; }
export function colorize(text: string, color: 'red' | 'green' | 'yellow' | 'blue' | 'dim'): string {
    const codes: Record<string, string> = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m', dim: '\x1b[2m' };
    return `${codes[color]}${text}\x1b[0m`;
}
