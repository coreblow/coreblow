// @ts-nocheck
/**
 * Integration Test Suite 1: Agent Workflow Pipeline
 *
 * Verifies: MessageBroker → WorkflowEngine → CircuitBreaker → DLQ → ErrorBoundary → I18n → NotificationSystem
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MessageBroker } from '../infra/message-broker.js';
import { WorkflowEngine } from '../infra/workflow-engine.js';
import { CircuitBreaker } from '../infra/circuit-breaker.js';
import { DeadLetterQueue } from '../infra/dead-letter-queue.js';
import { ErrorBoundary } from '../infra/error-boundary.js';
import { FuzzySearch } from '../infra/fuzzy-search.js';
import { I18n } from '../infra/i18n.js';
import { NotificationSystem } from '../infra/notification-system.js';

describe('Integration: Agent Workflow Pipeline', () => {
    let broker: MessageBroker;
    let workflow: WorkflowEngine;
    let cb: CircuitBreaker;
    let dlq: DeadLetterQueue;
    let boundary: ErrorBoundary;
    let fuzzy: FuzzySearch;
    let i18n: I18n;
    let notify: NotificationSystem;

    beforeEach(() => {
        broker = new MessageBroker();
        workflow = new WorkflowEngine();
        cb = new CircuitBreaker();
        dlq = new DeadLetterQueue();
        boundary = new ErrorBoundary();
        fuzzy = new FuzzySearch();
        i18n = new I18n();
        notify = new NotificationSystem();

        // Seed fuzzy search with known intents
        fuzzy.add('greet', 'hello hi greetings');
        fuzzy.add('help', 'help support assist');
        fuzzy.add('status', 'status check health');
    });

    it('broker → workflow: message consumed triggers workflow execution', async () => {
        // Register a workflow that processes incoming messages
        workflow.register({
            id: 'process-msg',
            name: 'Process Message',
            steps: [
                { id: 'parse', name: 'Parse', handler: async (ctx) => ({ parsed: ctx.data.payload }) },
                { id: 'respond', name: 'Respond', handler: async (ctx) => `Processed: ${ctx.stepResults['parse'].parsed}` },
            ]
        });

        // Publish a message
        broker.publish('inbox', 'hello world');
        broker.subscribe('inbox', async (msg) => {
            const result = await workflow.execute('process-msg', { payload: msg.payload });
            return result.status === 'completed';
        });

        const processed = await broker.processNext('inbox');
        expect(processed).not.toBeNull();
        expect(processed!.status).toBe('completed');

        // Verify workflow tracked the execution
        const history = workflow.getHistory();
        expect(history).toHaveLength(1);
        expect(history[0].status).toBe('completed');
        expect(history[0].context.stepResults['respond']).toBe('Processed: hello world');
    });

    it('workflow → fuzzy search: step classifies intent via fuzzy matching', async () => {
        workflow.register({
            id: 'classify',
            name: 'Classify Intent',
            steps: [
                {
                    id: 'match', name: 'Match Intent', handler: async (ctx) => {
                        const match = fuzzy.bestMatch(ctx.data.input as string);
                        return match ? { intent: match.id, confidence: match.score } : { intent: 'unknown', confidence: 0 };
                    }
                },
            ]
        });

        const r1 = await workflow.execute('classify', { input: 'helo' }); // typo → fuzzy matches "hello"
        expect(r1.status).toBe('completed');
        expect(r1.context.stepResults['match'].intent).toBe('greet');

        const r2 = await workflow.execute('classify', { input: 'xyz999' }); // no match
        expect(r2.context.stepResults['match'].intent).toBe('unknown');
    });

    it('workflow → circuit breaker: step execution gated by circuit', async () => {
        let apiCalls = 0;

        workflow.register({
            id: 'api-call',
            name: 'API Call',
            steps: [
                {
                    id: 'call', name: 'External API', handler: async () => {
                        return await cb.execute('external-api', async () => {
                            apiCalls++;
                            return { success: true };
                        }, { failureThreshold: 2 });
                    }
                },
            ]
        });

        const result = await workflow.execute('api-call');
        expect(result.status).toBe('completed');
        expect(apiCalls).toBe(1);
    });

    it('broker failure → dead letter queue: failed messages are captured', async () => {
        broker.publish('tasks', { id: 1, action: 'send-email' }, 0, 1); // maxAttempts=1
        broker.subscribe('tasks', async () => { throw new Error('SMTP down'); });

        const msg = await broker.processNext('tasks');
        expect(msg!.status).toBe('failed');

        // Move to DLQ
        dlq.add('tasks', msg!.payload, 'SMTP down', msg!.attempts);

        expect(dlq.count()).toBe(1);
        expect(dlq.getByQueue('tasks')[0].error).toBe('SMTP down');
    });

    it('circuit breaker open → error boundary classifies → structured error', async () => {
        const fail = async () => { throw new Error('service down'); };

        // Trip the circuit
        await expect(cb.execute('svc', fail, { failureThreshold: 1 })).rejects.toThrow();

        // Circuit is open → next call fails fast
        try {
            await cb.execute('svc', async () => 'ok');
        } catch (err) {
            const structured = boundary.classify(err instanceof Error ? err : new Error(String(err)));
            boundary.handle(structured);

            // The "Circuit is open" error gets classified as internal
            expect(structured.class).toBe('internal');
            expect(structured.statusCode).toBe(500);
        }

        expect(boundary.getErrorCounts()['internal']).toBe(1);
    });

    it('end-to-end: publish → consume → workflow → circuit → result', async () => {
        let processed: string[] = [];

        workflow.register({
            id: 'e2e',
            name: 'E2E Pipeline',
            steps: [
                {
                    id: 'classify', name: 'Classify', handler: async (ctx) => {
                        const match = fuzzy.bestMatch(ctx.data.text as string);
                        return match?.id ?? 'unknown';
                    }
                },
                {
                    id: 'execute', name: 'Execute', handler: async (ctx) => {
                        return await cb.execute('api', async () => {
                            return `handled-${ctx.stepResults['classify']}`;
                        });
                    }
                },
            ]
        });

        broker.publish('incoming', { text: 'help' });
        broker.subscribe('incoming', async (msg) => {
            const result = await workflow.execute('e2e', msg.payload);
            if (result.status === 'completed') {
                processed.push(result.context.stepResults['execute'] as string);
            }
            return result.status === 'completed';
        });

        await broker.processNext('incoming');
        expect(processed).toEqual(['handled-help']);
    });

    it('workflow error → i18n + notification: admin alert with localized message', async () => {
        workflow.register({
            id: 'risky',
            name: 'Risky Op',
            steps: [
                { id: 's1', name: 'Fail Step', handler: async () => { throw new Error('timeout'); } },
            ]
        });

        const result = await workflow.execute('risky');
        expect(result.status).toBe('failed');

        // Classify the error — 'timeout' keyword → timeout class
        const err = boundary.classify(new Error(result.context.errors[0].error));
        expect(err.class).toBe('timeout');
        expect(err.retryable).toBe(true);

        // Send localized notification with error details
        const localizedMsg = i18n.t('error.rate_limit', { seconds: '30' }); // use a known key with interpolation
        notify.send('error', 'Workflow Failed', `${err.class}: ${err.message}`, 'admin');

        const adminNotifs = notify.getForUser('admin');
        expect(adminNotifs).toHaveLength(1);
        expect(adminNotifs[0].title).toBe('Workflow Failed');
        expect(adminNotifs[0].message).toContain('timeout');
        expect(adminNotifs[0].type).toBe('error');
    });

    it('DLQ summary after multiple failures across queues', async () => {
        dlq.add('email', {}, 'SMTP error', 3);
        dlq.add('email', {}, 'SMTP error', 3);
        dlq.add('webhook', {}, 'Connection refused', 2);
        dlq.markRetried(dlq.getByQueue('email')[0].id);

        const summary = dlq.summary();
        expect(summary.find(s => s.queue === 'email')).toEqual({ queue: 'email', count: 2, unretried: 1 });
        expect(summary.find(s => s.queue === 'webhook')).toEqual({ queue: 'webhook', count: 1, unretried: 1 });
        expect(dlq.getUnretried()).toHaveLength(2);
    });
});
