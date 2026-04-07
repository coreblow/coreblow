// @ts-nocheck
import { describe, it, expect } from 'vitest';
import {
    GATEWAY_CLOSE_CODE_HINTS,
    describeGatewayCloseCode,
    resolveGatewayClientConnectChallengeTimeoutMs,
} from './client.js';

describe('Gateway Client Utilities — Phase 14', () => {

    // ─── Close Code Hints ──────────────────────────────────────

    describe('GATEWAY_CLOSE_CODE_HINTS', () => {
        it('has standard codes', () => {
            expect(GATEWAY_CLOSE_CODE_HINTS[1000]).toBe('normal closure');
            expect(GATEWAY_CLOSE_CODE_HINTS[1006]).toContain('abnormal');
            expect(GATEWAY_CLOSE_CODE_HINTS[1008]).toContain('policy');
            expect(GATEWAY_CLOSE_CODE_HINTS[1012]).toContain('restart');
        });
    });

    describe('describeGatewayCloseCode', () => {
        it('returns hint for known code', () => {
            expect(describeGatewayCloseCode(1000)).toBe('normal closure');
        });

        it('returns undefined for unknown code', () => {
            expect(describeGatewayCloseCode(9999)).toBeUndefined();
        });
    });

    // ─── Connect Challenge Timeout ─────────────────────────────

    describe('resolveGatewayClientConnectChallengeTimeoutMs', () => {
        it('returns number for empty opts', () => {
            const ms = resolveGatewayClientConnectChallengeTimeoutMs({});
            expect(typeof ms).toBe('number');
            expect(ms).toBeGreaterThan(0);
        });

        it('uses connectChallengeTimeoutMs when set', () => {
            const ms = resolveGatewayClientConnectChallengeTimeoutMs({ connectChallengeTimeoutMs: 5000 });
            expect(ms).toBe(5000);
        });

        it('falls back to deprecated connectDelayMs', () => {
            const ms = resolveGatewayClientConnectChallengeTimeoutMs({ connectDelayMs: 3000 });
            expect(ms).toBe(3000);
        });

        it('prefers connectChallengeTimeoutMs over connectDelayMs', () => {
            const ms = resolveGatewayClientConnectChallengeTimeoutMs({
                connectChallengeTimeoutMs: 7000,
                connectDelayMs: 3000,
            });
            expect(ms).toBe(7000);
        });

        it('ignores NaN', () => {
            const ms = resolveGatewayClientConnectChallengeTimeoutMs({ connectChallengeTimeoutMs: NaN });
            expect(ms).toBeGreaterThan(0);
        });
    });
});
