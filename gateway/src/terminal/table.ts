/**
 * terminal/table.ts — Rich terminal table rendering.
 */

export interface TableOptions { borders?: boolean; headerColor?: string; maxWidth?: number; padding?: number }

export function renderTable(headers: string[], rows: string[][], opts: TableOptions = {}): string {
    const padding = opts.padding ?? 1;
    const colWidths = headers.map((h, i) => Math.min(opts.maxWidth ?? 40, Math.max(h.length, ...rows.map(r => (r[i] ?? '').length)) + padding * 2));
    const pad = (s: string, w: number) => ` ${s.padEnd(w - 1)} `;

    if (opts.borders) {
        const top = '┌' + colWidths.map(w => '─'.repeat(w)).join('┬') + '┐';
        const mid = '├' + colWidths.map(w => '─'.repeat(w)).join('┼') + '┤';
        const bot = '└' + colWidths.map(w => '─'.repeat(w)).join('┴') + '┘';
        const headerRow = '│' + headers.map((h, i) => `\x1b[1m${pad(h, colWidths[i])}\x1b[0m`).join('│') + '│';
        const dataRows = rows.map(row => '│' + row.map((cell, i) => pad(cell ?? '', colWidths[i])).join('│') + '│');
        return [top, headerRow, mid, ...dataRows, bot].join('\n');
    }

    const headerRow = headers.map((h, i) => `\x1b[1m${pad(h, colWidths[i])}\x1b[0m`).join('');
    const sep = colWidths.map(w => '─'.repeat(w)).join('');
    const dataRows = rows.map(row => row.map((cell, i) => pad(cell ?? '', colWidths[i])).join(''));
    return [headerRow, sep, ...dataRows].join('\n');
}

export function renderKeyValue(pairs: Array<[string, string]>, labelWidth = 20): string {
    return pairs.map(([k, v]) => `  \x1b[36m${k.padEnd(labelWidth)}\x1b[0m ${v}`).join('\n');
}
