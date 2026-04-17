/**
 * CoreBlow Phase 35 — Data Processing & ETL Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { DataTransformer } from '../../src/infra/data-transformer.js';
import { ETLPipeline } from '../../src/infra/etl-pipeline.js';
import { DataValidator } from '../../src/infra/data-validator.js';
import { FormatConverter } from '../../src/infra/format-converter.js';
import { DataEnricher } from '../../src/infra/data-enricher.js';

// ================================================================
describe('DataTransformer', () => {
    it('should rename fields', () => {
        const t = new DataTransformer().rename('name', 'fullName');
        expect(t.transform({ name: 'Alice' })).toEqual({ fullName: 'Alice' });
    });

    it('should pick fields', () => {
        const t = new DataTransformer().pick(['a', 'b']);
        expect(t.transform({ a: 1, b: 2, c: 3 })).toEqual({ a: 1, b: 2 });
    });

    it('should omit fields', () => {
        const t = new DataTransformer().omit(['secret']);
        expect(t.transform({ name: 'A', secret: '123' })).toEqual({ name: 'A' });
    });

    it('should compute fields', () => {
        const t = new DataTransformer().compute('upper', (r) => String(r.name).toUpperCase());
        expect(t.transform({ name: 'alice' }).upper).toBe('ALICE');
    });

    it('should set defaults', () => {
        const t = new DataTransformer().default('role', 'user');
        expect(t.transform({}).role).toBe('user');
    });

    it('should cast types', () => {
        const t = new DataTransformer().cast('age', 'number');
        expect(t.transform({ age: '25' }).age).toBe(25);
    });

    it('should chain transforms', () => {
        const t = new DataTransformer().rename('n', 'name').default('role', 'user').pick(['name', 'role']);
        expect(t.transform({ n: 'Bob', extra: true })).toEqual({ name: 'Bob', role: 'user' });
    });

    it('should transform many', () => {
        const t = new DataTransformer().pick(['id']);
        expect(t.transformMany([{ id: 1, x: 'a' }, { id: 2, x: 'b' }])).toEqual([{ id: 1 }, { id: 2 }]);
    });
});

// ================================================================
describe('ETLPipeline', () => {
    let etl: ETLPipeline;
    beforeEach(() => { etl = new ETLPipeline(); });

    it('should create pipelines', () => {
        etl.create('test', []);
        expect(etl.count()).toBe(1);
    });

    it('should run pipelines', async () => {
        const id = etl.create('double', [{ name: 'double', handler: async (data) => data.map((d) => (d as number) * 2) }]);
        const result = await etl.run(id, [1, 2, 3]);
        expect(result.status).toBe('completed');
    });

    it('should chain stages', async () => {
        const id = etl.create('chain', [
            { name: 'filter', handler: async (data) => data.filter((d) => (d as number) > 2) },
            { name: 'map', handler: async (data) => data.map((d) => (d as number) * 10) },
        ]);
        const result = await etl.run(id, [1, 2, 3, 4]);
        expect(result.outputCount).toBe(2);
    });

    it('should handle errors', async () => {
        const id = etl.create('fail', [{ name: 'boom', handler: async () => { throw new Error('fail'); } }]);
        const result = await etl.run(id, [1]);
        expect(result.status).toBe('failed');
    });

    it('should track history', async () => {
        const id = etl.create('t', [{ name: 's', handler: async (d) => d }]);
        await etl.run(id, [1]);
        expect(etl.getHistory()).toHaveLength(1);
    });
});

// ================================================================
describe('DataValidator', () => {
    it('should validate required', () => {
        const v = new DataValidator().required('name');
        expect(v.validate({ name: 'Alice' }).valid).toBe(true);
        expect(v.validate({}).valid).toBe(false);
    });

    it('should validate min length', () => {
        const v = new DataValidator().minLength('name', 3);
        expect(v.validate({ name: 'AB' }).valid).toBe(false);
    });

    it('should validate max', () => {
        const v = new DataValidator().max('age', 120);
        expect(v.validate({ age: 150 }).valid).toBe(false);
    });

    it('should validate pattern', () => {
        const v = new DataValidator().pattern('email', /^.+@.+\..+$/);
        expect(v.validate({ email: 'bad' }).valid).toBe(false);
        expect(v.validate({ email: 'a@b.c' }).valid).toBe(true);
    });

    it('should validate custom', () => {
        const v = new DataValidator().custom('val', (v) => v === 42);
        expect(v.validate({ val: 42 }).valid).toBe(true);
    });

    it('should validate many', () => {
        const v = new DataValidator().required('id');
        const invalid = v.validateMany([{ id: 1 }, {}, { id: 3 }]);
        expect(invalid).toHaveLength(1);
        expect(invalid[0]?.index).toBe(1);
    });
});

// ================================================================
describe('FormatConverter', () => {
    const converter = new FormatConverter();

    it('should convert JSON to CSV', () => {
        const csv = converter.jsonToCsv([{ name: 'Alice', age: 25 }, { name: 'Bob', age: 30 }]);
        expect(csv).toContain('name,age');
        expect(csv).toContain('Alice,25');
    });

    it('should convert CSV to JSON', () => {
        const json = converter.csvToJson('name,age\nAlice,25\nBob,30');
        expect(json).toHaveLength(2);
        expect(json[0]?.name).toBe('Alice');
    });

    it('should flatten objects', () => {
        const flat = converter.flatten({ a: { b: { c: 1 } } });
        expect(flat['a.b.c']).toBe(1);
    });

    it('should convert JSON to key-value', () => {
        const kv = converter.jsonToKeyValue({ host: 'localhost', port: 3000 });
        expect(kv).toHaveLength(2);
    });

    it('should handle CSV with quotes', () => {
        const csv = converter.jsonToCsv([{ name: 'Alice, Bob', note: 'ok' }]);
        expect(csv).toContain('"Alice, Bob"');
    });
});

// ================================================================
describe('DataEnricher', () => {
    let enricher: DataEnricher;
    beforeEach(() => {
        enricher = new DataEnricher();
        enricher.addSource('users', 'userId', [
            { userId: 'u1', name: 'Alice', role: 'admin' },
            { userId: 'u2', name: 'Bob', role: 'user' },
        ]);
    });

    it('should enrich with lookup', () => {
        const result = enricher.enrich({ userId: 'u1', action: 'login' });
        expect(result.name).toBe('Alice');
    });

    it('should handle missing lookups', () => {
        const result = enricher.enrich({ userId: 'u999', action: 'x' });
        expect(result.name).toBeUndefined();
    });

    it('should add derived fields', () => {
        enricher.addDerivedField('label', (r) => `${r.name}-${r.role}`);
        const result = enricher.enrich({ userId: 'u1' });
        expect(result.label).toBe('Alice-admin');
    });

    it('should enrich many', () => {
        const results = enricher.enrichMany([{ userId: 'u1' }, { userId: 'u2' }]);
        expect(results[1]?.name).toBe('Bob');
    });

    it('should track stats', () => {
        enricher.enrich({ userId: 'u1' });
        enricher.enrich({ userId: 'unknown' });
        const stats = enricher.getStats();
        expect(stats.lookupHits).toBe(1);
        expect(stats.lookupMisses).toBe(1);
    });
});
