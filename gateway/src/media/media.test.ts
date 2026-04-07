import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import { AttachmentPipeline } from './attachments.js';
import { MediaProcessor } from './media-processor.js';

vi.mock('node:fs', async (importOriginal) => {
    const actual = await importOriginal<typeof import('node:fs')>();
    const mocks = {
        mkdirSync: vi.fn(),
        writeFileSync: vi.fn(),
        readdirSync: vi.fn().mockReturnValue([]),
        unlinkSync: vi.fn(),
        statSync: vi.fn().mockImplementation(() => { throw new Error('Not') }),
        readFileSync: vi.fn().mockImplementation(() => { throw new Error('Not') }),
    };
    return { ...actual, ...mocks, default: { ...actual, ...mocks } };
});

describe('Media Module', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('attachments.ts: AttachmentPipeline', () => {
        let pipeline: AttachmentPipeline;

        beforeEach(() => {
            vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
            pipeline = new AttachmentPipeline({ 
                maxFileSize: 1000, 
                cacheDir: '/mock/cache',
                blockedMimeTypes: ['forbidden/type']
            });
        });

        it('normalizes attachment correctly', () => {
            const raw = { filename: 'test.jpg', mimeType: 'image/jpeg', size: 100, channel: 'slack' };
            const normalized = pipeline.normalize(raw);
            
            expect(normalized.id).toBeDefined();
            expect(normalized.type).toBe('image');
            expect(normalized.localPath).toContain('/mock/cache');
            expect(normalized.localPath).toMatch(/\.jpg$/); // gets ext from filename
            expect(normalized.cached).toBe(false);
        });

        it('detectType infers type correctly', () => {
            expect(pipeline.detectType('image/png', 'test.png')).toBe('image');
            expect(pipeline.detectType('audio/mpeg', 'test.mp3')).toBe('audio');
            expect(pipeline.detectType('application/unknown', 'test.mp4')).toBe('video'); // via ext
            expect(pipeline.detectType('video/mp4')).toBe('video'); // via mime string check
            expect(pipeline.detectType('text/plain')).toBe('document');
        });

        it('validates against max file size', () => {
            expect(pipeline.validate({ size: 500, mimeType: 'image/jpeg', filename: 'ok.jpg', channel: '' }).valid).toBe(true);
            expect(pipeline.validate({ size: 1500, mimeType: 'image/jpeg', filename: 'big.jpg', channel: '' }).valid).toBe(false);
        });

        it('validates against blocked mime types', () => {
            expect(pipeline.validate({ size: 500, mimeType: 'forbidden/type', filename: 'bad.bad', channel: '' }).valid).toBe(false);
        });

        it('builds context string properly', () => {
            const atts: any[] = [
                { type: 'image', filename: 'test.png', size: 1024, description: 'A cat' },
                { type: 'document', filename: 'doc.txt', size: 2048, text: 'Hello world' }
            ];
            
            const context = pipeline.buildContext(atts);
            expect(context).toContain('[Attachments]');
            expect(context).toContain('- image: test.png (1KB): A cat');
            expect(context).toContain('- document: doc.txt (2KB) — Content: "Hello world"');
        });

        it('processes attachments successfully', async () => {
            const raw = { filename: 'test.jpg', mimeType: 'image/jpeg', size: 100, channel: 'slack', buffer: Buffer.from('img') };
            vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);
            
            const result = await pipeline.process(raw);
            expect(result).not.toBeNull();
            expect(result?.type).toBe('image');
            expect(result?.cached).toBe(false);

            // Second trigger should hit cache
            const resultCached = await pipeline.process(raw);
            expect(resultCached?.cached).toBe(true);
        });

        it('clears cache successfully', () => {
            vi.mocked(fs.readdirSync).mockReturnValue(['a.jpg', 'b.png'] as any);
            vi.mocked(fs.unlinkSync).mockImplementation(() => undefined);
            
            pipeline.clearCache();
            expect(fs.readdirSync).toHaveBeenCalled();
            expect(fs.unlinkSync).toHaveBeenCalledTimes(2);
        });
    });

    describe('media-processor.ts: MediaProcessor', () => {
        let processor: MediaProcessor;

        beforeEach(() => {
            processor = new MediaProcessor('/mock/upload');
        });

        it('processes from buffer', () => {
            const buffer = Buffer.from('hello world');
            const meta = processor.processBuffer(buffer, 'test.txt');

            expect(meta.id.length).toBe(16); // hex 8 bytes
            expect(meta.filename).toBe('test.txt');
            expect(meta.type).toBe('document');
            expect(meta.mimeType).toBe('text/plain');
            expect(meta.size).toBe(11);
            expect(meta.hash).toBeDefined();
        });

        it('validates against channel constraints', () => {
            const constraints = processor.getConstraints('discord');
            expect(constraints).toBeDefined();

            // Should be valid
            const validMeta = { type: 'image', filename: 'a.png', size: 1000 } as any;
            expect(processor.validate(validMeta, 'discord').valid).toBe(true);

            // Should be invalid (too big for discord)
            const bigMeta = { type: 'video', filename: 'b.mp4', size: 50 * 1024 * 1024 } as any; // 50MB (Discord limit is 25MB)
            expect(processor.validate(bigMeta, 'discord').valid).toBe(false);

            // Should be invalid (unsupported ext)
            const badExt = { type: 'document', filename: 'c.exe', size: 1000 } as any;
            expect(processor.validate(badExt, 'discord').valid).toBe(false);
        });

        it('processes file from disk', () => {
            vi.mocked(fs.statSync).mockReturnValue({ size: 123 } as any);
            vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('data'));

            const meta = processor.processFile('/path/test.png');
            expect(meta).not.toBeNull();
            expect(meta?.type).toBe('image');
        });

        it('fails processing inaccessible file', () => {
            vi.mocked(fs.statSync).mockImplementation(() => { throw new Error('Not found'); });
            const meta = processor.processFile('/path/invalid.png');
            expect(meta).toBeNull();
        });
    });
});
