import { describe, it, expect } from 'vitest';
import { FormatConverter } from './format-converter.js';

describe('FormatConverter', () => {
    const converter = new FormatConverter();

    describe('jsonToCsv', () => {
        it('converts array of objects to CSV', () => {
            const data = [
                { name: 'Alice', age: 30 },
                { name: 'Bob', age: 25 },
            ];
            const csv = converter.jsonToCsv(data);
            expect(csv).toBe('name,age\nAlice,30\nBob,25');
        });

        it('returns empty for empty array', () => {
            expect(converter.jsonToCsv([])).toBe('');
        });

        it('escapes commas in values', () => {
            const data = [{ name: 'Doe, Jane', city: 'NYC' }];
            const csv = converter.jsonToCsv(data);
            expect(csv).toContain('"Doe, Jane"');
        });

        it('escapes quotes in values', () => {
            const data = [{ note: 'He said "hello"' }];
            const csv = converter.jsonToCsv(data);
            expect(csv).toContain('""hello""');
        });

        it('handles null/undefined values', () => {
            const data = [{ a: null, b: undefined }];
            const csv = converter.jsonToCsv(data);
            expect(csv).toBe('a,b\n,');
        });
    });

    describe('csvToJson', () => {
        it('converts CSV to array of objects', () => {
            const csv = 'name,age\nAlice,30\nBob,25';
            const result = converter.csvToJson(csv);
            expect(result).toEqual([
                { name: 'Alice', age: '30' },
                { name: 'Bob', age: '25' },
            ]);
        });

        it('returns empty for header-only CSV', () => {
            expect(converter.csvToJson('name,age')).toEqual([]);
        });

        it('returns empty for empty string', () => {
            expect(converter.csvToJson('')).toEqual([]);
        });
    });

    describe('jsonToCsv ↔ csvToJson roundtrip', () => {
        it('roundtrips simple data', () => {
            const data = [{ x: '1', y: '2' }, { x: '3', y: '4' }];
            const csv = converter.jsonToCsv(data);
            const back = converter.csvToJson(csv);
            expect(back).toEqual(data);
        });
    });

    describe('jsonToKeyValue', () => {
        it('flattens object to key-value pairs', () => {
            const result = converter.jsonToKeyValue({ a: 1, b: 'hello' });
            expect(result).toEqual([
                { key: 'a', value: '1' },
                { key: 'b', value: 'hello' },
            ]);
        });

        it('handles nested objects', () => {
            const result = converter.jsonToKeyValue({ db: { host: 'localhost', port: 5432 } });
            expect(result).toEqual([
                { key: 'db.host', value: 'localhost' },
                { key: 'db.port', value: '5432' },
            ]);
        });
    });

    describe('keyValueToJson', () => {
        it('reconstructs nested object', () => {
            const pairs = [
                { key: 'db.host', value: 'localhost' },
                { key: 'db.port', value: '5432' },
            ];
            const result = converter.keyValueToJson(pairs);
            expect(result).toEqual({ db: { host: 'localhost', port: '5432' } });
        });
    });

    describe('flatten', () => {
        it('flattens nested object', () => {
            const result = converter.flatten({ a: { b: { c: 1 } }, d: 2 });
            expect(result).toEqual({ 'a.b.c': 1, d: 2 });
        });

        it('preserves arrays', () => {
            const result = converter.flatten({ a: [1, 2] });
            expect(result).toEqual({ a: [1, 2] });
        });
    });

    describe('unflatten', () => {
        it('unflattens dot-notation keys', () => {
            const result = converter.unflatten({ 'a.b': 1, 'a.c': 2, d: 3 });
            expect(result).toEqual({ a: { b: '1', c: '2' }, d: '3' });
        });
    });
});
