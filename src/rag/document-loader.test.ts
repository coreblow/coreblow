import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'node:fs/promises';
import { DocumentLoader, detectFormat } from './document-loader.js';

// Mock fs/promises with factory pattern to avoid "Cannot redefine property"
const mockStat = vi.fn();
const mockReadFile = vi.fn();
const mockReaddir = vi.fn();

vi.mock('node:fs/promises', async (importOriginal) => {
    const actual = await importOriginal<typeof import('node:fs/promises')>();
    return {
        ...actual,
        stat: (...args: any[]) => mockStat(...args),
        readFile: (...args: any[]) => mockReadFile(...args),
        readdir: (...args: any[]) => mockReaddir(...args),
    };
});

describe('DocumentLoader', () => {
    let loader: DocumentLoader;

    beforeEach(() => {
        vi.clearAllMocks();
        loader = new DocumentLoader({ maxFileSize: 5000 });
    });

    describe('detectFormat', () => {
        it('identifies markdown', () => {
            expect(detectFormat('readme.md')).toBe('markdown');
            expect(detectFormat('docs.mdx')).toBe('markdown');
        });

        it('identifies code formats', () => {
            expect(detectFormat('index.ts')).toBe('typescript');
            expect(detectFormat('app.tsx')).toBe('typescript');
            expect(detectFormat('main.js')).toBe('javascript');
            expect(detectFormat('main.mjs')).toBe('javascript');
            expect(detectFormat('script.py')).toBe('python');
        });

        it('identifies data formats', () => {
            expect(detectFormat('data.json')).toBe('json');
            expect(detectFormat('data.csv')).toBe('csv');
            expect(detectFormat('page.html')).toBe('html');
            expect(detectFormat('page.htm')).toBe('html');
        });

        it('returns unknown for unsupported extensions', () => {
            expect(detectFormat('file.xyz')).toBe('unknown');
            expect(detectFormat('file.docx')).toBe('unknown');
            expect(detectFormat('file')).toBe('unknown');
        });
    });

    describe('loadFile', () => {
        it('loads a markdown file successfully', async () => {
            mockStat.mockResolvedValue({
                isFile: () => true,
                size: 100,
                mtimeMs: 1700000000000,
            });
            mockReadFile.mockResolvedValue('# Hello World\n\nSome content here.');

            const doc = await loader.loadFile('/workspace/readme.md');
            expect(doc).not.toBeNull();
            expect(doc!.path).toBe('/workspace/readme.md');
            expect(doc!.format).toBe('markdown');
            expect(doc!.content).toContain('Hello World');
            expect(doc!.metadata.sizeBytes).toBe(100);
            expect(doc!.metadata.extension).toBe('.md');
            expect(doc!.metadata.modifiedAt).toBe(1700000000000);
        });

        it('returns null for files exceeding max size', async () => {
            mockStat.mockResolvedValue({
                isFile: () => true,
                size: 999999, // over the 5000 byte limit
                mtimeMs: 0,
            });

            const doc = await loader.loadFile('/workspace/huge.md');
            expect(doc).toBeNull();
        });

        it('returns null for directories', async () => {
            mockStat.mockResolvedValue({
                isFile: () => false,
                size: 100,
                mtimeMs: 0,
            });

            const doc = await loader.loadFile('/workspace/somedir');
            expect(doc).toBeNull();
        });

        it('returns null for unsupported extensions', async () => {
            mockStat.mockResolvedValue({
                isFile: () => true,
                size: 100,
                mtimeMs: 0,
            });

            const doc = await loader.loadFile('/workspace/binary.exe');
            expect(doc).toBeNull();
        });

        it('returns null if stat throws (ENOENT)', async () => {
            mockStat.mockRejectedValue(new Error('ENOENT'));

            const doc = await loader.loadFile('/workspace/nonexistent.md');
            expect(doc).toBeNull();
        });

        it('returns null for empty-content files', async () => {
            mockStat.mockResolvedValue({
                isFile: () => true,
                size: 10,
                mtimeMs: 0,
            });
            mockReadFile.mockResolvedValue('   \n\n   '); // whitespace only

            const doc = await loader.loadFile('/workspace/empty.md');
            expect(doc).toBeNull();
        });

        it('extracts text from JSON files', async () => {
            mockStat.mockResolvedValue({
                isFile: () => true,
                size: 50,
                mtimeMs: 0,
            });
            mockReadFile.mockResolvedValue('{"name":"CoreBlow","version":"1.0"}');

            const doc = await loader.loadFile('/workspace/package.json');
            expect(doc).not.toBeNull();
            expect(doc!.format).toBe('json');
            expect(doc!.content).toContain('CoreBlow');
        });

        it('extracts text from HTML files (strips scripts)', async () => {
            mockStat.mockResolvedValue({
                isFile: () => true,
                size: 200,
                mtimeMs: 0,
            });
            mockReadFile.mockResolvedValue(
                '<html><head><title>Test</title></head><body><p>Hello</p><script>alert(1)</script></body></html>'
            );

            const doc = await loader.loadFile('/workspace/page.html');
            expect(doc).not.toBeNull();
            expect(doc!.format).toBe('html');
            expect(doc!.content).toContain('Hello');
            expect(doc!.content).not.toContain('alert'); // script stripped
        });
    });

    describe('loadSources', () => {
        it('loads multiple file sources', async () => {
            mockStat.mockResolvedValue({
                isFile: () => true,
                isDirectory: () => false,
                size: 50,
                mtimeMs: 0,
            });
            mockReadFile.mockResolvedValue('content');

            const docs = await loader.loadSources(['/a.md', '/b.txt']);
            expect(docs.length).toBe(2);
        });

        it('skips inaccessible sources gracefully', async () => {
            mockStat.mockRejectedValue(new Error('ENOENT'));

            const docs = await loader.loadSources(['/missing.md']);
            expect(docs).toEqual([]);
        });
    });
});
