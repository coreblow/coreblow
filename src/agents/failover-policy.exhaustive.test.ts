/**
 * CoreBlow — Failover Policy Extended Tests
 *
 * Tests covering all probe policy decisions exhaustively across all reasons.
 */

import { describe, it, expect } from 'vitest';
import {
    shouldAllowCooldownProbeForReason,
    shouldUseTransientCooldownProbeSlot,
    shouldPreserveTransientCooldownProbeSlot,
    buildProviderProfileId,
    shouldAllowCooldownProbe,
} from './failover-policy.js';
import type { FailoverReason } from './failover-error.js';

const ALL_REASONS: FailoverReason[] = [
    'auth', 'auth_permanent', 'format', 'rate_limit', 'overloaded',
    'billing', 'timeout', 'model_not_found', 'session_expired', 'unknown',
];

describe('shouldAllowCooldownProbeForReason (exhaustive)', () => {
    it.each([
        ['rate_limit', true], ['overloaded', true], ['billing', true], ['unknown', true],
        ['auth', false], ['auth_permanent', false], ['format', false],
        ['timeout', false], ['model_not_found', false], ['session_expired', false],
    ] as const)('%s → %s', (reason, expected) => {
        expect(shouldAllowCooldownProbeForReason(reason)).toBe(expected);
    });

    it('returns false for null/undefined', () => {
        expect(shouldAllowCooldownProbeForReason(null)).toBe(false);
        expect(shouldAllowCooldownProbeForReason(undefined)).toBe(false);
    });

    it('exactly 4 reasons allow probing', () => {
        expect(ALL_REASONS.filter(r => shouldAllowCooldownProbeForReason(r))).toHaveLength(4);
    });
});

describe('shouldUseTransientCooldownProbeSlot (exhaustive)', () => {
    it.each([
        ['rate_limit', true], ['overloaded', true], ['unknown', true],
        ['billing', false], ['auth', false], ['auth_permanent', false],
        ['format', false], ['timeout', false], ['model_not_found', false],
        ['session_expired', false],
    ] as const)('%s → %s', (reason, expected) => {
        expect(shouldUseTransientCooldownProbeSlot(reason)).toBe(expected);
    });

    it('billing excluded (needs account action)', () => {
        expect(shouldUseTransientCooldownProbeSlot('billing')).toBe(false);
    });
});

describe('shouldPreserveTransientCooldownProbeSlot (exhaustive)', () => {
    it.each([
        ['model_not_found', true], ['format', true], ['auth', true],
        ['auth_permanent', true], ['session_expired', true],
        ['rate_limit', false], ['overloaded', false], ['billing', false],
        ['timeout', false], ['unknown', false],
    ] as const)('%s → %s', (reason, expected) => {
        expect(shouldPreserveTransientCooldownProbeSlot(reason)).toBe(expected);
    });

    it('exactly 5 permanent reasons', () => {
        expect(ALL_REASONS.filter(r => shouldPreserveTransientCooldownProbeSlot(r))).toHaveLength(5);
    });
});

describe('buildProviderProfileId', () => {
    it('builds provider:model', () => {
        expect(buildProviderProfileId('openai', 'gpt-4o')).toBe('openai:gpt-4o');
    });
});

describe('shouldAllowCooldownProbe (alias)', () => {
    it('delegates correctly', () => {
        expect(shouldAllowCooldownProbe('rate_limit')).toBe(true);
        expect(shouldAllowCooldownProbe('auth')).toBe(false);
    });
});
