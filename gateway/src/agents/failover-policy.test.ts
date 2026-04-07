/**
 * agents/failover-policy.test.ts
 */
import { describe, it, expect } from 'vitest';
import { FailoverError, isFailoverError, isTimeoutError, isRateLimitError, isContextOverflowError, coerceToFailoverError, CooldownRegistry, shouldAllowCooldownProbe } from './failover-policy.js';

describe('Failover Policy', () => {
    describe('FailoverError', () => {
        it('creates with reason', () => {
            const err = new FailoverError({ message: 'rate limited', reason: 'rate_limit', retryAfterMs: 5000 });
            expect(err.reason).toBe('rate_limit');
            expect(err.retryAfterMs).toBe(5000);
            expect(isFailoverError(err)).toBe(true);
        });
    });

    describe('error classification', () => {
        it('classifies timeout', () => {
            expect(isTimeoutError(new FailoverError({ message: 'x', reason: 'timeout' }))).toBe(true);
            expect(isTimeoutError(new Error('ETIMEDOUT'))).toBe(true);
            expect(isTimeoutError(new Error('ok'))).toBe(false);
        });
        it('classifies rate limit', () => {
            expect(isRateLimitError(new Error('429 too many requests'))).toBe(true);
            expect(isRateLimitError(new Error('ok'))).toBe(false);
        });
        it('classifies context overflow', () => {
            expect(isContextOverflowError(new Error('context length exceeded'))).toBe(true);
        });
    });

    describe('coerceToFailoverError', () => {
        it('coerces rate limit', () => {
            const err = coerceToFailoverError(new Error('429 rate limit'));
            expect(err.reason).toBe('rate_limit');
        });
        it('coerces timeout', () => {
            expect(coerceToFailoverError(new Error('ETIMEDOUT')).reason).toBe('timeout');
        });
        it('coerces auth error', () => {
            expect(coerceToFailoverError(new Error('401 unauthorized')).reason).toBe('auth_error');
        });
        it('passes through FailoverError', () => {
            const orig = new FailoverError({ message: 'x', reason: 'server_error' });
            expect(coerceToFailoverError(orig)).toBe(orig);
        });
    });

    describe('CooldownRegistry', () => {
        it('set and check cooldown', () => {
            const reg = new CooldownRegistry();
            reg.setCooldown({ model: 'gpt-4', provider: 'openai', durationMs: 10000, reason: 'rate_limit' });
            expect(reg.isInCooldown('openai', 'gpt-4')).toBe(true);
            expect(reg.isInCooldown('openai', 'gpt-3')).toBe(false);
        });
        it('expired cooldown clears', async () => {
            const reg = new CooldownRegistry();
            reg.setCooldown({ model: 'm', provider: 'p', durationMs: 30, reason: 'rate_limit' });
            await new Promise((r) => setTimeout(r, 50));
            expect(reg.isInCooldown('p', 'm')).toBe(false);
        });
        it('lists active', () => {
            const reg = new CooldownRegistry();
            reg.setCooldown({ model: 'a', provider: 'p', durationMs: 10000, reason: 'rate_limit' });
            reg.setCooldown({ model: 'b', provider: 'p', durationMs: 10000, reason: 'timeout' });
            expect(reg.listActive()).toHaveLength(2);
        });
        it('clears cooldown', () => {
            const reg = new CooldownRegistry();
            reg.setCooldown({ model: 'm', provider: 'p', durationMs: 10000, reason: 'rate_limit' });
            reg.clearCooldown('p', 'm');
            expect(reg.isInCooldown('p', 'm')).toBe(false);
        });
    });

    describe('shouldAllowCooldownProbe', () => {
        it('allows rate_limit', () => expect(shouldAllowCooldownProbe('rate_limit')).toBe(true));
        it('allows server_error', () => expect(shouldAllowCooldownProbe('server_error')).toBe(true));
        it('disallows auth_error', () => expect(shouldAllowCooldownProbe('auth_error')).toBe(false));
    });
});
