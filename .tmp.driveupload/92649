/**
 * auto-reply/heartbeat.test.ts — Heartbeat and typing tests
 */
import { describe, it, expect, vi } from 'vitest';
import {
    isHeartbeatContentEffectivelyEmpty, resolveHeartbeatPrompt,
    parseHeartbeatInterval, TypingIndicator,
    HEARTBEAT_PROMPT, DEFAULT_HEARTBEAT_EVERY,
} from './heartbeat.js';

describe('Heartbeat', () => {
    describe('isHeartbeatContentEffectivelyEmpty', () => {
        it('empty string is effectively empty', () => expect(isHeartbeatContentEffectivelyEmpty('')).toBe(true));
        it('whitespace only is effectively empty', () => expect(isHeartbeatContentEffectivelyEmpty('  \n  ')).toBe(true));
        it('headers only is effectively empty', () => expect(isHeartbeatContentEffectivelyEmpty('# Title\n## Subtitle')).toBe(true));
        it('content is not empty', () => expect(isHeartbeatContentEffectivelyEmpty('# Title\nDo this thing')).toBe(false));
        it('null returns false', () => expect(isHeartbeatContentEffectivelyEmpty(null)).toBe(false));
        it('undefined returns false', () => expect(isHeartbeatContentEffectivelyEmpty(undefined)).toBe(false));
        it('empty checkboxes are empty', () => expect(isHeartbeatContentEffectivelyEmpty('- [ ]\n* [ ]')).toBe(true));
    });

    describe('resolveHeartbeatPrompt', () => {
        it('returns custom prompt', () => expect(resolveHeartbeatPrompt('Custom task')).toBe('Custom task'));
        it('returns default for empty', () => expect(resolveHeartbeatPrompt('')).toBe(HEARTBEAT_PROMPT));
        it('returns default for undefined', () => expect(resolveHeartbeatPrompt(undefined)).toBe(HEARTBEAT_PROMPT));
    });

    describe('parseHeartbeatInterval', () => {
        it('parses minutes', () => expect(parseHeartbeatInterval('30m')).toBe(30 * 60 * 1000));
        it('parses hours', () => expect(parseHeartbeatInterval('1h')).toBe(60 * 60 * 1000));
        it('parses seconds', () => expect(parseHeartbeatInterval('45s')).toBe(45 * 1000));
        it('parses combined', () => expect(parseHeartbeatInterval('1h30m')).toBe(90 * 60 * 1000));
        it('parses plain number as minutes', () => expect(parseHeartbeatInterval('15')).toBe(15 * 60 * 1000));
        it('enforces minimum 1s', () => expect(parseHeartbeatInterval('0')).toBe(1000));
    });

    describe('TypingIndicator', () => {
        it('starts and sends typing', () => {
            const sendTyping = vi.fn();
            const indicator = new TypingIndicator(sendTyping, 100);
            indicator.start();
            expect(sendTyping).toHaveBeenCalledTimes(1);
            indicator.stop();
        });

        it('does not double-start', () => {
            const sendTyping = vi.fn();
            const indicator = new TypingIndicator(sendTyping, 100);
            indicator.start();
            indicator.start();
            expect(sendTyping).toHaveBeenCalledTimes(1);
            indicator.stop();
        });

        it('stops cleanly', () => {
            const sendTyping = vi.fn();
            const indicator = new TypingIndicator(sendTyping, 50);
            indicator.start();
            indicator.stop();
            indicator.stop(); // double-stop should be safe
        });
    });

    describe('Constants', () => {
        it('DEFAULT_HEARTBEAT_EVERY is 30m', () => expect(DEFAULT_HEARTBEAT_EVERY).toBe('30m'));
        it('HEARTBEAT_PROMPT is defined', () => expect(HEARTBEAT_PROMPT.length).toBeGreaterThan(10));
    });
});
