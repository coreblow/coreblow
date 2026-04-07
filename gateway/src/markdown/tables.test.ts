/**
 * markdown/tables.test.ts — Markdown table tests
 */
import { describe, it, expect } from 'vitest';
import { parseMarkdownTable, formatMarkdownTable, tableToCSV } from './tables.js';

describe('Markdown Tables', () => {
    describe('parseMarkdownTable', () => {
        it('parses basic table', () => {
            const md = '| Name | Age |\n| --- | --- |\n| Alice | 30 |\n| Bob | 25 |';
            const table = parseMarkdownTable(md);
            expect(table).not.toBeNull();
            expect(table!.headers).toEqual(['Name', 'Age']);
            expect(table!.rows).toHaveLength(2);
            expect(table!.rows[0]).toEqual(['Alice', '30']);
        });

        it('parses alignment', () => {
            const md = '| L | C | R |\n| :--- | :---: | ---: |\n| a | b | c |';
            const table = parseMarkdownTable(md);
            expect(table!.alignments).toEqual(['left', 'center', 'right']);
        });

        it('returns null for non-table', () => {
            expect(parseMarkdownTable('plain text')).toBeNull();
        });

        it('returns null for single line', () => {
            expect(parseMarkdownTable('| a |')).toBeNull();
        });
    });

    describe('formatMarkdownTable', () => {
        it('formats table', () => {
            const table = { headers: ['Name', 'Status'], rows: [['bot', 'active'], ['agent', 'idle']], alignments: [null, null] };
            const result = formatMarkdownTable(table);
            expect(result).toContain('Name');
            expect(result).toContain('active');
            expect(result).toContain('|');
        });

        it('round-trips', () => {
            const original = '| A | B |\n| --- | --- |\n| 1 | 2 |';
            const parsed = parseMarkdownTable(original);
            const formatted = formatMarkdownTable(parsed!);
            const reparsed = parseMarkdownTable(formatted);
            expect(reparsed!.headers).toEqual(['A', 'B']);
            expect(reparsed!.rows[0]).toEqual(['1', '2']);
        });
    });

    describe('tableToCSV', () => {
        it('converts to CSV', () => {
            const table = { headers: ['Name', 'Value'], rows: [['a', '1'], ['b', '2']], alignments: [null, null] };
            const csv = tableToCSV(table);
            expect(csv).toBe('Name,Value\na,1\nb,2');
        });

        it('escapes commas', () => {
            const table = { headers: ['Name'], rows: [['a, b']], alignments: [null] };
            const csv = tableToCSV(table);
            expect(csv).toContain('"a, b"');
        });
    });
});
