import { describe, it, expect } from 'vitest';
import {
    shouldAllowCooldownProbeForReason,
    shouldUseTransientCooldownProbeSlot,
    shouldPreserveTransientCooldownProbeSlot,
    shouldAllowCooldownProbe,
    buildProviderProfileId,
} from './failover-policy.js';
import {
    FailoverError, isFailoverError, isTimeoutError,
    resolveFailoverReasonFromError, coerceToFailoverError,
} from './failover-policy.js';
import type { FailoverReason } from './failover-policy.js';

// ─── 3 Pure Policy Functions — CoreBlow parity (CASES table) ────────────────

type ReasonCase = {
    reason: FailoverReason | null | undefined;
    allowCooldownProbe: boolean;
    useTransientProbeSlot: boolean;
    preserveTransientProbeSlot: boolean;
};

/**
 * CoreBlow — failover-policy.test.ts
 * 12 reason cases × 3 functions = 36 assertions
 */
const CASES: ReasonCase[] = [
    { reason: 'rate_limit',      allowCooldownProbe: true,  useTransientProbeSlot: true,  preserveTransientProbeSlot: false },
    { reason: 'overloaded',      allowCooldownProbe: true,  useTransientProbeSlot: true,  preserveTransientProbeSlot: false },
    { reason: 'billing',         allowCooldownProbe: true,  useTransientProbeSlot: false, preserveTransientProbeSlot: false },
    { reason: 'unknown',         allowCooldownProbe: true,  useTransientProbeSlot: true,  preserveTransientProbeSlot: false },
    { reason: 'model_not_found', allowCooldownProbe: false, useTransientProbeSlot: false, preserveTransientProbeSlot: true  },
    { reason: 'format',          allowCooldownProbe: false, useTransientProbeSlot: false, preserveTransientProbeSlot: true  },
    { reason: 'auth',            allowCooldownProbe: false, useTransientProbeSlot: false, preserveTransientProbeSlot: true  },
    { reason: 'auth_permanent',  allowCooldownProbe: false, useTransientProbeSlot: false, preserveTransientProbeSlot: true  },
    { reason: 'session_expired', allowCooldownProbe: false, useTransientProbeSlot: false, preserveTransientProbeSlot: true  },
    { reason: 'timeout',         allowCooldownProbe: false, useTransientProbeSlot: false, preserveTransientProbeSlot: false },
    { reason: null,              allowCooldownProbe: false, useTransientProbeSlot: false, preserveTransientProbeSlot: false },
    { reason: undefined,         allowCooldownProbe: false, useTransientProbeSlot: false, preserveTransientProbeSlot: false },
];

describe('failover-policy — 3 pure functions (CoreBlow parity)', () => {
    it('maps all failover reasons to correct cooldown-probe decisions', () => {
        for (const tc of CASES) {
            expect(shouldAllowCooldownProbeForReason(tc.reason)).toBe(tc.allowCooldownProbe);
            expect(shouldUseTransientCooldownProbeSlot(tc.reason)).toBe(tc.useTransientProbeSlot);
            expect(shouldPreserveTransientCooldownProbeSlot(tc.reason)).toBe(tc.preserveTransientProbeSlot);
        }
    });

    it('shouldAllowCooldownProbeForReason — transient reasons allow probe', () => {
        expect(shouldAllowCooldownProbeForReason('rate_limit')).toBe(true);
        expect(shouldAllowCooldownProbeForReason('overloaded')).toBe(true);
        expect(shouldAllowCooldownProbeForReason('billing')).toBe(true);
        expect(shouldAllowCooldownProbeForReason('unknown')).toBe(true);
    });

    it('shouldAllowCooldownProbeForReason — permanent reasons disallow probe', () => {
        expect(shouldAllowCooldownProbeForReason('auth')).toBe(false);
        expect(shouldAllowCooldownProbeForReason('auth_permanent')).toBe(false);
        expect(shouldAllowCooldownProbeForReason('timeout')).toBe(false);
        expect(shouldAllowCooldownProbeForReason('format')).toBe(false);
        expect(shouldAllowCooldownProbeForReason('model_not_found')).toBe(false);
        expect(shouldAllowCooldownProbeForReason('session_expired')).toBe(false);
        expect(shouldAllowCooldownProbeForReason(null)).toBe(false);
        expect(shouldAllowCooldownProbeForReason(undefined)).toBe(false);
    });

    it('shouldUseTransientCooldownProbeSlot — only rate_limit, overloaded, unknown', () => {
        expect(shouldUseTransientCooldownProbeSlot('rate_limit')).toBe(true);
        expect(shouldUseTransientCooldownProbeSlot('overloaded')).toBe(true);
        expect(shouldUseTransientCooldownProbeSlot('unknown')).toBe(true);
        expect(shouldUseTransientCooldownProbeSlot('billing')).toBe(false);
    });

    it('shouldPreserveTransientCooldownProbeSlot — only permanent errors', () => {
        expect(shouldPreserveTransientCooldownProbeSlot('model_not_found')).toBe(true);
        expect(shouldPreserveTransientCooldownProbeSlot('format')).toBe(true);
        expect(shouldPreserveTransientCooldownProbeSlot('auth')).toBe(true);
        expect(shouldPreserveTransientCooldownProbeSlot('auth_permanent')).toBe(true);
        expect(shouldPreserveTransientCooldownProbeSlot('session_expired')).toBe(true);
        expect(shouldPreserveTransientCooldownProbeSlot('rate_limit')).toBe(false);
        expect(shouldPreserveTransientCooldownProbeSlot('timeout')).toBe(false);
    });
});

// ─── buildProviderProfileId ───────────────────────────────────────────────────

describe('buildProviderProfileId', () => {
    it('formats as provider:model', () => {
        expect(buildProviderProfileId('openai', 'gpt-4')).toBe('openai:gpt-4');
        expect(buildProviderProfileId('anthropic', 'claude-3')).toBe('anthropic:claude-3');
        expect(buildProviderProfileId('google', 'gemini-pro')).toBe('google:gemini-pro');
    });
});

// ─── Re-exported FailoverError ────────────────────────────────────────────────

describe('FailoverError (re-exported)', () => {
    it('creates with reason', () => {
        const err = new FailoverError('rate limited', { reason: 'rate_limit' });
        expect(err.reason).toBe('rate_limit');
        expect(isFailoverError(err)).toBe(true);
    });
});

describe('error classification (re-exported)', () => {
    it('isTimeoutError — ETIMEDOUT', () => {
        expect(isTimeoutError(new Error('ETIMEDOUT'))).toBe(true);
        expect(isTimeoutError(new Error('ok'))).toBe(false);
    });

    it('resolveFailoverReasonFromError — 429 → rate_limit', () => {
        expect(resolveFailoverReasonFromError({ status: 429 })).toBe('rate_limit');
    });

    it('coerceToFailoverError — rate limit', () => {
        const err = coerceToFailoverError(new Error('429 rate limit'));
        expect(err?.reason).toBe('rate_limit');
    });

    it('coerceToFailoverError — passes through FailoverError', () => {
        const orig = new FailoverError('x', { reason: 'timeout' });
        expect(coerceToFailoverError(orig)).toBe(orig);
    });
});

// ─── shouldAllowCooldownProbe (backward compat alias) ────────────────────────

describe('shouldAllowCooldownProbe (alias)', () => {
    it('allows rate_limit', () => expect(shouldAllowCooldownProbe('rate_limit')).toBe(true));
    it('allows overloaded', () => expect(shouldAllowCooldownProbe('overloaded')).toBe(true));
    it('disallows auth_permanent', () => expect(shouldAllowCooldownProbe('auth_permanent')).toBe(false));
    it('disallows timeout', () => expect(shouldAllowCooldownProbe('timeout')).toBe(false));
});
