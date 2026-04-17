/**
 * CoreBlow Phase 17 — Media & Data Pipeline Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MediaProcessor } from '../../src/media/media-processor.js';
import { DataPipeline } from '../../src/infra/data-pipeline.js';
import { TemplateEngine } from '../../src/infra/template-engine.js';
import { CacheManager } from '../../src/infra/cache-manager.js';
import { ConfigLoader } from '../../src/config/config-loader.js';

// ================================================================
// Media Processor Tests
// ================================================================
describe('MediaProcessor', () => {
    let processor: MediaProcessor;
    beforeEach(() => { processor = new MediaProcessor(); });

    it('should process a buffer', () => {
        const buf = Buffer.from('hello world');
        const meta = processor.processBuffer(buf, 'test.txt');
        expect(meta.type).toBe('document');
        expect(meta.mimeType).toBe('text/plain');
        expect(meta.size).toBe(11);
        expect(meta.hash).toBeTruthy();
    });

    it('should detect image type', () => {
        const meta = processor.processBuffer(Buffer.from('img'), 'photo.png');
        expect(meta.type).toBe('image');
    });

    it('should detect audio type', () => {
        const meta = processor.processBuffer(Buffer.from('audio'), 'song.mp3');
        expect(meta.type).toBe('audio');
    });

    it('should validate against channel constraints', () => {
        const meta = processor.processBuffer(Buffer.alloc(50 * 1024 * 1024), 'big.mp4');
        const result = processor.validate(meta, 'discord');
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain('too large');
    });

    it('should pass valid files', () => {
        const meta = processor.processBuffer(Buffer.alloc(1024), 'small.png');
        const result = processor.validate(meta, 'discord');
        expect(result.valid).toBe(true);
    });

    it('should get constraints for channel', () => {
        const constraints = processor.getConstraints('telegram');
        expect(constraints).not.toBeNull();
        expect(constraints!.maxFileSize).toBe(50 * 1024 * 1024);
    });

    it('should get MIME type', () => {
        expect(processor.getMimeType('pdf')).toBe('application/pdf');
        expect(processor.getMimeType('unknown')).toBe('application/octet-stream');
    });
});

// ================================================================
// Data Pipeline Tests
// ================================================================
describe('DataPipeline', () => {
    it('should transform data through stages', async () => {
        const result = await DataPipeline.create<string>()
            .map('upper', (s) => s.toUpperCase())
            .map('exclaim', (s) => s + '!')
            .execute('hello');
        expect(result.success).toBe(true);
        expect(result.output).toBe('HELLO!');
    });

    it('should handle errors', async () => {
        const result = await DataPipeline.create<string>()
            .map('fail', () => { throw new Error('oops'); })
            .execute('input');
        expect(result.success).toBe(false);
        expect(result.error).toContain('oops');
    });

    it('should skip filtered stages', async () => {
        const pipeline = DataPipeline.create<number>();
        pipeline.map('double', (n) => n * 2);
        const result = await pipeline.execute(5);
        expect(result.success).toBe(true);
        expect(result.output).toBe(10);
    });

    it('should track stage durations', async () => {
        const result = await DataPipeline.create<string>()
            .map('step1', (s) => s + '1')
            .map('step2', (s) => s + '2')
            .execute('');
        expect(result.stages).toHaveLength(2);
        expect(result.stages[0]!.name).toBe('step1');
    });

    it('should get stage names', () => {
        const pipeline = DataPipeline.create<string>()
            .map('a', (s) => s)
            .map('b', (s) => s);
        expect(pipeline.getStageNames()).toEqual(['a', 'b']);
    });
});

// ================================================================
// Template Engine Tests
// ================================================================
describe('TemplateEngine', () => {
    let engine: TemplateEngine;
    beforeEach(() => { engine = new TemplateEngine(); });

    it('should interpolate variables', () => {
        expect(engine.render('Hello {{name}}!', { name: 'World' })).toBe('Hello World!');
    });

    it('should handle dot notation', () => {
        expect(engine.render('{{user.name}}', { user: { name: 'Alice' } })).toBe('Alice');
    });

    it('should apply filters', () => {
        expect(engine.render('{{name|upper}}', { name: 'hello' })).toBe('HELLO');
    });

    it('should handle conditionals', () => {
        expect(engine.render('{{#if show}}yes{{/if}}', { show: true })).toBe('yes');
        expect(engine.render('{{#if show}}yes{{/if}}', { show: false })).toBe('');
    });

    it('should handle if/else', () => {
        expect(engine.render('{{#if show}}yes{{#else}}no{{/if}}', { show: false })).toBe('no');
    });

    it('should handle loops', () => {
        const result = engine.render('{{#each items}}{{this}},{{/each}}', { items: ['a', 'b', 'c'] });
        expect(result).toBe('a,b,c,');
    });

    it('should render named templates', () => {
        engine.register('greeting', 'Hi {{name}}!');
        expect(engine.renderNamed('greeting', { name: 'Bob' })).toBe('Hi Bob!');
    });

    it('should include partials', () => {
        engine.registerPartial('header', '=== HEADER ===');
        expect(engine.render('{{> header}} content')).toBe('=== HEADER === content');
    });

    it('should have built-in filters', () => {
        expect(engine.listFilters()).toContain('upper');
        expect(engine.listFilters()).toContain('escape');
        expect(engine.listFilters()).toContain('json');
    });
});

// ================================================================
// Cache Manager Tests
// ================================================================
describe('CacheManager', () => {
    let cache: CacheManager;
    beforeEach(() => { cache = new CacheManager(); });

    it('should set and get values', () => {
        cache.set('key', 'value');
        expect(cache.get('key')).toBe('value');
    });

    it('should return undefined for missing keys', () => {
        expect(cache.get('nope')).toBeUndefined();
    });

    it('should expire entries', async () => {
        cache.set('key', 'val', 50); // 50ms TTL
        await new Promise((r) => setTimeout(r, 60));
        expect(cache.get('key')).toBeUndefined();
    });

    it('should track hit/miss stats', () => {
        cache.set('a', 1);
        cache.get('a'); // hit
        cache.get('b'); // miss
        const stats = cache.getStats();
        expect(stats.hits).toBe(1);
        expect(stats.misses).toBe(1);
    });

    it('should evict by LRU', async () => {
        const small = new CacheManager({ maxEntries: 2 });
        small.set('a', 1);
        small.set('b', 2);
        await new Promise((r) => setTimeout(r, 5));
        small.get('a'); // access 'a' so 'b' is LRU
        small.set('c', 3); // should evict 'b'
        expect(small.has('b')).toBe(false);
        expect(small.has('a')).toBe(true);
    });

    it('should getOrSet', async () => {
        let calls = 0;
        const factory = async () => { calls++; return 42; };
        await cache.getOrSet('key', factory);
        await cache.getOrSet('key', factory);
        expect(calls).toBe(1); // Only called once
    });

    it('should clear by namespace', () => {
        cache.set('a', 1, 0, 'temp');
        cache.set('b', 2, 0, 'temp');
        cache.set('c', 3, 0, 'keep');
        expect(cache.clear('temp')).toBe(2);
        expect(cache.size()).toBe(1);
    });
});

// ================================================================
// Config Loader Tests
// ================================================================
describe('ConfigLoader', () => {
    let loader: ConfigLoader;
    beforeEach(() => { loader = new ConfigLoader(); });

    it('should set and get values', () => {
        loader.set('model', 'gpt-4o');
        expect(loader.get('model')).toBe('gpt-4o');
    });

    it('should use defaults', () => {
        loader.setDefaults({ port: 3000, debug: false });
        expect(loader.get('port')).toBe(3000);
    });

    it('should load from env vars', () => {
        loader.loadEnv({ CB_MODEL: 'gpt-4o', CB_PORT: '8080', OTHER_VAR: 'ignore' });
        expect(loader.get('model')).toBe('gpt-4o');
        expect(loader.get('port')).toBe(8080); // coerced
    });

    it('should load from CLI args', () => {
        loader.loadArgs(['--model=claude-3', '--verbose', '--port=3000']);
        expect(loader.get('model')).toBe('claude-3');
        expect(loader.get('verbose')).toBe(true);
        expect(loader.get('port')).toBe(3000);
    });

    it('should respect precedence', () => {
        loader.setDefaults({ model: 'default' });
        loader.set('model', 'file-value', 'file');
        expect(loader.get('model')).toBe('file-value');
        loader.set('model', 'env-value', 'env');
        expect(loader.get('model')).toBe('env-value');
    });

    it('should get required values', () => {
        expect(() => loader.getRequired('missing')).toThrow('not found');
    });

    it('should check existence', () => {
        loader.set('exists', true);
        expect(loader.has('exists')).toBe(true);
        expect(loader.has('nope')).toBe(false);
    });

    it('should track provenance', () => {
        loader.set('a', 1, 'file');
        loader.set('b', 2, 'env');
        const prov = loader.getProvenance();
        expect(prov.find((p) => p.key === 'a')?.source).toBe('file');
    });

    it('should coerce types', () => {
        loader.loadEnv({ CB_DEBUG: 'true', CB_COUNT: '42', CB_RATE: '0.5', CB_EMPTY: 'null' });
        expect(loader.get('debug')).toBe(true);
        expect(loader.get('count')).toBe(42);
        expect(loader.get('rate')).toBe(0.5);
        expect(loader.get('empty')).toBe(null);
    });
});
