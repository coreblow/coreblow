/**
 * markdown/fences.test.ts — Code fence tests
 */
import { describe, it, expect } from 'vitest';
import { extractCodeFences, stripCodeFences, detectLanguage } from './fences.js';

describe('Code Fences', () => {
    describe('extractCodeFences', () => {
        it('extracts single fence', () => {
            const md = 'text\n```js\nconsole.log("hi");\n```\nmore';
            const fences = extractCodeFences(md);
            expect(fences).toHaveLength(1);
            expect(fences[0].language).toBe('js');
            expect(fences[0].code).toBe('console.log("hi");');
        });

        it('extracts multiple fences', () => {
            const md = '```python\nprint("a")\n```\n\n```bash\necho "b"\n```';
            const fences = extractCodeFences(md);
            expect(fences).toHaveLength(2);
            expect(fences[0].language).toBe('python');
            expect(fences[1].language).toBe('bash');
        });

        it('handles no fences', () => {
            expect(extractCodeFences('plain text')).toHaveLength(0);
        });

        it('handles empty fences', () => {
            const md = '```\n\n```';
            const fences = extractCodeFences(md);
            expect(fences).toHaveLength(1);
            expect(fences[0].language).toBe('');
        });
    });

    describe('stripCodeFences', () => {
        it('replaces with placeholder', () => {
            const md = 'before\n```js\ncode\n```\nafter';
            const result = stripCodeFences(md);
            expect(result).toContain('[CODE_BLOCK]');
            expect(result).not.toContain('code');
        });

        it('custom placeholder', () => {
            const md = '```\nfoo\n```';
            expect(stripCodeFences(md, '...')).toContain('...');
        });
    });

    describe('detectLanguage', () => {
        it('detects javascript', () => expect(detectLanguage('const x = 1;')).toBe('javascript'));
        it('detects python', () => expect(detectLanguage('def foo():\n    pass')).toBe('python'));
        it('detects bash', () => expect(detectLanguage('#!/bin/bash\necho hi')).toBe('bash'));
        it('detects json', () => expect(detectLanguage('{"key": "value"}')).toBe('json'));
        it('detects html', () => expect(detectLanguage('<div>hello</div>')).toBe('html'));
        it('returns null for unknown', () => expect(detectLanguage('random text')).toBeNull());
    });
});
