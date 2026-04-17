/**
 * channels/typing-policy.test.ts — Typing policy tests
 */
import { describe, it, expect } from 'vitest';
import { resolveRunTypingPolicy, shouldShowTyping, resolveTypingIntervalMs } from './typing-policy.js';

describe('Typing Policy', () => {
    describe('resolveRunTypingPolicy', () => {
        it('defaults to auto', () => {
            const result = resolveRunTypingPolicy({});
            expect(result.typingPolicy).toBe('auto');
            expect(result.suppressTyping).toBe(false);
        });

        it('heartbeat suppresses', () => {
            const result = resolveRunTypingPolicy({ isHeartbeat: true });
            expect(result.typingPolicy).toBe('heartbeat');
            expect(result.suppressTyping).toBe(true);
        });

        it('system event suppresses', () => {
            const result = resolveRunTypingPolicy({ systemEvent: true });
            expect(result.typingPolicy).toBe('system_event');
            expect(result.suppressTyping).toBe(true);
        });

        it('explicit suppress', () => {
            const result = resolveRunTypingPolicy({ suppressTyping: true });
            expect(result.suppressTyping).toBe(true);
        });

        it('uses requested policy', () => {
            const result = resolveRunTypingPolicy({ requestedPolicy: 'always' });
            expect(result.typingPolicy).toBe('always');
        });
    });

    describe('shouldShowTyping', () => {
        it('auto → true', () => expect(shouldShowTyping('auto')).toBe(true));
        it('always → true', () => expect(shouldShowTyping('always')).toBe(true));
        it('never → false', () => expect(shouldShowTyping('never')).toBe(false));
        it('heartbeat → false', () => expect(shouldShowTyping('heartbeat')).toBe(false));
    });

    describe('resolveTypingIntervalMs', () => {
        it('discord → 5000', () => expect(resolveTypingIntervalMs('discord')).toBe(5000));
        it('slack → 0', () => expect(resolveTypingIntervalMs('slack')).toBe(0));
        it('signal → 3000', () => expect(resolveTypingIntervalMs('signal')).toBe(3000));
        it('unknown → 5000', () => expect(resolveTypingIntervalMs('custom')).toBe(5000));
    });
});
