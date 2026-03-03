import { describe, it, expect, beforeEach } from 'vitest';
import { WorkflowEngine, type WorkflowStep, type WorkflowDefinition, type WorkflowContext } from './workflow-engine.js';

function makeStep(overrides: Partial<WorkflowStep> = {}): WorkflowStep {
    return {
        id: overrides.id ?? 'step-1',
        name: overrides.name ?? 'Test Step',
        handler: overrides.handler ?? (async () => 'done'),
        condition: overrides.condition,
        onError: overrides.onError,
        retries: overrides.retries,
        timeoutMs: overrides.timeoutMs,
    };
}

describe('WorkflowEngine', () => {
    let engine: WorkflowEngine;

    beforeEach(() => {
        engine = new WorkflowEngine();
    });

    // === Registration ===

    describe('register & list', () => {
        it('registers a workflow and lists it', () => {
            engine.register({
                id: 'wf-1', name: 'Test Flow',
                steps: [makeStep({ id: 's1' }), makeStep({ id: 's2' })],
            });

            const list = engine.list();
            expect(list).toHaveLength(1);
            expect(list[0]).toEqual({ id: 'wf-1', name: 'Test Flow', stepCount: 2 });
        });
    });

    // === Sequential Execution ===

    describe('execute (sequential)', () => {
        it('runs all steps in order and returns completed', async () => {
            const order: string[] = [];
            engine.register({
                id: 'seq', name: 'Sequential',
                steps: [
                    makeStep({ id: 'a', handler: async () => { order.push('a'); return 1; } }),
                    makeStep({ id: 'b', handler: async () => { order.push('b'); return 2; } }),
                    makeStep({ id: 'c', handler: async () => { order.push('c'); return 3; } }),
                ],
            });

            const result = await engine.execute('seq');
            expect(result.status).toBe('completed');
            expect(result.steps).toHaveLength(3);
            expect(order).toEqual(['a', 'b', 'c']);
            expect(result.steps.every((s) => s.status === 'success')).toBe(true);
        });

        it('passes step results through context', async () => {
            engine.register({
                id: 'chain', name: 'Chain',
                steps: [
                    makeStep({ id: 'first', handler: async () => 42 }),
                    makeStep({ id: 'second', handler: async (ctx) => {
                        return `got ${ctx.results['first']}`;
                    }}),
                ],
            });

            const result = await engine.execute('chain');
            expect(result.status).toBe('completed');
            expect(result.context.results['first']).toBe(42);
        });

        it('passes initial metadata to context', async () => {
            engine.register({
                id: 'meta', name: 'Meta',
                steps: [makeStep({ id: 's1', handler: async (ctx) => ctx.metadata['key'] })],
            });

            const result = await engine.execute('meta', { key: 'value' });
            expect(result.context.results['s1']).toBe('value');
        });
    });

    // === Conditional Steps ===

    describe('conditional steps', () => {
        it('skips step when condition returns false', async () => {
            engine.register({
                id: 'cond', name: 'Conditional',
                steps: [
                    makeStep({ id: 'skip-me', condition: () => false, handler: async () => 'should not run' }),
                    makeStep({ id: 'run-me', handler: async () => 'ran' }),
                ],
            });

            const result = await engine.execute('cond');
            expect(result.steps[0]!.status).toBe('skipped');
            expect(result.steps[1]!.status).toBe('success');
            expect(result.status).toBe('completed');
        });

        it('runs step when condition returns true', async () => {
            engine.register({
                id: 'cond-true', name: 'Cond True',
                steps: [makeStep({ id: 's1', condition: () => true, handler: async () => 'yes' })],
            });

            const result = await engine.execute('cond-true');
            expect(result.steps[0]!.status).toBe('success');
        });
    });

    // === Error Handling ===

    describe('error handling', () => {
        it('stops on first error with onError=fail (default)', async () => {
            engine.register({
                id: 'fail-fast', name: 'FailFast',
                steps: [
                    makeStep({ id: 'ok', handler: async () => 'fine' }),
                    makeStep({ id: 'boom', handler: async () => { throw new Error('exploded'); } }),
                    makeStep({ id: 'never', handler: async () => 'unreachable' }),
                ],
            });

            const result = await engine.execute('fail-fast');
            expect(result.status).toBe('partial');
            expect(result.steps).toHaveLength(2);
            expect(result.steps[1]!.status).toBe('error');
            expect(result.steps[1]!.error).toBe('exploded');
        });

        it('continues past error with onError=skip', async () => {
            engine.register({
                id: 'skip-err', name: 'SkipError',
                steps: [
                    makeStep({ id: 'fail', onError: 'skip', handler: async () => { throw new Error('oops'); } }),
                    makeStep({ id: 'after', handler: async () => 'continued' }),
                ],
            });

            const result = await engine.execute('skip-err');
            expect(result.steps[0]!.status).toBe('skipped');
            expect(result.steps[1]!.status).toBe('success');
            expect(result.status).toBe('completed');
        });

        it('retries with onError=retry', async () => {
            let attempts = 0;
            engine.register({
                id: 'retry-wf', name: 'Retry',
                steps: [makeStep({
                    id: 'flaky',
                    onError: 'retry',
                    retries: 2,
                    handler: async () => {
                        attempts++;
                        if (attempts < 3) throw new Error(`attempt ${attempts}`);
                        return 'finally';
                    },
                })],
            });

            const result = await engine.execute('retry-wf');
            expect(result.status).toBe('completed');
            expect(attempts).toBe(3);
        });
    });

    // === Unknown Workflow ===

    describe('unknown workflow', () => {
        it('throws for non-existent workflow', async () => {
            await expect(engine.execute('nope')).rejects.toThrow('not found');
        });
    });

    // === History ===

    describe('getHistory', () => {
        it('records execution results', async () => {
            engine.register({ id: 'h1', name: 'H1', steps: [makeStep()] });
            await engine.execute('h1');
            await engine.execute('h1');

            const history = engine.getHistory();
            expect(history).toHaveLength(2);
            expect(history[0]!.workflowId).toBe('h1');
        });

        it('respects limit parameter', async () => {
            engine.register({ id: 'h2', name: 'H2', steps: [makeStep()] });
            for (let i = 0; i < 5; i++) await engine.execute('h2');

            expect(engine.getHistory(2)).toHaveLength(2);
        });
    });
});
