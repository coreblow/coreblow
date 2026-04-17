/**
 * Tests: Link Understanding — OG Parser, Link Preview
 */
import { describe, it, expect } from 'vitest';
import { parseOpenGraph } from '../../src/link-understanding/og-parser.js';

describe('parseOpenGraph', () => {
    it('extracts og:title from HTML', () => {
        const html = `
            <html><head>
                <meta property="og:title" content="Test Page">
                <meta property="og:description" content="A description">
                <meta property="og:image" content="https://example.com/img.jpg">
            </head></html>
        `;
        const og = parseOpenGraph(html);
        expect(og.title).toBe('Test Page');
        expect(og.description).toBe('A description');
        expect(og.image).toBe('https://example.com/img.jpg');
    });

    it('handles missing OG tags', () => {
        const og = parseOpenGraph('<html><head></head></html>');
        expect(Object.keys(og)).toHaveLength(0);
    });

    it('handles malformed HTML', () => {
        const og = parseOpenGraph('not html at all');
        expect(og).toBeDefined();
    });

    it('extracts og:url', () => {
        const html = '<meta property="og:url" content="https://example.com/page">';
        expect(parseOpenGraph(html).url).toBe('https://example.com/page');
    });

    it('extracts og:type', () => {
        const html = '<meta property="og:type" content="article">';
        expect(parseOpenGraph(html).type).toBe('article');
    });

    it('handles single quotes', () => {
        const html = "<meta property='og:title' content='Single Quoted'>";
        expect(parseOpenGraph(html).title).toBe('Single Quoted');
    });
});
