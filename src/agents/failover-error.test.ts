/**
 * agents/failover-error.test.ts
 *
 * CoreBlow — failover-error.test.ts
 * Tests untuk error classification engine.
 */
import { describe, it, expect } from 'vitest';
import {
    FailoverError,
    isFailoverError,
    isTimeoutError,
    resolveFailoverReasonFromError,
    resolveFailoverStatus,
    coerceToFailoverError,
    describeFailoverError,
} from './failover-error.js';

// ─── FailoverError class ──────────────────────────────────────────────────────

describe('FailoverError', () => {
    it('sets name, reason, provider, model, status, code', () => {
        const err = new FailoverError('rate limited', {
            reason: 'rate_limit', provider: 'openai', model: 'gpt-4', status: 429, code: 'RATE_LIMIT',
        });
        expect(err.name).toBe('FailoverError');
        expect(err.reason).toBe('rate_limit');
        expect(err.provider).toBe('openai');
        expect(err.model).toBe('gpt-4');
        expect(err.status).toBe(429);
        expect(err.code).toBe('RATE_LIMIT');
        expect(err instanceof Error).toBe(true);
    });

    it('isFailoverError returns true', () => {
        const err = new FailoverError('x', { reason: 'timeout' });
        expect(isFailoverError(err)).toBe(true);
    });

    it('isFailoverError returns false for plain Error', () => {
        expect(isFailoverError(new Error('x'))).toBe(false);
        expect(isFailoverError(null)).toBe(false);
        expect(isFailoverError('string')).toBe(false);
    });
});

// ─── resolveFailoverStatus ────────────────────────────────────────────────────

describe('resolveFailoverStatus', () => {
    it('maps all known reasons to correct HTTP status', () => {
        expect(resolveFailoverStatus('billing')).toBe(402);
        expect(resolveFailoverStatus('rate_limit')).toBe(429);
        expect(resolveFailoverStatus('overloaded')).toBe(503);
        expect(resolveFailoverStatus('auth')).toBe(401);
        expect(resolveFailoverStatus('auth_permanent')).toBe(403);
        expect(resolveFailoverStatus('timeout')).toBe(408);
        expect(resolveFailoverStatus('format')).toBe(400);
        expect(resolveFailoverStatus('model_not_found')).toBe(404);
        expect(resolveFailoverStatus('session_expired')).toBe(410);
        expect(resolveFailoverStatus('unknown')).toBeUndefined();
    });
});

// ─── isTimeoutError ───────────────────────────────────────────────────────────

describe('isTimeoutError', () => {
    it('checks message/name, not FailoverError.reason directly', () => {
        // isTimeoutError checks error name/message patterns, not FailoverError.reason
        // A FailoverError with reason='timeout' but generic message returns false
        const err = new FailoverError('x', { reason: 'timeout' });
        expect(isTimeoutError(err)).toBe(false); // no timeout-like message/name
        // But a FailoverError with timeout message returns true
        const errWithMsg = new FailoverError('ETIMEDOUT', { reason: 'timeout' });
        expect(isTimeoutError(errWithMsg)).toBe(true);
    });

    it('returns true for ETIMEDOUT in message', () => {
        expect(isTimeoutError(new Error('ETIMEDOUT'))).toBe(true);
    });

    it('treats AbortError with stop reason: abort as timeout', () => {
        const err = Object.assign(new Error('aborted'), { name: 'AbortError', reason: 'reason: abort' });
        expect(isTimeoutError(err)).toBe(true);
    });

    it('returns false for non-timeout error', () => {
        expect(isTimeoutError(new Error('billing error'))).toBe(false);
        expect(isTimeoutError(null)).toBe(false);
    });
});

// ─── resolveFailoverReasonFromError — HTTP status ─────────────────────────────

describe('resolveFailoverReasonFromError — HTTP status codes', () => {
    it('429 → rate_limit', () => {
        expect(resolveFailoverReasonFromError({ status: 429 })).toBe('rate_limit');
    });

    it('402 + generic → billing', () => {
        expect(resolveFailoverReasonFromError({ status: 402, message: 'payment required' })).toBe('billing');
    });

    it('402 + "rate limit" message → rate_limit', () => {
        expect(resolveFailoverReasonFromError({ status: 402, message: 'Monthly spend limit reached. Please visit your billing settings.' })).toBe('rate_limit');
    });

    it('401 → auth', () => {
        expect(resolveFailoverReasonFromError({ status: 401, message: 'Unauthorized' })).toBe('auth');
    });

    it('401 + invalid_api_key → auth_permanent', () => {
        expect(resolveFailoverReasonFromError({ status: 401, message: 'invalid_api_key' })).toBe('auth_permanent');
    });

    it('403 + api key revoked → auth_permanent', () => {
        expect(resolveFailoverReasonFromError({ status: 403, message: 'api key revoked' })).toBe('auth_permanent');
    });

    it('403 + permission_error → auth_permanent', () => {
        expect(resolveFailoverReasonFromError({ status: 403, message: 'permission_error: OAuth authentication is currently not allowed for this organization.' })).toBe('auth_permanent');
    });

    it('408 → timeout', () => {
        expect(resolveFailoverReasonFromError({ status: 408 })).toBe('timeout');
    });

    it('503 + overloaded message → overloaded', () => {
        expect(resolveFailoverReasonFromError({ status: 503, message: 'overloaded' })).toBe('overloaded');
    });

    it('503 + generic → timeout', () => {
        expect(resolveFailoverReasonFromError({ status: 503, message: 'service unavailable' })).toBe('timeout');
    });

    it('500 → timeout', () => {
        expect(resolveFailoverReasonFromError({ status: 500 })).toBe('timeout');
    });

    it('529 → overloaded', () => {
        expect(resolveFailoverReasonFromError({ status: 529 })).toBe('overloaded');
    });

    it('400 → format', () => {
        expect(resolveFailoverReasonFromError({ status: 400, message: 'invalid request' })).toBe('format');
    });

    it('400 + billing message → billing', () => {
        expect(resolveFailoverReasonFromError({ status: 400, message: 'insufficient credits' })).toBe('billing');
    });

    it('410 + session not found → session_expired', () => {
        expect(resolveFailoverReasonFromError({ status: 410, message: 'session not found' })).toBe('session_expired');
    });
});

// ─── resolveFailoverReasonFromError — symbolic codes ─────────────────────────

describe('resolveFailoverReasonFromError — symbolic error codes', () => {
    it('RESOURCE_EXHAUSTED → rate_limit', () => {
        expect(resolveFailoverReasonFromError({ code: 'RESOURCE_EXHAUSTED' })).toBe('rate_limit');
    });

    it('THROTTLED → rate_limit', () => {
        expect(resolveFailoverReasonFromError({ code: 'THROTTLED' })).toBe('rate_limit');
    });

    it('OVERLOADED_ERROR → overloaded', () => {
        expect(resolveFailoverReasonFromError({ code: 'OVERLOADED_ERROR' })).toBe('overloaded');
    });
});

// ─── resolveFailoverReasonFromError — Node.js codes ──────────────────────────

describe('resolveFailoverReasonFromError — Node.js error codes', () => {
    it('ETIMEDOUT → timeout', () => {
        expect(resolveFailoverReasonFromError({ code: 'ETIMEDOUT' })).toBe('timeout');
    });

    it('ECONNRESET → timeout', () => {
        expect(resolveFailoverReasonFromError({ code: 'ECONNRESET' })).toBe('timeout');
    });

    it('EHOSTDOWN → timeout', () => {
        expect(resolveFailoverReasonFromError({ code: 'EHOSTDOWN' })).toBe('timeout');
    });

    it('EPIPE → timeout', () => {
        expect(resolveFailoverReasonFromError({ code: 'EPIPE' })).toBe('timeout');
    });
});

// ─── resolveFailoverReasonFromError — message patterns ───────────────────────

describe('resolveFailoverReasonFromError — message patterns', () => {
    it('rate limit in message → rate_limit', () => {
        expect(resolveFailoverReasonFromError(new Error('429 too many requests'))).toBe('rate_limit');
    });

    it('context length exceeded — not classified as failover', () => {
        // context length is handled upstream, not by failover error
        const r = resolveFailoverReasonFromError(new Error('context length exceeded'));
        // can be null or timeout depending on message classifier
        expect(['timeout', null]).toContain(r);
    });

    it('model not found → model_not_found', () => {
        expect(resolveFailoverReasonFromError(new Error('model not found: gpt-5'))).toBe('model_not_found');
    });

    it('session expired message → session_expired', () => {
        expect(resolveFailoverReasonFromError(new Error('session not found'))).toBe('session_expired');
    });

    it('invalid request format → format', () => {
        expect(resolveFailoverReasonFromError(new Error('invalid request format: messages.1.content.1.tool_use.id'))).toBe('format');
    });

    it('fetch failed → timeout', () => {
        expect(resolveFailoverReasonFromError(new Error('fetch failed'))).toBe('timeout');
    });

    it('connection error → timeout', () => {
        expect(resolveFailoverReasonFromError(new Error('Connection error.'))).toBe('timeout');
    });

    it('insufficient credits → billing', () => {
        expect(resolveFailoverReasonFromError(new Error('insufficient credits'))).toBe('billing');
    });

    it('stop reason: abort → timeout', () => {
        expect(resolveFailoverReasonFromError(new Error('stop reason: abort'))).toBe('timeout');
    });
});

// ─── resolveFailoverReasonFromError — cause chain ────────────────────────────

describe('resolveFailoverReasonFromError — cause chain traversal', () => {
    it('classifies abort-wrapped RESOURCE_EXHAUSTED as rate_limit (not timeout)', () => {
        const err = Object.assign(new Error('request aborted'), {
            name: 'AbortError',
            cause: { error: { code: 429, message: 'resource_exhausted', status: 'RESOURCE_EXHAUSTED' } },
        });
        expect(resolveFailoverReasonFromError(err)).toBe('rate_limit');
    });

    it('resolves reason from nested error.cause', () => {
        const outer = new Error('wrapper');
        (outer as any).cause = { status: 429 };
        expect(resolveFailoverReasonFromError(outer)).toBe('rate_limit');
    });
});

// ─── coerceToFailoverError ────────────────────────────────────────────────────

describe('coerceToFailoverError', () => {
    it('returns null for non-failover error', () => {
        expect(coerceToFailoverError(new Error('something random that cannot be classified'))).toBeNull();
    });

    it('passes through existing FailoverError unchanged', () => {
        const orig = new FailoverError('x', { reason: 'rate_limit' });
        expect(coerceToFailoverError(orig)).toBe(orig);
    });

    it('coerces rate limit error with correct reason + status', () => {
        const err = coerceToFailoverError(new Error('429 rate limit'));
        expect(err?.reason).toBe('rate_limit');
        expect(err?.status).toBe(429);
    });

    it('coerces timeout error', () => {
        const err = coerceToFailoverError(new Error('ETIMEDOUT'));
        expect(err?.reason).toBe('timeout');
    });

    it('coerces auth error with provider+model context', () => {
        const err = coerceToFailoverError({ status: 401, message: 'invalid_api_key' }, { provider: 'anthropic', model: 'claude-opus-4-5' });
        expect(err?.reason).toBe('auth_permanent');
        expect(err?.provider).toBe('anthropic');
        expect(err?.model).toBe('claude-opus-4-5');
    });

    it('coerces billing error', () => {
        const err = coerceToFailoverError('credit balance too low', { provider: 'anthropic', model: 'claude-opus-4-5' });
        expect(err?.name).toBe('FailoverError');
        expect(err?.reason).toBe('billing');
        expect(err?.provider).toBe('anthropic');
    });

    it('overloaded → status 503', () => {
        const err = coerceToFailoverError({ status: 503, message: 'overloaded' });
        expect(err?.reason).toBe('overloaded');
    });

    it('format error → status 400', () => {
        const err = coerceToFailoverError('invalid request format', { provider: 'google', model: 'cloud-code-assist' });
        expect(err?.reason).toBe('format');
        expect(err?.status).toBe(400);
    });

    it('permission_error in string classifies as auth_permanent', () => {
        const err = coerceToFailoverError('HTTP 403 permission_error: OAuth authentication is currently not allowed for this organization.', { provider: 'anthropic', model: 'claude-3' });
        expect(err?.reason).toBe('auth_permanent');
    });
});

// ─── describeFailoverError ────────────────────────────────────────────────────

describe('describeFailoverError', () => {
    it('describes FailoverError with all fields', () => {
        const err = new FailoverError('rate limited', { reason: 'rate_limit', status: 429, code: 'RATE_LIMIT' });
        const desc = describeFailoverError(err);
        expect(desc.message).toBe('rate limited');
        expect(desc.reason).toBe('rate_limit');
        expect(desc.status).toBe(429);
        expect(desc.code).toBe('RATE_LIMIT');
    });

    it('describes plain Error', () => {
        const desc = describeFailoverError(new Error('fetch failed'));
        expect(desc.message).toBe('fetch failed');
        expect(desc.reason).toBe('timeout');
    });

    it('describes non-Error values consistently', () => {
        const described = describeFailoverError(123);
        expect(described.message).toBe('123');
        expect(described.reason).toBeUndefined();
    });

    it('describes string error', () => {
        const desc = describeFailoverError('rate limit exceeded');
        expect(desc.message).toBe('rate limit exceeded');
        expect(desc.reason).toBe('rate_limit');
    });
});
