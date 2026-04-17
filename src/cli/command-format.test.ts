/**
 * cli/command-format.test.ts — Output formatting tests
 */
import { describe, it, expect } from 'vitest';
import { formatTable, formatKeyValue, formatOutput, wrapText, type ColumnDef } from './command-format.js';

describe('Command Format', () => {
    describe('formatTable', () => {
        it('formats rows', () => {
            const cols: ColumnDef[] = [
                { key: 'name', label: 'Name' },
                { key: 'status', label: 'Status' },
            ];
            const rows = [
                { name: 'discord', status: 'active' },
                { name: 'telegram', status: 'idle' },
            ];
            const result = formatTable(rows, cols);
            expect(result).toContain('Name');
            expect(result).toContain('discord');
            expect(result).toContain('active');
            expect(result).toContain('─');
        });

        it('returns empty for no rows', () => expect(formatTable([], [{ key: 'a', label: 'A' }])).toBe(''));

        it('respects alignment', () => {
            const cols: ColumnDef[] = [{ key: 'val', label: 'Value', align: 'right', width: 10 }];
            const result = formatTable([{ val: '42' }], cols);
            expect(result).toContain('        42');
        });
    });

    describe('formatKeyValue', () => {
        it('formats pairs', () => {
            const result = formatKeyValue([['Port', 3000], ['Host', '0.0.0.0']]);
            expect(result).toContain('Port');
            expect(result).toContain('3000');
            expect(result).toContain('Host');
        });
    });

    describe('formatOutput', () => {
        it('json format', () => {
            const result = formatOutput({ key: 'value' }, 'json');
            expect(JSON.parse(result)).toEqual({ key: 'value' });
        });

        it('text format', () => {
            expect(formatOutput('hello', 'text')).toBe('hello');
        });

        it('yaml format', () => {
            const result = formatOutput({ name: 'bot', port: 3000 }, 'yaml');
            expect(result).toContain('name: bot');
            expect(result).toContain('port: 3000');
        });

        it('table format with array', () => {
            const result = formatOutput([{ a: 1, b: 2 }], 'table');
            expect(result).toContain('a');
            expect(result).toContain('b');
        });
    });

    describe('wrapText', () => {
        it('wraps long text', () => {
            const result = wrapText('a b c d e f g h i j k l m n o p', 10);
            const lines = result.split('\n');
            expect(lines.length).toBeGreaterThan(1);
            for (const line of lines) expect(line.length).toBeLessThanOrEqual(12);
        });

        it('does not wrap short text', () => {
            expect(wrapText('hello', 80)).toBe('hello');
        });
    });
});
