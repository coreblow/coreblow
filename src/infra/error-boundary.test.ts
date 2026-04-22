/**
 * CoreBlow — Error Boundary Tests
 *
 * Tests for error classification, handler dispatch, wrap(),
 * error logging, counts, and HTTP response generation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ErrorBoundary } from './error-boundary.js';

describe('ErrorBoundary', () => {
    let boundary: ErrorBoundary;

    beforeEach(() => {
        boundary = new ErrorBoundary();
    });

    // === Classification ===

    describe('classify', () => {
        it.each([
            ['request timed out', 'timeout', 504, true],
            ['connection timed out', 'timeout', 504, true],
            ['unauthorized access', 'auth', 401, false],
            ['forbidden resource', 'auth', 401, false],
            ['rate limit exceeded', 'rate-limit', 429, true],
            ['too many requests', 'rate-limit', 429, true],
            ['invalid input field', 'validation', 400, false],
            ['validation failed', 'validation', 400, false],
            ['resource not found', 'not-found', 404, false],
            ['error 404 page', 'not-found', 404, false],
            ['ECONNREFUSED', 'upstream', 502, true],
            ['network error', 'upstream', 502, true],
            ['something broke badly', 'internal', 500, false],
        ] as const)('"%s" → class=%s status=%d retryable=%s', (msg, cls, status, retryable) => {
            const result = boundary.classify(new Error(msg));
            expect(result.class).toBe(cls);
            expect(result.statusCode).toBe(status);
            expect(result.retryable).toBe(retryable);
        });

        it('AbortError classified as timeout', () => {
            const err = new Error('aborted');
            err.name = 'AbortError';
            expect(boundary.classify(err).class).toBe('timeout');
        });

        it('preserves original error', () => {
            const err = new Error('test');
            expect(boundary.classify(err).originalError).toBe(err);
        });
    });

    // === Handler Registration ===

    describe('on + handle', () => {
        it('calls registered handler for error class', () => {
            let received: string | null = null;
            boundary.on('timeout', (err) => { received = err.class; });

            boundary.handle(boundary.classify(new Error('timed out')));
            expect(received).toBe('timeout');
        });

        it('does not call wrong handler', () => {
            let called = false;
            boundary.on('auth', () => { called = true; });
            boundary.handle(boundary.classify(new Error('timed out')));
            expect(called).toBe(false);
        });
    });

    describe('onFallback', () => {
        it('calls fallback for unhandled class', () => {
            let received: string | null = null;
            boundary.onFallback((err) => { received = err.class; });

            boundary.handle(boundary.classify(new Error('something unknown')));
            expect(received).toBe('internal');
        });
    });

    // === wrap ===

    describe('wrap', () => {
        it('returns result on success', async () => {
            const result = await boundary.wrap(async () => 42);
            expect(result).toBe(42);
        });

        it('classifies and rethrows on error', async () => {
            await expect(
                boundary.wrap(async () => { throw new Error('timed out'); })
            ).rejects.toMatchObject({ class: 'timeout' });
        });

        it('logs the error', async () => {
            await boundary.wrap(async () => { throw new Error('rate limit hit'); }).catch(() => {});
            const recent = boundary.getRecentErrors();
            expect(recent).toHaveLength(1);
            expect(recent[0]?.error.class).toBe('rate-limit');
        });
    });

    // === Error Log ===

    describe('getRecentErrors', () => {
        it('returns recent errors', () => {
            boundary.handle(boundary.classify(new Error('err1')));
            boundary.handle(boundary.classify(new Error('err2')));
            expect(boundary.getRecentErrors()).toHaveLength(2);
        });

        it('respects limit', () => {
            for (let i = 0; i < 10; i++) {
                boundary.handle(boundary.classify(new Error(`err${i}`)));
            }
            expect(boundary.getRecentErrors(3)).toHaveLength(3);
        });
    });

    describe('getErrorCounts', () => {
        it('counts errors by class', () => {
            boundary.handle(boundary.classify(new Error('timed out')));
            boundary.handle(boundary.classify(new Error('timed out again')));
            boundary.handle(boundary.classify(new Error('rate limit')));

            const counts = boundary.getErrorCounts();
            expect(counts.timeout).toBe(2);
            expect(counts['rate-limit']).toBe(1);
        });
    });

    // === HTTP Response ===

    describe('toHttpResponse', () => {
        it('builds HTTP error response', () => {
            const structured = boundary.classify(new Error('rate limit exceeded'));
            const response = boundary.toHttpResponse(structured);

            expect(response.statusCode).toBe(429);
            expect(response.body.error).toMatchObject({
                code: 'RATE_LIMITED',
                retryable: true,
            });
        });
    });
});
