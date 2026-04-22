/**
 * CoreBlow — Failover Error Classification Tests (Extended)
 *
 * Tests for FailoverError construction, reason classification from
 * messages/status codes/symbolic codes, coercion, timeout detection,
 * and cause walking.
 */

import { describe, it, expect } from 'vitest';
import {
    FailoverError,
    isFailoverError,
    resolveFailoverStatus,
    isTimeoutError,
    resolveFailoverReasonFromError,
    describeFailoverError,
    coerceToFailoverError,
} from './failover-error.js';

describe('FailoverError construction', () => {
    it('stores reason, provider, model, status, code', () => {
        const err = new FailoverError('rate limited', {
            reason: 'rate_limit', provider: 'openai', model: 'gpt-4o',
            status: 429, code: 'rate_limit_exceeded',
        });
        expect(err.name).toBe('FailoverError');
        expect(err.reason).toBe('rate_limit');
        expect(err.provider).toBe('openai');
        expect(err.model).toBe('gpt-4o');
        expect(err.status).toBe(429);
        expect(err.code).toBe('rate_limit_exceeded');
    });

    it('is instanceof Error', () => {
        expect(new FailoverError('x', { reason: 'unknown' })).toBeInstanceOf(Error);
    });

    it('attaches cause', () => {
        const cause = new Error('original');
        const err = new FailoverError('wrapped', { reason: 'auth', cause });
        expect(err.cause).toBe(cause);
    });
});

describe('isFailoverError', () => {
    it('true for FailoverError', () => {
        expect(isFailoverError(new FailoverError('x', { reason: 'auth' }))).toBe(true);
    });
    it('false for regular Error', () => expect(isFailoverError(new Error('x'))).toBe(false));
    it('false for null/undefined', () => {
        expect(isFailoverError(null)).toBe(false);
        expect(isFailoverError(undefined)).toBe(false);
    });
});

describe('resolveFailoverStatus', () => {
    const cases: Array<[string, number | undefined]> = [
        ['billing', 402], ['rate_limit', 429], ['overloaded', 503],
        ['auth', 401], ['auth_permanent', 403], ['timeout', 408],
        ['format', 400], ['model_not_found', 404], ['session_expired', 410],
        ['unknown', undefined],
    ];
    it.each(cases)('maps %s → %s', (reason, expected) => {
        expect(resolveFailoverStatus(reason as any)).toBe(expected);
    });
});

describe('resolveFailoverReasonFromError — message classification', () => {
    const messageTests: Array<[string, string]> = [
        // rate_limit
        ['Rate limit exceeded', 'rate_limit'],
        ['too many requests', 'rate_limit'],
        ['exceeded your current quota', 'rate_limit'],
        ['resource_exhausted', 'rate_limit'],
        // auth
        ['Unauthorized', 'auth'],
        ['access denied', 'auth'],
        ['invalid token', 'auth'],
        // auth_permanent
        ['API key revoked', 'auth_permanent'],
        ['invalid_api_key', 'auth_permanent'],
        ['permission_error', 'auth_permanent'],
        // timeout
        ['request timed out', 'timeout'],
        ['connection error', 'timeout'],
        ['fetch failed', 'timeout'],
        ['socket hang up', 'timeout'],
        // overloaded
        ['overloaded_error', 'overloaded'],
        // model_not_found
        ['model not found', 'model_not_found'],
        ['unknown model', 'model_not_found'],
        // billing
        ['insufficient credits', 'billing'],
        ['payment required', 'billing'],
        // session_expired
        ['session not found', 'session_expired'],
        ['conversation expired', 'session_expired'],
    ];

    it.each(messageTests)('"%s" → %s', (msg, expectedReason) => {
        expect(resolveFailoverReasonFromError(new Error(msg))).toBe(expectedReason);
    });
});

describe('resolveFailoverReasonFromError — HTTP status', () => {
    it.each([
        [429, 'rate_limit'],
        [401, 'auth'],
        [403, 'auth'],
        [402, 'billing'],
        [503, 'timeout'],
        [500, 'timeout'],
        [502, 'timeout'],
        [504, 'timeout'],
    ] as const)('status %d → %s', (status, expected) => {
        const err = Object.assign(new Error(''), { status });
        expect(resolveFailoverReasonFromError(err)).toBe(expected);
    });
});

describe('resolveFailoverReasonFromError — symbolic codes', () => {
    it.each([
        ['RESOURCE_EXHAUSTED', 'rate_limit'],
        ['RATE_LIMIT', 'rate_limit'],
        ['TOO_MANY_REQUESTS', 'rate_limit'],
        ['ECONNRESET', 'timeout'],
        ['ETIMEDOUT', 'timeout'],
        ['ECONNREFUSED', 'timeout'],
    ] as const)('code %s → %s', (code, expected) => {
        const err = Object.assign(new Error(''), { code });
        expect(resolveFailoverReasonFromError(err)).toBe(expected);
    });
});

describe('resolveFailoverReasonFromError — cause walking', () => {
    it('walks into nested cause', () => {
        const inner = Object.assign(new Error('rate limit'), { status: 429 });
        const outer = new Error('wrapper', { cause: inner });
        expect(resolveFailoverReasonFromError(outer)).toBe('rate_limit');
    });

    it('returns null for unclassifiable error', () => {
        expect(resolveFailoverReasonFromError(new Error(''))).toBeNull();
    });
});

describe('isTimeoutError', () => {
    it('detects by name', () => {
        const err = new Error('x');
        err.name = 'TimeoutError';
        expect(isTimeoutError(err)).toBe(true);
    });

    it('detects by message', () => {
        expect(isTimeoutError(new Error('request timed out'))).toBe(true);
        expect(isTimeoutError(new Error('deadline exceeded'))).toBe(true);
    });

    it('detects AbortError with timeout cause', () => {
        const cause = new Error('timed out');
        cause.name = 'TimeoutError';
        const err = new Error('request was aborted');
        err.name = 'AbortError';
        Object.assign(err, { cause });
        expect(isTimeoutError(err)).toBe(true);
    });

    it('returns false for normal errors', () => {
        expect(isTimeoutError(new Error('normal'))).toBe(false);
        expect(isTimeoutError(null)).toBe(false);
    });
});

describe('coerceToFailoverError', () => {
    it('passes through FailoverError', () => {
        const err = new FailoverError('x', { reason: 'auth' });
        expect(coerceToFailoverError(err)).toBe(err);
    });

    it('coerces classifiable error with context', () => {
        const err = Object.assign(new Error('rate limit'), { status: 429 });
        const coerced = coerceToFailoverError(err, { provider: 'openai', model: 'gpt-4o' });
        expect(coerced).toBeInstanceOf(FailoverError);
        expect(coerced!.reason).toBe('rate_limit');
        expect(coerced!.provider).toBe('openai');
    });

    it('returns null for unclassifiable', () => {
        expect(coerceToFailoverError(new Error(''))).toBeNull();
    });
});

describe('describeFailoverError', () => {
    it('describes FailoverError with all fields', () => {
        const err = new FailoverError('rate limited', { reason: 'rate_limit', status: 429, code: 'RL' });
        const desc = describeFailoverError(err);
        expect(desc).toEqual({ message: 'rate limited', reason: 'rate_limit', status: 429, code: 'RL' });
    });

    it('describes regular error', () => {
        const desc = describeFailoverError(new Error('timeout'));
        expect(desc.message).toBe('timeout');
        expect(desc.reason).toBe('timeout');
    });
});
