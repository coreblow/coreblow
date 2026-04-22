/**
 * CoreBlow — ETL Pipeline Tests
 *
 * Tests for pipeline creation, multi-stage execution,
 * error handling, history, and listing.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ETLPipeline } from './etl-pipeline.js';

describe('ETLPipeline', () => {
    let etl: ETLPipeline;

    beforeEach(() => {
        etl = new ETLPipeline();
    });

    describe('create', () => {
        it('creates a pipeline and returns an ID', () => {
            const id = etl.create('test', [{ name: 'extract', handler: async (d) => d }]);
            expect(id).toMatch(/^etl-/);
        });

        it('increments IDs', () => {
            const a = etl.create('a', []);
            const b = etl.create('b', []);
            expect(a).not.toBe(b);
        });
    });

    describe('run', () => {
        it('runs a single-stage pipeline', async () => {
            const id = etl.create('double', [
                { name: 'transform', handler: async (data) => data.map((d: any) => d * 2) },
            ]);
            const result = await etl.run(id, [1, 2, 3]);
            expect(result.status).toBe('completed');
            expect(result.inputCount).toBe(3);
            expect(result.outputCount).toBe(3);
        });

        it('chains multiple stages', async () => {
            const id = etl.create('chain', [
                { name: 'extract', handler: async (data) => data },
                { name: 'filter', handler: async (data) => data.filter((d: any) => d > 2) },
                { name: 'transform', handler: async (data) => data.map((d: any) => d * 10) },
            ]);
            const result = await etl.run(id, [1, 2, 3, 4, 5]);
            expect(result.status).toBe('completed');
            expect(result.stages).toHaveLength(3);
            expect(result.outputCount).toBe(3); // 3, 4, 5 pass filter
        });

        it('tracks per-stage metrics', async () => {
            const id = etl.create('metrics', [
                { name: 'stage-a', handler: async (d) => d },
                { name: 'stage-b', handler: async (d) => d.slice(0, 1) },
            ]);
            const result = await etl.run(id, [1, 2, 3]);
            expect(result.stages[0]?.name).toBe('stage-a');
            expect(result.stages[0]?.inputCount).toBe(3);
            expect(result.stages[1]?.name).toBe('stage-b');
            expect(result.stages[1]?.outputCount).toBe(1);
        });

        it('handles stage errors', async () => {
            const id = etl.create('broken', [
                { name: 'good', handler: async (d) => d },
                { name: 'bad', handler: async () => { throw new Error('stage failed'); } },
                { name: 'never', handler: async (d) => d },
            ]);
            const result = await etl.run(id, [1, 2]);
            expect(result.status).toBe('failed');
            expect(result.error).toBe('stage failed');
            expect(result.stages).toHaveLength(1); // only 'good' completed
        });

        it('returns failure for unknown pipeline', async () => {
            const result = await etl.run('nonexistent', [1]);
            expect(result.status).toBe('failed');
            expect(result.error).toContain('not found');
        });

        it('tracks totalDurationMs', async () => {
            const id = etl.create('timed', [
                { name: 'slow', handler: async (d) => { await new Promise(r => setTimeout(r, 10)); return d; } },
            ]);
            const result = await etl.run(id, [1]);
            expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
        });
    });

    describe('getHistory', () => {
        it('records run history', async () => {
            const id = etl.create('hist', [{ name: 's', handler: async (d) => d }]);
            await etl.run(id, [1]);
            await etl.run(id, [2, 3]);
            const history = etl.getHistory();
            expect(history).toHaveLength(2);
        });

        it('respects limit', async () => {
            const id = etl.create('h', [{ name: 's', handler: async (d) => d }]);
            for (let i = 0; i < 5; i++) await etl.run(id, [i]);
            expect(etl.getHistory(2)).toHaveLength(2);
        });
    });

    describe('list + count', () => {
        it('lists pipelines with stage counts', () => {
            etl.create('a', [{ name: 's1', handler: async (d) => d }]);
            etl.create('b', [{ name: 's1', handler: async (d) => d }, { name: 's2', handler: async (d) => d }]);
            const list = etl.list();
            expect(list).toHaveLength(2);
            expect(list.find(p => p.name === 'b')?.stages).toBe(2);
        });

        it('count returns pipeline count', () => {
            etl.create('x', []);
            expect(etl.count()).toBe(1);
        });
    });
});
