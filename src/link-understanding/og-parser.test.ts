/**
 * link-understanding/og-parser.test.ts — OpenGraph parser tests
 */
import { describe, it, expect } from 'vitest';
import { parseOpenGraph } from './og-parser.js';

describe('OpenGraph Parser', () => {
    it('should parse og:title', () => {
        const html = '<meta property="og:title" content="Hello World">';
        const og = parseOpenGraph(html);
        expect(og.title).toBe('Hello World');
    });

    it('should parse multiple og tags', () => {
        const html = '<meta property="og:title" content="Title"><meta property="og:description" content="Desc">';
        const og = parseOpenGraph(html);
        expect(og.title).toBe('Title');
        expect(og.description).toBe('Desc');
    });

    it('should return empty for no og tags', () => {
        const og = parseOpenGraph('<html><body>Hello</body></html>');
        expect(Object.keys(og)).toHaveLength(0);
    });
});
