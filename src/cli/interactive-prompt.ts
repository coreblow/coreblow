/**
 * cli/interactive-prompt.ts
 * Colored prompt with status indicators.
 */

export function colorize(text: string, color: string): string {
    const codes: Record<string, string> = { red: '31', green: '32', yellow: '33', blue: '34', magenta: '35', cyan: '36', white: '37', gray: '90', bold: '1', dim: '2' };
    return `\x1b[${codes[color] ?? '0'}m${text}\x1b[0m`;
}

export function buildPrompt(opts: { model: string; sessionId?: string; status?: 'connected' | 'error' }): string {
    const statusIcon = opts.status === 'error' ? colorize('●', 'red') : colorize('●', 'green');
    const model = colorize(opts.model, 'cyan');
    const session = opts.sessionId ? colorize(` [${opts.sessionId.slice(0, 8)}]`, 'dim') : '';
    return `${statusIcon} ${model}${session} > `;
}

export function formatHeader(): string {
    return [
        colorize('╔══════════════════════════════════════╗', 'cyan'),
        colorize('║', 'cyan') + colorize('         CoreBlow Gateway            ', 'bold') + colorize('║', 'cyan'),
        colorize('╚══════════════════════════════════════╝', 'cyan'),
        '',
        `  ${colorize('Type /help for commands', 'dim')}`,
        '',
    ].join('\n');
}

export function formatTable(headers: string[], rows: string[][]): string {
    const colWidths = headers.map((h, i) => Math.max(h.length, ...rows.map(r => (r[i] ?? '').length)));
    const sep = colWidths.map(w => '─'.repeat(w + 2)).join('┼');
    const headerRow = headers.map((h, i) => ` ${h.padEnd(colWidths[i])} `).join('│');
    const dataRows = rows.map(row => row.map((cell, i) => ` ${(cell ?? '').padEnd(colWidths[i])} `).join('│'));
    return [headerRow, sep, ...dataRows].join('\n');
}
