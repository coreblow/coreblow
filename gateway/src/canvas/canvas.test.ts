import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import { renderA2UIToHTML, validateA2UITree, parseA2UIFromComponents, type A2UITree } from './a2ui-renderer.js';
import { normalizeUrlPath, resolveFileWithinRoot, isPathSafe, sanitizeFilename } from './file-resolver.js';

vi.mock('node:fs/promises', async (importOriginal) => {
    const actual = await importOriginal<typeof import('node:fs/promises')>();
    const mocks = {
        realpath: vi.fn(async (p) => String(p)),
        stat: vi.fn().mockImplementation(async () => { throw new Error('Not found') }),
        open: vi.fn().mockImplementation(async () => { throw new Error('Not found') }),
    };
    return { ...actual, ...mocks, default: { ...actual, ...mocks } };
});

describe('Canvas Module', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('a2ui-renderer.ts', () => {
        const sampleTree: A2UITree = {
            version: '0.9',
            root: 'root',
            components: [
                { id: 'root', type: 'column', children: ['btn1', 'text1'] },
                { id: 'btn1', type: 'button', label: 'Click Me' },
                { id: 'text1', type: 'text', value: 'Hello World' }
            ]
        };

        it('parseA2UIFromComponents creates valid tree', () => {
            const tree = parseA2UIFromComponents([{ id: 'c1', type: 'text', value: 'Val' }], { root: 'c1', title: 'Test' });
            expect(tree.version).toBe('0.9');
            expect(tree.root).toBe('c1');
            expect(tree.title).toBe('Test');
        });

        it('validateA2UITree approves a valid tree', () => {
            const errors = validateA2UITree(sampleTree);
            expect(errors.length).toBe(0);
        });

        it('validateA2UITree catches missing root or components', () => {
            const errors = validateA2UITree({
                version: '0.9',
                root: 'missing',
                components: [{ id: 'c1', type: 'text', value: 'Val' }]
            });
            expect(errors).toContain('Root component "missing" not found');
        });

        it('validateA2UITree catches missing child refs', () => {
            const errors = validateA2UITree({
                version: '0.9',
                root: 'c1',
                components: [{ id: 'c1', type: 'column', children: ['nope'] }]
            });
            expect(errors[0]).toContain('references non-existent child');
        });

        it('renderA2UIToHTML generates HTML correctly', () => {
            const html = renderA2UIToHTML(sampleTree);
            expect(html).toContain('<!DOCTYPE html>');
            expect(html).toContain('<button');
            expect(html).toContain('Click Me');
            expect(html).toContain('<p');
            expect(html).toContain('Hello World');
            expect(html).toContain('a2ui-column');
        });
    });

    describe('file-resolver.ts', () => {
        it('normalizeUrlPath handles decoding and traversal filtering', () => {
            expect(normalizeUrlPath('/a/b/../c')).toBe('/a/c');
            expect(normalizeUrlPath('/a%20b?query=1#hash')).toBe('/a b');
            
            // Should throw on null byte
            expect(() => normalizeUrlPath('/a\0b')).toThrow('Null byte');
        });

        it('isPathSafe blocks traversal attempts', () => {
            expect(isPathSafe('a/b/c.png')).toBe(true);
            expect(isPathSafe('../a.png')).toBe(false);
            expect(isPathSafe('a/../../../etc/passwd')).toBe(false);
            expect(isPathSafe('a\0b')).toBe(false);
        });

        it('sanitizeFilename restricts dangerous chars', () => {
            expect(sanitizeFilename('../hello???.png')).toBe('_hello___.png');
            expect(sanitizeFilename('nul.txt')).toBe('_nul.txt'); // Reserved
            expect(sanitizeFilename('a/b\\c:d')).toBe('a_b_c_d');
        });

        it('resolveFileWithinRoot enforces boundaries', async () => {
            // Mock directory structures
            vi.mocked(fs.realpath).mockImplementation(async (p: any) => {
                const sp = p as string;
                if (sp === '/root') return '/root';
                if (sp === '/root/valid.txt') return '/root/valid.txt';
                if (sp === '/root/../etc/passwd') return '/etc/passwd';
                throw new Error('Not found');
            });
            
            vi.mocked(fs.stat).mockResolvedValue({
                isFile: () => true,
                isDirectory: () => false
            } as any);

            vi.mocked(fs.open).mockResolvedValue({} as any);

            const valid = await resolveFileWithinRoot('/root', '/valid.txt');
            expect(valid).not.toBeNull();
            expect(valid?.realPath).toBe('/root/valid.txt');

            // Null bytes rejected
            const nullByte = await resolveFileWithinRoot('/root', '/valid.txt\0');
            expect(nullByte).toBeNull();
        });
    });
});
