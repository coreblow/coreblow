// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import { ErrorBoundary } from './error-boundary.js';
import { parseSemver, isAtLeast, detectRuntime, runtimeSatisfies, isSupportedNodeVersion } from './runtime-guard.js';
import { DeadLetterQueue } from './dead-letter-queue.js';

// ─── Error Boundary ──────────────────────────────────────────────

describe('Error Boundary — Phase 23', () => {
    let boundary: ErrorBoundary;

    beforeEach(() => {
        boundary = new ErrorBoundary();
    });

    it('classifies timeout errors', () => {
        const err = boundary.classify(new Error('connection timed out'));
        expect(err.class).toBe('timeout');
        expect(err.statusCode).toBe(504);
        expect(err.retryable).toBe(true);
    });

    it('classifies auth errors', () => {
        const err = boundary.classify(new Error('unauthorized access'));
        expect(err.class).toBe('auth');
        expect(err.statusCode).toBe(401);
        expect(err.retryable).toBe(false);
    });

    it('classifies rate-limit errors', () => {
        const err = boundary.classify(new Error('too many requests'));
        expect(err.class).toBe('rate-limit');
        expect(err.statusCode).toBe(429);
        expect(err.retryable).toBe(true);
    });

    it('classifies validation errors', () => {
        const err = boundary.classify(new Error('invalid payload'));
        expect(err.class).toBe('validation');
        expect(err.statusCode).toBe(400);
        expect(err.retryable).toBe(false);
    });

    it('classifies not-found errors', () => {
        const err = boundary.classify(new Error('user not found'));
        expect(err.class).toBe('not-found');
        expect(err.statusCode).toBe(404);
    });

    it('classifies upstream errors', () => {
        const err = boundary.classify(new Error('econnrefused'));
        expect(err.class).toBe('upstream');
        expect(err.statusCode).toBe(502);
    });

    it('classifies unknown errors as internal', () => {
        const err = boundary.classify(new Error('random boom'));
        expect(err.class).toBe('internal');
        expect(err.statusCode).toBe(500);
    });

    it('handles errors and triggers handlers', () => {
        let caught = false;
        boundary.on('validation', () => { caught = true; });

        boundary.handle({
            class: 'validation', code: 'V', message: 'M', statusCode: 400, retryable: false
        });

        expect(caught).toBe(true);
    });

    it('triggers fallback handler if no specific handler', () => {
        let caught = false;
        boundary.onFallback(() => { caught = true; });
        boundary.handle({
            class: 'internal', code: 'INT', message: 'M', statusCode: 500, retryable: false
        });
        expect(caught).toBe(true);
    });

    it('wrap catches and rethrows structured error', async () => {
        const fn = async () => { throw new Error('unauthorized'); };

        await expect(boundary.wrap(fn)).rejects.toMatchObject({
            class: 'auth',
            statusCode: 401
        });

        const counts = boundary.getErrorCounts();
        expect(counts['auth']).toBe(1);
    });

    it('wrap returns value on success', async () => {
        const val = await boundary.wrap(async () => 'OK');
        expect(val).toBe('OK');
    });

    it('formats http response', () => {
        const res = boundary.toHttpResponse({
            class: 'validation', code: 'ERR_V', message: 'bad input', statusCode: 400, retryable: false
        });
        expect(res.statusCode).toBe(400);
        expect(res.body.error.code).toBe('ERR_V');
    });

    it('tracks recent errors', () => {
        boundary.handle({ class: 'internal', code: 'I', message: 'M', statusCode: 500, retryable: false });
        boundary.handle({ class: 'timeout', code: 'T', message: 'M', statusCode: 504, retryable: true });
        const recent = boundary.getRecentErrors();
        expect(recent).toHaveLength(2);
    });

    it('logs error counts properly', () => {
        boundary.handle({ class: 'internal', code: 'I', message: 'M', statusCode: 500, retryable: false });
        boundary.handle({ class: 'internal', code: 'I', message: 'M', statusCode: 500, retryable: false });
        expect(boundary.getErrorCounts()['internal']).toBe(2);
    });
});

// ─── Runtime Guard ──────────────────────────────────────────────

describe('Runtime Guard — Phase 23', () => {
    it('parseSemver extracts correctly', () => {
        expect(parseSemver('22.14.0')).toEqual({ major: 22, minor: 14, patch: 0 });
        expect(parseSemver('18.0.0-beta')).toEqual({ major: 18, minor: 0, patch: 0 });
        expect(parseSemver(null)).toBeNull();
        expect(parseSemver('invalid')).toBeNull();
    });

    it('isAtLeast compares correctly', () => {
        const min = { major: 22, minor: 14, patch: 0 };
        expect(isAtLeast({ major: 23, minor: 0, patch: 0 }, min)).toBe(true);
        expect(isAtLeast({ major: 22, minor: 15, patch: 0 }, min)).toBe(true);
        expect(isAtLeast({ major: 22, minor: 14, patch: 0 }, min)).toBe(true);
        expect(isAtLeast({ major: 22, minor: 13, patch: 9 }, min)).toBe(false);
        expect(isAtLeast({ major: 20, minor: 0, patch: 0 }, min)).toBe(false);
        expect(isAtLeast(null, min)).toBe(false);
    });

    it('detects current runtime', () => {
        const details = detectRuntime();
        expect(details.kind).toBe('node');
        expect(details.version).toMatch(/^\d+\.\d+\.\d+/);
        expect(details.execPath).toBeDefined();
    });

    it('runtimeSatisfies evaluates details', () => {
        const passDetails = { kind: 'node', version: '23.0.0', execPath: '', pathEnv: '' };
        const failDetails = { kind: 'node', version: '18.0.0', execPath: '', pathEnv: '' };
        expect(runtimeSatisfies(passDetails as any)).toBe(true);
        expect(runtimeSatisfies(failDetails as any)).toBe(false);
        expect(runtimeSatisfies({ kind: 'unknown', version: '23.0.0' } as any)).toBe(false);
    });

    it('isSupportedNodeVersion evaluates quickly', () => {
        expect(isSupportedNodeVersion('22.14.0')).toBe(true);
        expect(isSupportedNodeVersion('14.0.0')).toBe(false);
    });
});

// ─── Dead Letter Queue ──────────────────────────────────────────

describe('Dead Letter Queue — Phase 23', () => {
    let dlq: DeadLetterQueue;

    beforeEach(() => {
        dlq = new DeadLetterQueue();
    });

    it('adds dead letter', () => {
        const dl = dlq.add('main-queue', { id: 1 }, 'failed boom', 3);
        expect(dl.id).toMatch(/^dl-/);
        expect(dl.originalQueue).toBe('main-queue');
        expect(dl.retried).toBe(false);
        expect(dlq.count()).toBe(1);
    });

    it('gets by queue', () => {
        dlq.add('q1', {}, 'err', 1);
        dlq.add('q1', {}, 'err', 1);
        dlq.add('q2', {}, 'err', 1);
        expect(dlq.getByQueue('q1')).toHaveLength(2);
        expect(dlq.getByQueue('q2')).toHaveLength(1);
    });

    it('marks retried', () => {
        const dl = dlq.add('q1', {}, 'err', 1);
        expect(dlq.markRetried(dl.id)).toBe(true);
        expect(dl.retried).toBe(true);
    });

    it('markRetried returns false for unknown', () => {
        expect(dlq.markRetried('unknown')).toBe(false);
    });

    it('gets unretried letters', () => {
        const dl1 = dlq.add('q1', {}, 'err', 1);
        dlq.add('q1', {}, 'err', 1);
        dlq.markRetried(dl1.id);

        const unretried = dlq.getUnretried();
        expect(unretried).toHaveLength(1);
    });

    it('purges older letters', async () => {
        dlq.add('q1', {}, 'err', 1);

        // Wait momentarily to ensure time difference
        await new Promise(r => setTimeout(r, 10));

        const purgedCount = dlq.purge(5); // purge things older than 5ms
        expect(purgedCount).toBe(1);
        expect(dlq.count()).toBe(0);
    });

    it('keeps newer letters during purge', async () => {
        const dl = dlq.add('q1', {}, 'err', 1);
        dl.failedAt = Date.now() + 10000; // future fail
        const purgedCount = dlq.purge(5);
        expect(purgedCount).toBe(0);
        expect(dlq.count()).toBe(1);
    });

    it('returns summary by queue', () => {
        const dl1 = dlq.add('q1', {}, 'err', 1);
        dlq.add('q1', {}, 'err', 1);
        dlq.add('q2', {}, 'err', 1);
        dlq.markRetried(dl1.id);

        const summary = dlq.summary();
        expect(summary.find(s => s.queue === 'q1')).toEqual({ queue: 'q1', count: 2, unretried: 1 });
        expect(summary.find(s => s.queue === 'q2')).toEqual({ queue: 'q2', count: 1, unretried: 1 });
    });
});
