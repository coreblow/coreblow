/**
 * markdown/tables.ts
 * Markdown table parsing and formatting.
 * Ported from CoreBlow reference src/markdown/tables.ts.
 */

import type { MarkdownTableMode } from "../config/types.base.js";
import { markdownToIRWithMeta } from "./ir.js";
import { renderMarkdownWithMarkers } from "./render.js";
export interface MarkdownTable {
    headers: string[];
    rows: string[][];
    alignments: Array<'left' | 'center' | 'right' | null>;
}

/**
 * Parse a markdown table.
 */
export function parseMarkdownTable(markdown: string): MarkdownTable | null {
    const lines = markdown.trim().split('\n').filter((l) => l.includes('|'));
    if (lines.length < 2) return null;

    const parseRow = (line: string) => line.split('|').map((c) => c.trim()).filter((_, i, a) => i > 0 && i < a.length - (line.endsWith('|') ? 1 : 0));
    const headers = parseRow(lines[0]);
    if (headers.length === 0) return null;

    // Parse alignment row
    const alignRow = parseRow(lines[1]);
    const alignments = alignRow.map((cell): 'left' | 'center' | 'right' | null => {
        const trimmed = cell.replace(/\s/g, '');
        if (trimmed.startsWith(':') && trimmed.endsWith(':')) return 'center';
        if (trimmed.endsWith(':')) return 'right';
        if (trimmed.startsWith(':')) return 'left';
        return null;
    });

    // Parse data rows
    const rows = lines.slice(2).map(parseRow);

    return { headers, rows, alignments };
}

/**
 * Format a table as markdown.
 */
export function formatMarkdownTable(table: MarkdownTable): string {
    const widths = table.headers.map((h, i) => {
        const maxData = table.rows.reduce((max, row) => Math.max(max, (row[i] ?? '').length), 0);
        return Math.max(h.length, maxData, 3);
    });

    const pad = (text: string, width: number, align: 'left' | 'center' | 'right' | null) => {
        const diff = width - text.length;
        if (diff <= 0) return text;
        if (align === 'right') return ' '.repeat(diff) + text;
        if (align === 'center') return ' '.repeat(Math.floor(diff / 2)) + text + ' '.repeat(Math.ceil(diff / 2));
        return text + ' '.repeat(diff);
    };

    const headerLine = '| ' + table.headers.map((h, i) => pad(h, widths[i], table.alignments[i])).join(' | ') + ' |';
    const separatorLine = '| ' + widths.map((w, i) => {
        const align = table.alignments[i];
        const dash = '-'.repeat(w);
        if (align === 'center') return ':' + dash.slice(2) + ':';
        if (align === 'right') return dash.slice(1) + ':';
        if (align === 'left') return ':' + dash.slice(1);
        return dash;
    }).join(' | ') + ' |';

    const dataLines = table.rows.map((row) =>
        '| ' + row.map((cell, i) => pad(cell, widths[i], table.alignments[i])).join(' | ') + ' |'
    );

    return [headerLine, separatorLine, ...dataLines].join('\n');
}

/**
 * Convert a table to CSV.
 */
export function tableToCSV(table: MarkdownTable): string {
    const escape = (s: string) => s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    const headerLine = table.headers.map(escape).join(',');
    const dataLines = table.rows.map((row) => row.map(escape).join(','));
    return [headerLine, ...dataLines].join('\n');
}

const MARKDOWN_STYLE_MARKERS = {
    bold: { open: "**", close: "**" },
    italic: { open: "_", close: "_" },
    strikethrough: { open: "~~", close: "~~" },
    code: { open: "`", close: "`" },
};

/**
 * Convert markdown tables in a string to the specified table mode.
 */
export function convertMarkdownTables(markdown: string, mode: MarkdownTableMode): string {
    if (!markdown || mode === "off") {
        return markdown;
    }
    const { ir, hasTables } = markdownToIRWithMeta(markdown, {
        linkify: false,
        autolink: false,
        headingStyle: "none",
        blockquotePrefix: "",
        tableMode: mode,
    });
    if (!hasTables) {
        return markdown;
    }
    return renderMarkdownWithMarkers(ir, {
        styleMarkers: MARKDOWN_STYLE_MARKERS,
        escapeText: (text: string) => text,
        buildLink: (link: any, text: string) => {
            const href = link.href.trim();
            if (!href) return null;
            const label = text.slice(link.start, link.end);
            if (!label) return null;
            return { start: link.start, end: link.end, open: "[", close: `](${href})` };
        },
    });
}
