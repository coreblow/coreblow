/**
 * cli/command-format.ts
 * Output formatting utilities for CLI commands.
 * Ported from CoreBlow reference src/cli/command-format.ts.
 */

export type OutputFormat = 'text' | 'json' | 'table' | 'yaml';

export interface ColumnDef {
    key: string;
    label: string;
    width?: number;
    align?: 'left' | 'right' | 'center';
}

/**
 * Format a table for terminal output.
 */
export function formatTable(rows: Record<string, unknown>[], columns: ColumnDef[]): string {
    if (rows.length === 0) return '';

    const widths = columns.map((col) => {
        const headerWidth = col.label.length;
        const maxData = rows.reduce((max, row) => Math.max(max, String(row[col.key] ?? '').length), 0);
        return col.width ?? Math.max(headerWidth, maxData);
    });

    const pad = (text: string, width: number, align: string = 'left') => {
        const diff = width - text.length;
        if (diff <= 0) return text.slice(0, width);
        if (align === 'right') return ' '.repeat(diff) + text;
        if (align === 'center') return ' '.repeat(Math.floor(diff / 2)) + text + ' '.repeat(Math.ceil(diff / 2));
        return text + ' '.repeat(diff);
    };

    const header = columns.map((col, i) => pad(col.label, widths[i], col.align)).join('  ');
    const separator = widths.map((w) => '─'.repeat(w)).join('──');
    const body = rows.map((row) =>
        columns.map((col, i) => pad(String(row[col.key] ?? ''), widths[i], col.align)).join('  ')
    );

    return [header, separator, ...body].join('\n');
}

/**
 * Format key-value pairs as aligned text.
 */
export function formatKeyValue(entries: Array<[string, unknown]>): string {
    const maxKeyWidth = entries.reduce((max, [key]) => Math.max(max, key.length), 0);
    return entries.map(([key, value]) => `  ${key.padEnd(maxKeyWidth)}  ${String(value)}`).join('\n');
}

/**
 * Format output based on selected format.
 */
export function formatOutput(data: unknown, format: OutputFormat): string {
    switch (format) {
        case 'json':
            return JSON.stringify(data, null, 2);
        case 'yaml':
            return formatAsYaml(data);
        case 'table':
            if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
                const keys = Object.keys(data[0] as Record<string, unknown>);
                const cols: ColumnDef[] = keys.map((k) => ({ key: k, label: k }));
                return formatTable(data as Record<string, unknown>[], cols);
            }
            return String(data);
        default:
            return typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    }
}

function formatAsYaml(data: unknown, indent = 0): string {
    const prefix = '  '.repeat(indent);
    if (data === null || data === undefined) return `${prefix}null`;
    if (typeof data === 'string') return data.includes('\n') ? `${prefix}|\n${data.split('\n').map((l) => `${prefix}  ${l}`).join('\n')}` : `${prefix}${data}`;
    if (typeof data === 'number' || typeof data === 'boolean') return `${prefix}${data}`;
    if (Array.isArray(data)) return data.map((item) => `${prefix}- ${formatAsYaml(item, indent + 1).trimStart()}`).join('\n');
    if (typeof data === 'object') {
        return Object.entries(data as Record<string, unknown>)
            .map(([k, v]) => {
                const val = formatAsYaml(v, indent + 1);
                if (typeof v === 'object' && v !== null) return `${prefix}${k}:\n${val}`;
                return `${prefix}${k}: ${val.trimStart()}`;
            }).join('\n');
    }
    return `${prefix}${String(data)}`;
}

/**
 * Wrap text to a maximum width.
 */
export function wrapText(text: string, maxWidth: number): string {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
        if (current.length + word.length + 1 > maxWidth && current) { lines.push(current); current = word; }
        else { current = current ? `${current} ${word}` : word; }
    }
    if (current) lines.push(current);
    return lines.join('\n');
}

/** Format a CLI command for display (CB port of OC cli/command-format.ts) */
export function formatCliCommand(cmd: string): string {
    return `\`${cmd.trim()}\``;
}
