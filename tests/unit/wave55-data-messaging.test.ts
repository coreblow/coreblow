import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DataPipeline } from '../../src/infra/data-pipeline.js';
import { DataValidator } from '../../src/infra/data-validator.js';
import { DataTransformer } from '../../src/infra/data-transformer.js';
import { MessageBroker } from '../../src/infra/message-broker.js';
import { TaskQueue } from '../../src/infra/task-queue.js';

describe('Wave 55: Data Processing & Messaging', () => {

    describe('DataPipeline (data-pipeline.ts)', () => {
        it('processes input sequentially through stages', async () => {
            const pipeline = DataPipeline.create<number>();
            pipeline
                .map('double', (x) => x * 2)
                .map('add10', (x) => x + 10);

            const result = await pipeline.execute(5);
            expect(result.success).toBe(true);
            expect(result.output).toBe(20);
            expect(result.stages).toHaveLength(2);
            expect(result.stages[0]?.name).toBe('double');
        });

        it('supports conditional stages (filter)', async () => {
             const pipeline = DataPipeline.create<number>();
             pipeline
                 .map('add1', (x) => x + 1)
                 .filter('onlyEvens', (x) => x % 2 === 0)
                 .map('double', (x) => x * 2);

             // Input 3 -> add1(4) -> passes filter -> double(8)
             const res1 = await pipeline.execute(3);
             expect(res1.output).toBe(8);
             expect(res1.stages[1]?.skipped).toBe(false);

             // Input 4 -> add1(5) -> fails filter (skipped) -> double(5) -> 10
             const res2 = await pipeline.execute(4);
             expect(res2.output).toBe(10);
             expect(res2.stages[1]?.skipped).toBe(true);
        });

        it('handles errors gracefully', async () => {
             const pipeline = DataPipeline.create<number>();
             const errorHandler = vi.fn();
             pipeline.onError(errorHandler);

             pipeline
                 .map('step1', (x) => x + 1)
                 .map('step2', () => { throw new Error('fail'); });

             const res = await pipeline.execute(1);
             expect(res.success).toBe(false);
             expect(res.error).toContain('Stage "step2" failed: fail');
             expect(errorHandler).toHaveBeenCalled();
        });
    });

    describe('DataValidator (data-validator.ts)', () => {
        let v: DataValidator;

        beforeEach(() => {
            v = new DataValidator();
        });

        it('validates required fields and types', () => {
            v.required('name', 'Name is required')
             .minLength('name', 3)
             .max('age', 100);

            const valid = v.validate({ name: 'John', age: 30 });
            expect(valid.valid).toBe(true);
            expect(valid.errors).toHaveLength(0);

            const invalid = v.validate({ name: 'Jo', age: 101 });
            expect(invalid.valid).toBe(false);
            expect(invalid.errors).toHaveLength(2);
        });

        it('validates patterns and custom rules', () => {
             v.pattern('email', /^[^@]+@[^@]+$/)
              .custom('count', (val) => Number(val) % 2 === 0);

             expect(v.validate({ email: 'a@b.com', count: 4 }).valid).toBe(true);
             expect(v.validate({ email: 'invalid', count: 3 }).valid).toBe(false);
        });

        it('validates many records', () => {
             v.required('name');
             const records = [{ name: 'a' }, {}, { name: 'b' }];

             const failed = v.validateMany(records);
             expect(failed).toHaveLength(1);
             expect(failed[0]?.index).toBe(1);
        });
    });

    describe('DataTransformer (data-transformer.ts)', () => {
        let t: DataTransformer;

        beforeEach(() => {
            t = new DataTransformer();
        });

        it('applies basic transformations in order', () => {
            t.rename('oldName', 'newName')
             .compute('total', (r) => Number(r.a || 0) + Number(r.b || 0))
             .pick(['newName', 'keepMe', 'total', 'status'])
             .default('status', 'active');

            const record = { oldName: 'John', keepMe: true, discardMe: false, a: 10, b: 5 };
            const result = t.transform(record);

            expect(result.newName).toBe('John');
            expect(result.keepMe).toBe(true);
            expect(result.discardMe).toBeUndefined();
            expect(result.total).toBe(15);
            expect(result.status).toBe('active');
        });

        it('can cast data types', () => {
             t.cast('strToNum', 'number')
              .cast('numToStr', 'string')
              .cast('truthyToBool', 'boolean');

             const result = t.transform({ strToNum: '123', numToStr: 456, truthyToBool: 1 });
             expect(result.strToNum).toBe(123);
             expect(result.numToStr).toBe('456');
             expect(result.truthyToBool).toBe(true);
        });
    });

    describe('MessageBroker (message-broker.ts)', () => {
        let broker: MessageBroker;

        beforeEach(() => {
            broker = new MessageBroker();
        });

        it('publishes and queues messages', () => {
            const msg1 = broker.publish('q1', { a: 1 }, 10);
            const msg2 = broker.publish('q1', { b: 2 }, 20); // Higher priority

            expect(msg1.id).toBeDefined();
            expect(broker.depth('q1')).toBe(2);
        });

        it('processes messages based on priority and routes to consumers', async () => {
             broker.publish('q1', 'low', 1);
             broker.publish('q1', 'high', 10);

             const received: unknown[] = [];
             broker.subscribe('q1', async (msg) => {
                 received.push(msg.payload);
                 return true;
             });

             await broker.processNext('q1');
             expect(received[0]).toBe('high'); // Processes high priority first

             await broker.processNext('q1');
             expect(received[1]).toBe('low');

             expect(broker.depth('q1')).toBe(0);
        });

        it('handles retries on failure', async () => {
             broker.publish('retry-queue', 'data', 0, 2); // max 2 attempts
             let attempts = 0;

             broker.subscribe('retry-queue', async () => {
                  attempts++;
                  return false; // Return false to indicate failure
             });

             const m1 = await broker.processNext('retry-queue');
             expect(m1?.status).toBe('pending'); // Will be retried

             const m2 = await broker.processNext('retry-queue');
             expect(m2?.status).toBe('failed'); // Max attempts reached

             expect(attempts).toBe(2);
        });
    });

    describe('TaskQueue (task-queue.ts)', () => {
        it('enqueues and processes tasks concurrently', async () => {
             const queue = new TaskQueue(2); // concurrency 2

             let active = 0;
             let maxActive = 0;
             const handler = async () => {
                  active++;
                  maxActive = Math.max(maxActive, active);
                  await new Promise(r => setImmediate(r));
                  active--;
                  return 'done';
             };

             queue.enqueue('t1', handler);
             queue.enqueue('t2', handler);
             queue.enqueue('t3', handler);

             await queue.process();

             expect(maxActive).toBeLessThanOrEqual(2);
             const stats = queue.getStats();
             expect(stats.completed).toBe(3);
             expect(stats.pending).toBe(0);
        });

        it('sorts tasks by priority', async () => {
             const queue = new TaskQueue(1);
             const order: string[] = [];

             queue.enqueue('low', async () => { order.push('low'); }, 0);
             queue.enqueue('high', async () => { order.push('high'); }, 10);

             await queue.process(); // high, since max concurrency 1 handles it sequentially
             await queue.process(); // low

             expect(order).toEqual(['high', 'low']);
        });

        it('moves failed tasks to dead letter queue', async () => {
             const queue = new TaskQueue(1);

             queue.enqueue('fail', async () => { throw new Error('bang'); }, 0, 1); // 1 retry total 2 attempts

             await queue.process(); // attempt 1
             await queue.process(); // attempt 2, moves to DLQ

             const stats = queue.getStats();
             expect(stats.failed).toBe(1);

             const dlq = queue.getDeadLetter();
             expect(dlq).toHaveLength(1);
             expect(dlq[0]?.error).toBe('bang');
        });
    });

});
