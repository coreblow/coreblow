/**
 * CoreBlow — Apply Patch Update Tests
 *
 * Tests for applyUpdateHunk: line replacement, insertion,
 * context-based seeking, fuzzy matching, error handling.
 */

import { describe, it, expect } from 'vitest';
import { applyUpdateHunk } from './apply-patch-update.js';

const mockReader = (content: string) => async () => content;

describe('applyUpdateHunk', () => {
    it('replaces exact lines', async () => {
        const result = await applyUpdateHunk('test.ts', [
            { oldLines: ['line2'], newLines: ['replaced2'], isEndOfFile: false },
        ], { readFile: mockReader('line1\nline2\nline3\n') });

        expect(result).toContain('replaced2');
        expect(result).not.toContain('line2');
        expect(result).toContain('line1');
        expect(result).toContain('line3');
    });

    it('inserts new lines when oldLines is empty', async () => {
        const result = await applyUpdateHunk('test.ts', [
            { oldLines: [], newLines: ['inserted'], isEndOfFile: false },
        ], { readFile: mockReader('existing\n') });

        expect(result).toContain('inserted');
        expect(result).toContain('existing');
    });

    it('replaces multiple consecutive lines', async () => {
        const result = await applyUpdateHunk('test.ts', [
            { oldLines: ['a', 'b'], newLines: ['x', 'y', 'z'], isEndOfFile: false },
        ], { readFile: mockReader('a\nb\nc\n') });

        expect(result).toContain('x');
        expect(result).toContain('y');
        expect(result).toContain('z');
        expect(result).toContain('c');
        expect(result).not.toContain('\na\n');
    });

    it('uses context to find correct location', async () => {
        const result = await applyUpdateHunk('test.ts', [
            {
                changeContext: 'function bar() {',
                oldLines: ['  return 2;'],
                newLines: ['  return 42;'],
                isEndOfFile: false,
            },
        ], {
            readFile: mockReader(
                'function foo() {\n  return 1;\n}\nfunction bar() {\n  return 2;\n}\n'
            ),
        });

        expect(result).toContain('return 42');
        expect(result).toContain('return 1'); // foo unchanged
    });

    it('handles EOF-anchored chunks', async () => {
        const result = await applyUpdateHunk('test.ts', [
            { oldLines: ['last'], newLines: ['very-last'], isEndOfFile: true },
        ], { readFile: mockReader('first\nmiddle\nlast\n') });

        expect(result).toContain('very-last');
    });

    it('matches with trailing whitespace tolerance', async () => {
        const result = await applyUpdateHunk('test.ts', [
            { oldLines: ['  code'], newLines: ['  new-code'], isEndOfFile: false },
        ], { readFile: mockReader('  code  \n') }); // trailing spaces in file

        expect(result).toContain('new-code');
    });

    it('throws on missing context', async () => {
        await expect(
            applyUpdateHunk('test.ts', [
                { changeContext: 'nonexistent', oldLines: ['x'], newLines: ['y'], isEndOfFile: false },
            ], { readFile: mockReader('a\nb\n') }),
        ).rejects.toThrow(/context/i);
    });

    it('throws on missing old lines', async () => {
        await expect(
            applyUpdateHunk('test.ts', [
                { oldLines: ['nonexistent-line'], newLines: ['y'], isEndOfFile: false },
            ], { readFile: mockReader('a\nb\n') }),
        ).rejects.toThrow(/Failed to find/);
    });

    it('throws on unreadable file', async () => {
        await expect(
            applyUpdateHunk('missing.ts', [
                { oldLines: ['x'], newLines: ['y'], isEndOfFile: false },
            ], { readFile: async () => { throw new Error('ENOENT'); } }),
        ).rejects.toThrow(/Failed to read/);
    });

    it('preserves trailing newline', async () => {
        const result = await applyUpdateHunk('test.ts', [
            { oldLines: ['a'], newLines: ['b'], isEndOfFile: false },
        ], { readFile: mockReader('a\n') });

        expect(result.endsWith('\n')).toBe(true);
    });

    it('normalizes unicode punctuation for fuzzy matching', async () => {
        // em-dash → hyphen, smart quotes → straight quotes
        const result = await applyUpdateHunk('test.ts', [
            { oldLines: ['hello - world'], newLines: ['hello — world replaced'], isEndOfFile: false },
        ], { readFile: mockReader('hello \u2014 world\n') });

        expect(result).toContain('replaced');
    });
});
