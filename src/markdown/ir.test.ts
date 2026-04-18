/**
 * markdown/ir.test.ts — Markdown IR parser tests
 */
import { describe, it, expect } from 'vitest';
import { parseMarkdownToIR, mergeIR, emptyIR } from './ir.js';

describe('Markdown IR', () => {
    describe('parseMarkdownToIR', () => {
        it('parses plain text', () => {
            const ir = parseMarkdownToIR('Hello world');
            expect(ir.text).toBe('Hello world');
            expect(ir.styles).toHaveLength(0);
        });

        it('parses bold', () => {
            const ir = parseMarkdownToIR('**bold text**');
            expect(ir.text).toBe('bold text');
            expect(ir.styles).toHaveLength(1);
            expect(ir.styles[0].style).toBe('bold');
        });

        it('parses italic', () => {
            const ir = parseMarkdownToIR('*italic*');
            expect(ir.text).toBe('italic');
            expect(ir.styles[0].style).toBe('italic');
        });

        it('parses strikethrough', () => {
            const ir = parseMarkdownToIR('~~deleted~~');
            expect(ir.text).toBe('deleted');
            expect(ir.styles[0].style).toBe('strikethrough');
        });

        it('parses inline code', () => {
            const ir = parseMarkdownToIR('use `npm install`');
            expect(ir.text).toBe('use npm install');
            expect(ir.styles[0].style).toBe('code');
        });

        it('parses links', () => {
            const ir = parseMarkdownToIR('Visit [Google](https://google.com)');
            expect(ir.text).toBe('Visit Google');
            expect(ir.links).toHaveLength(1);
            expect(ir.links[0].href).toBe('https://google.com');
        });

        it('parses mixed styles', () => {
            const ir = parseMarkdownToIR('**bold** and *italic*');
            expect(ir.text).toBe('bold and italic');
            expect(ir.styles).toHaveLength(2);
        });
    });

    describe('emptyIR', () => {
        it('creates empty IR', () => {
            const ir = emptyIR();
            expect(ir.text).toBe('');
            expect(ir.styles).toHaveLength(0);
            expect(ir.links).toHaveLength(0);
        });
    });

    describe('mergeIR', () => {
        it('merges multiple IRs', () => {
            const a = parseMarkdownToIR('**hello**');
            const b = parseMarkdownToIR('*world*');
            const merged = mergeIR([a, b]);
            expect(merged.text).toBe('hello\nworld');
            expect(merged.styles).toHaveLength(2);
        });

        it('returns empty for empty array', () => {
            expect(mergeIR([]).text).toBe('');
        });

        it('returns same for single', () => {
            const ir = parseMarkdownToIR('test');
            expect(mergeIR([ir]).text).toBe('test');
        });
    });
});
