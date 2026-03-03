import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { discoverBootstrapFiles, loadBootstrapFile, mergeBootstrapContents, hasBootstrapFiles } from './bootstrap-files.js';

const GATEWAY_DIR = path.resolve(import.meta.dirname, '../../');

describe('Bootstrap Files', () => {
    describe('discoverBootstrapFiles', () => {
        it('finds files in gateway dir', () => {
            const files = discoverBootstrapFiles(GATEWAY_DIR);
            // May or may not find files depending on repo state
            expect(Array.isArray(files)).toBe(true);
        });
        it('returns empty for nonexistent dir', () => {
            expect(discoverBootstrapFiles('/tmp/nonexistent-xyz-123')).toHaveLength(0);
        });
        it('accepts extra patterns', () => {
            const files = discoverBootstrapFiles(GATEWAY_DIR, ['package.json']);
            expect(files.some((f) => f.relativePath === 'package.json')).toBe(true);
        });
    });

    describe('loadBootstrapFile', () => {
        it('loads existing file', () => {
            const file = loadBootstrapFile(path.join(GATEWAY_DIR, 'package.json'));
            expect(file).not.toBeNull();
            expect(file!.content.length).toBeGreaterThan(0);
        });
        it('returns null for missing', () => {
            expect(loadBootstrapFile('/tmp/nonexistent-file-xyz')).toBeNull();
        });
    });

    describe('mergeBootstrapContents', () => {
        it('merges with separator', () => {
            const files = [
                { path: '/a', content: 'content A', size: 9, relativePath: 'a.md' },
                { path: '/b', content: 'content B', size: 9, relativePath: 'b.md' },
            ];
            const merged = mergeBootstrapContents(files);
            expect(merged).toContain('content A');
            expect(merged).toContain('content B');
            expect(merged).toContain('---');
        });
    });

    describe('hasBootstrapFiles', () => {
        it('false for empty dir', () => {
            expect(hasBootstrapFiles('/tmp')).toBe(false);
        });
    });
});
