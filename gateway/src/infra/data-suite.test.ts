// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import { DataEnricher } from './data-enricher.js';
import { DataTransformer } from './data-transformer.js';
import { DataPipeline } from './data-pipeline.js';

// ─── Data Enricher ─────────────────────────────────────────────

describe('Data Enricher — Phase 21', () => {
    let enricher: DataEnricher;

    beforeEach(() => {
        enricher = new DataEnricher();
        enricher.addSource('users', 'userId', [
            { userId: 'u1', name: 'Alice', role: 'admin' },
            { userId: 'u2', name: 'Bob', role: 'user' },
        ]);
        enricher.addSource('departments', 'deptId', [
            { deptId: 'd1', deptName: 'Engineering' },
        ]);
        enricher.addDerivedField('fullName', (r) => `${r.name ?? ''} (ID: ${r.userId ?? ''})`);
    });

    it('enriches from single lookup source', () => {
        const record = { id: 1, userId: 'u1' };
        const enriched = enricher.enrich(record, ['users']);
        expect(enriched.name).toBe('Alice');
        expect(enriched.role).toBe('admin');
        expect(enriched.id).toBe(1);
    });

    it('enriches from multiple lookup sources automatically', () => {
        const record = { id: 1, userId: 'u2', deptId: 'd1' };
        const enriched = enricher.enrich(record);
        expect(enriched.name).toBe('Bob');
        expect(enriched.deptName).toBe('Engineering');
    });

    it('handles lookup misses gracefully', () => {
        const record = { id: 1, userId: 'unknown' };
        const enriched = enricher.enrich(record, ['users']);
        expect(enriched.name).toBeUndefined(); // lookup failed
        const stats = enricher.getStats();
        expect(stats.lookupMisses).toBeGreaterThan(0);
    });

    it('computes derived fields', () => {
        const record = { id: 1, userId: 'u1' };
        const enriched = enricher.enrich(record);
        expect(enriched.fullName).toBe('Alice (ID: u1)');
    });

    it('enrichMany processes array', () => {
        const records = [{ userId: 'u1' }, { userId: 'u2' }];
        const enriched = enricher.enrichMany(records);
        expect(enriched).toHaveLength(2);
        expect(enriched[0].name).toBe('Alice');
        expect(enriched[1].name).toBe('Bob');
    });

    it('list and count sources', () => {
        expect(enricher.count()).toBe(2);
        const list = enricher.list();
        expect(list.find(s => s.name === 'users')!.size).toBe(2);
    });

    it('ignores empty lookup keys when adding source', () => {
        const temp = new DataEnricher();
        temp.addSource('test', 'id', [{ id: '1' }, {}]); // 2nd missing 'id'
        expect(temp.list()[0].size).toBe(1);
    });
});

// ─── Data Transformer ──────────────────────────────────────────

describe('Data Transformer — Phase 21', () => {
    let transformer: DataTransformer;

    beforeEach(() => {
        transformer = new DataTransformer();
    });

    it('applies rename', () => {
        transformer.rename('oldName', 'newName');
        const res = transformer.transform({ oldName: 'val', other: 1 });
        expect(res.newName).toBe('val');
        expect(res.oldName).toBeUndefined();
        expect(res.other).toBe(1);
    });

    it('applies pick', () => {
        transformer.pick(['a', 'c']);
        const res = transformer.transform({ a: 1, b: 2, c: 3 });
        expect(res).toEqual({ a: 1, c: 3 });
    });

    it('applies omit', () => {
        transformer.omit(['password', 'secret']);
        const res = transformer.transform({ id: 1, password: 'pw', secret: 'ss' });
        expect(res).toEqual({ id: 1 });
    });

    it('applies compute', () => {
        transformer.compute('total', (r) => (r.qty as number) * (r.price as number));
        const res = transformer.transform({ qty: 2, price: 10 });
        expect(res.total).toBe(20);
    });

    it('applies default', () => {
        transformer.default('status', 'active');
        expect(transformer.transform({ id: 1 }).status).toBe('active');
        expect(transformer.transform({ id: 1, status: 'inactive' }).status).toBe('inactive');
    });

    it('applies type cast', () => {
        transformer.cast('count', 'number').cast('flag', 'boolean').cast('id', 'string');
        const res = transformer.transform({ count: '5', flag: 'true', id: 123 });
        expect(res.count).toBe(5);
        expect(res.flag).toBe(true);
        expect(res.id).toBe('123');
    });

    it('chains multiple transforms', () => {
        transformer
            .pick(['user_id', 'age_str'])
            .rename('user_id', 'id')
            .cast('age_str', 'number')
            .rename('age_str', 'age');
            
        const res = transformer.transform({ user_id: 'u1', age_str: '25', extra: 'x' });
        expect(res.id).toBe('u1');
        expect(res.age).toBe(25);
        expect(res.extra).toBeUndefined();
    });

    it('transformMany processes array', () => {
        transformer.default('x', 1);
        const res = transformer.transformMany([{}, { x: 2 }]);
        expect(res[0].x).toBe(1);
        expect(res[1].x).toBe(2);
    });

    it('count and reset', () => {
        transformer.rename('a', 'b').omit(['c']);
        expect(transformer.count()).toBe(2);
        transformer.reset();
        expect(transformer.count()).toBe(0);
    });
});

// ─── Data Pipeline ─────────────────────────────────────────────

describe('Data Pipeline — Phase 21', () => {
    it('executes simple mapping stages', async () => {
        const pipeline = DataPipeline.create<number>()
            .map('double', (x) => x * 2)
            .map('add1', (x) => x + 1);

        const res = await pipeline.execute(5);
        expect(res.success).toBe(true);
        expect(res.output).toBe(11); // 5 * 2 + 1
        expect(res.stages).toHaveLength(2);
    });

    it('supports async transforms', async () => {
        const pipeline = DataPipeline.create<string>()
            .map('asyncTrim', async (x) => x.trim());

        const res = await pipeline.execute('  hello  ');
        expect(res.output).toBe('hello');
    });

    it('skips stage if condition fails', async () => {
        const pipeline = DataPipeline.create<number>()
            .pipe({
                name: 'incrementOnlyIfEven',
                transform: (x) => x + 1,
                condition: (x) => x % 2 === 0
            });

        let res = await pipeline.execute(2);
        expect(res.output).toBe(3);
        expect(res.stages[0].skipped).toBe(false);

        res = await pipeline.execute(3);
        expect(res.output).toBe(3); // Unchanged
        expect(res.stages[0].skipped).toBe(true);
    });

    it('filter stage skips itself when condition fails', async () => {
        const pipeline = DataPipeline.create<number>()
            .filter('isPos', (x) => x > 0)
            .map('double', (x) => x * 2);

        const res1 = await pipeline.execute(5);
        expect(res1.output).toBe(10); 
        expect(res1.stages[0].skipped).toBe(false);

        const res2 = await pipeline.execute(-5);
        expect(res2.output).toBe(-10); // 'double' still runs individually
        expect(res2.stages[0].skipped).toBe(true); // 'isPos' was skipped
    });

    it('halts and returns error on exception', async () => {
        let errHandled = false;
        const pipeline = DataPipeline.create<number>()
            .onError(() => { errHandled = true; })
            .map('fail', () => { throw new Error('boom'); })
            .map('never', (x) => x + 1);

        const res = await pipeline.execute(1);
        expect(res.success).toBe(false);
        expect(res.error).toContain('Stage "fail" failed: boom');
        expect(res.stages).toHaveLength(0); // failing stage not pushed to stages array
        expect(errHandled).toBe(true);
    });

    it('history and stage names', async () => {
        const p = DataPipeline.create<number>().map('s1', (x) => x);
        await p.execute(1);
        expect(p.getStageNames()).toEqual(['s1']);
        expect(p.getHistory()).toHaveLength(1);
    });
});
