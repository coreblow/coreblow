/**
 * markdown/frontmatter.test.ts — Frontmatter tests
 */
import { describe, it, expect } from 'vitest';
import { extractFrontmatter, setFrontmatter } from './frontmatter.js';

describe('Frontmatter', () => {
    describe('extractFrontmatter', () => {
        it('extracts YAML frontmatter', () => {
            const md = '---\ntitle: Hello\nauthor: Bot\n---\n\nContent here';
            const result = extractFrontmatter(md);
            expect(result.hasFrontmatter).toBe(true);
            expect(result.frontmatter.title).toBe('Hello');
            expect(result.frontmatter.author).toBe('Bot');
            expect(result.content).toBe('Content here');
        });

        it('handles no frontmatter', () => {
            const result = extractFrontmatter('Just content');
            expect(result.hasFrontmatter).toBe(false);
            expect(result.content).toBe('Just content');
        });

        it('parses boolean values', () => {
            const md = '---\ndraft: true\npublished: false\n---\n\nx';
            const result = extractFrontmatter(md);
            expect(result.frontmatter.draft).toBe(true);
            expect(result.frontmatter.published).toBe(false);
        });

        it('parses numeric values', () => {
            const md = '---\nversion: 42\n---\n\nx';
            const result = extractFrontmatter(md);
            expect(result.frontmatter.version).toBe(42);
        });

        it('parses null', () => {
            const md = '---\nempty: null\n---\n\nx';
            const result = extractFrontmatter(md);
            expect(result.frontmatter.empty).toBeNull();
        });

        it('handles quoted strings', () => {
            const md = '---\ntag: "quoted value"\n---\n\nx';
            const result = extractFrontmatter(md);
            expect(result.frontmatter.tag).toBe('quoted value');
        });

        it('handles arrays', () => {
            const md = '---\ntags: [a, b, c]\n---\n\nx';
            const result = extractFrontmatter(md);
            expect(result.frontmatter.tags).toEqual(['a', 'b', 'c']);
        });
    });

    describe('setFrontmatter', () => {
        it('adds frontmatter', () => {
            const result = setFrontmatter('Content', { title: 'New' });
            expect(result).toContain('---');
            expect(result).toContain('title: New');
            expect(result).toContain('Content');
        });

        it('updates existing frontmatter', () => {
            const md = '---\ntitle: Old\n---\n\nContent';
            const result = setFrontmatter(md, { title: 'Updated', version: 2 });
            expect(result).toContain('title: Updated');
            expect(result).toContain('version: 2');
        });
    });
});
