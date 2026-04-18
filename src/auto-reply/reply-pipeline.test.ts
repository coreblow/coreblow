// @ts-nocheck
/**
 * Reply pipeline tests
 */
import { describe, it, expect } from 'vitest';
import { stripThinkingTags, stripAssistantPrefix, normalizeReply, stripMarkdown, truncateReply } from './reply/normalize-reply.js';
import { ReplyQueue } from './reply/queue.js';
import { startTyping, stopTyping, isTyping, stopAllTyping } from './reply/typing.js';
import type { ReplyEnvelope } from './types.js';

describe('normalize-reply', () => {
    it('should strip thinking tags', () => {
        expect(stripThinkingTags('<thinking>internal thoughts</thinking>Hello!')).toBe('Hello!');
    });

    it('should strip assistant prefix', () => {
        expect(stripAssistantPrefix('Assistant: Hello')).toBe('Hello');
        expect(stripAssistantPrefix('Bot: Hi there')).toBe('Hi there');
    });

    it('should strip markdown for plain text platforms', () => {
        expect(stripMarkdown('**bold** and *italic*')).toBe('bold and italic');
        expect(stripMarkdown('`code`')).toBe('code');
    });

    it('should normalize for discord (keep markdown)', () => {
        const result = normalizeReply('**bold** text', 'discord');
        expect(result).toContain('**bold**');
    });

    it('should normalize for whatsapp (strip markdown)', () => {
        const result = normalizeReply('**bold** text', 'whatsapp');
        expect(result).toBe('bold text');
    });

    it('should truncate long replies', () => {
        const long = 'a'.repeat(500);
        expect(truncateReply(long, 100).length).toBeLessThanOrEqual(100);
        expect(truncateReply(long, 100)).toContain('...');
    });
});

describe('ReplyQueue', () => {
    const mockEnvelope = (id: string): ReplyEnvelope => ({
        inbound: { id, channel: 'ch1', platform: 'discord', senderId: 'u1', content: 'hi', timestamp: Date.now() },
        sessionId: `sess_${id}`, model: 'gpt-4o',
        trigger: { type: 'mention', enabled: true },
        dispatchedAt: Date.now(), priority: 50,
    });

    it('should enqueue and dequeue', () => {
        const q = new ReplyQueue();
        expect(q.enqueue(mockEnvelope('1'))).toBe(true);
        expect(q.size).toBe(1);
        const env = q.dequeue();
        expect(env).toBeTruthy();
        expect(q.size).toBe(0);
    });

    it('should reject duplicates', () => {
        const q = new ReplyQueue();
        expect(q.enqueue(mockEnvelope('1'))).toBe(true);
        expect(q.enqueue(mockEnvelope('1'))).toBe(false);
    });

    it('should respect max queue size', () => {
        const q = new ReplyQueue(2);
        expect(q.enqueue(mockEnvelope('1'))).toBe(true);
        expect(q.enqueue(mockEnvelope('2'))).toBe(true);
        expect(q.enqueue(mockEnvelope('3'))).toBe(false);
    });

    it('should sort by priority', () => {
        const q = new ReplyQueue();
        const low = mockEnvelope('low');
        low.priority = 10;
        const high = mockEnvelope('high');
        high.priority = 90;
        q.enqueue(low);
        q.enqueue(high);
        const first = q.dequeue();
        expect(first!.sessionId).toBe('sess_high');
    });
});

describe('typing', () => {
    it('should track typing state', () => {
        const sender = async () => {};
        startTyping('ch1', 'discord', sender);
        expect(isTyping('ch1', 'discord')).toBe(true);
        stopTyping('ch1', 'discord');
        expect(isTyping('ch1', 'discord')).toBe(false);
    });

    it('should stop all typing', () => {
        const sender = async () => {};
        startTyping('ch1', 'discord', sender);
        startTyping('ch2', 'telegram', sender);
        stopAllTyping();
        expect(isTyping('ch1', 'discord')).toBe(false);
        expect(isTyping('ch2', 'telegram')).toBe(false);
    });
});
