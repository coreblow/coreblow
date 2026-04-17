/**
 * auto-reply/send-policy.test.ts — Send policy tests
 */
import { describe, it, expect } from 'vitest';
import {
    normalizeSendPolicyOverride, parseSendPolicyCommand,
    shouldSendReply, resolveSendPolicy,
} from './send-policy.js';

describe('Send Policy', () => {
    describe('normalizeSendPolicyOverride', () => {
        it('allow variants', () => {
            expect(normalizeSendPolicyOverride('allow')).toBe('allow');
            expect(normalizeSendPolicyOverride('on')).toBe('allow');
        });
        it('deny variants', () => {
            expect(normalizeSendPolicyOverride('deny')).toBe('deny');
            expect(normalizeSendPolicyOverride('off')).toBe('deny');
        });
        it('undefined for unknown', () => expect(normalizeSendPolicyOverride('unknown')).toBeUndefined());
        it('undefined for null', () => expect(normalizeSendPolicyOverride(null)).toBeUndefined());
    });

    describe('parseSendPolicyCommand', () => {
        it('parses /send allow', () => {
            const r = parseSendPolicyCommand('/send allow');
            expect(r.hasCommand).toBe(true);
            expect(r.mode).toBe('allow');
        });
        it('parses /send inherit', () => {
            const r = parseSendPolicyCommand('/send inherit');
            expect(r.hasCommand).toBe(true);
            expect(r.mode).toBe('inherit');
        });
        it('parses /send without mode', () => {
            const r = parseSendPolicyCommand('/send');
            expect(r.hasCommand).toBe(true);
        });
        it('rejects non-send', () => expect(parseSendPolicyCommand('/help').hasCommand).toBe(false));
    });

    describe('shouldSendReply', () => {
        it('allows by default', () => expect(shouldSendReply({}).allowed).toBe(true));
        it('denies when policy is deny', () => expect(shouldSendReply({ sendPolicy: 'deny' }).allowed).toBe(false));

        it('denies during cooldown', () => {
            const result = shouldSendReply({ cooldown: { lastReplyAt: Date.now(), cooldownMs: 5000 } });
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('Cooldown');
        });

        it('allows after cooldown', () => {
            const result = shouldSendReply({ cooldown: { lastReplyAt: Date.now() - 10000, cooldownMs: 5000 } });
            expect(result.allowed).toBe(true);
        });

        it('denies at rate limit', () => {
            const result = shouldSendReply({ rateLimitPerMinute: 10, recentReplyCount: 10 });
            expect(result.allowed).toBe(false);
        });
    });

    describe('resolveSendPolicy', () => {
        it('returns defaults', () => {
            const p = resolveSendPolicy({});
            expect(p.cooldownMs).toBe(0);
            expect(p.rateLimitPerMinute).toBe(60);
        });

        it('uses config values', () => {
            const cfg = { messages: { outbound: { cooldownMs: 1000, rateLimitPerMinute: 30 } } };
            const p = resolveSendPolicy(cfg);
            expect(p.cooldownMs).toBe(1000);
            expect(p.rateLimitPerMinute).toBe(30);
        });

        it('uses channel override', () => {
            const cfg = {
                messages: { outbound: { cooldownMs: 1000 } },
                channels: { discord: { cooldownMs: 500 } },
            };
            const p = resolveSendPolicy(cfg, 'discord');
            expect(p.cooldownMs).toBe(500);
        });
    });
});
