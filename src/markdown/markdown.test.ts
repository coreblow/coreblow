import { describe, it, expect } from 'vitest';
import { parseMarkdown } from './parser.js';

describe('parseMarkdown', () => {
    it('parses headings', () => {
        const result = parseMarkdown('# Hello');
        expect(result[0].type).toBe('heading');
        expect(result[0].content).toBe('Hello');
    });

    it('parses paragraphs', () => {
        const result = parseMarkdown('Just a paragraph');
        expect(result[0].type).toBe('paragraph');
        expect(result[0].content).toBe('Just a paragraph');
    });

    it('handles multiple lines', () => {
        const result = parseMarkdown('# Title\nBody line\n## Subtitle');
        expect(result).toHaveLength(3);
        expect(result[0].type).toBe('heading');
        expect(result[1].type).toBe('paragraph');
        expect(result[2].type).toBe('heading');
    });

    it('strips heading markers', () => {
        expect(parseMarkdown('## Level 2')[0].content).toBe('Level 2');
        expect(parseMarkdown('### Level 3')[0].content).toBe('Level 3');
    });

    it('handles empty input', () => {
        expect(parseMarkdown('')).toHaveLength(1);
    });

    it('handles empty lines', () => {
        const result = parseMarkdown('Line 1\n\nLine 3');
        expect(result).toHaveLength(3);
        expect(result[1].content).toBe('');
    });
});
