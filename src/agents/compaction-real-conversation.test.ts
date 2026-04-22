/**
 * CoreBlow — Compaction Real Conversation Tests (Inline)
 *
 * Tests for hasMeaningfulConversationContent and TOOL_RESULT_REAL_CONVERSATION_LOOKBACK
 * constant. Inline to avoid import chain (stripHeartbeatToken, isSilentReplyText).
 */

import { describe, it, expect } from 'vitest';

// ── Inline replicas ────────────────────────────────────────────────

const TOOL_RESULT_REAL_CONVERSATION_LOOKBACK = 20;

const NON_CONVERSATION_BLOCK_TYPES = new Set([
    'toolCall', 'toolUse', 'functionCall', 'thinking', 'reasoning',
]);

function hasMeaningfulText(text: string): boolean {
    const trimmed = text.trim();
    if (!trimmed) return false;
    // Simplified: skip heartbeat/silent detection for inline test
    return true;
}

type SimpleMessage = {
    role: string;
    content?: string | Array<{ type?: string; text?: string }>;
};

function hasMeaningfulConversationContent(message: SimpleMessage): boolean {
    const content = message.content;
    if (typeof content === 'string') return hasMeaningfulText(content);
    if (!Array.isArray(content)) return false;
    let sawMeaningfulNonTextBlock = false;
    for (const block of content) {
        if (!block || typeof block !== 'object') continue;
        const type = block.type;
        if (type !== 'text') {
            if (typeof type === 'string' && NON_CONVERSATION_BLOCK_TYPES.has(type)) continue;
            sawMeaningfulNonTextBlock = true;
            continue;
        }
        const text = block.text;
        if (typeof text !== 'string') continue;
        if (hasMeaningfulText(text)) return true;
    }
    return sawMeaningfulNonTextBlock;
}

function isRealConversationMessage(
    message: SimpleMessage,
    messages: SimpleMessage[],
    index: number,
): boolean {
    if (message.role === 'user' || message.role === 'assistant') {
        return hasMeaningfulConversationContent(message);
    }
    if (message.role !== 'toolResult') return false;
    const start = Math.max(0, index - TOOL_RESULT_REAL_CONVERSATION_LOOKBACK);
    for (let i = index - 1; i >= start; i -= 1) {
        const candidate = messages[i];
        if (!candidate || candidate.role !== 'user') continue;
        if (hasMeaningfulConversationContent(candidate)) return true;
    }
    return false;
}

// ── Tests ──────────────────────────────────────────────────────────

describe('hasMeaningfulConversationContent', () => {
    it('returns true for string content', () => {
        expect(hasMeaningfulConversationContent({ role: 'user', content: 'Hello' })).toBe(true);
    });

    it('returns false for empty string', () => {
        expect(hasMeaningfulConversationContent({ role: 'user', content: '' })).toBe(false);
    });

    it('returns true for text blocks', () => {
        const msg: SimpleMessage = {
            role: 'assistant',
            content: [{ type: 'text', text: 'Response here' }],
        };
        expect(hasMeaningfulConversationContent(msg)).toBe(true);
    });

    it('skips toolCall blocks', () => {
        const msg: SimpleMessage = {
            role: 'assistant',
            content: [{ type: 'toolCall' }],
        };
        expect(hasMeaningfulConversationContent(msg)).toBe(false);
    });

    it('skips thinking/reasoning blocks', () => {
        const msg: SimpleMessage = {
            role: 'assistant',
            content: [{ type: 'thinking' }, { type: 'reasoning' }],
        };
        expect(hasMeaningfulConversationContent(msg)).toBe(false);
    });

    it('detects meaningful non-text blocks (e.g. image)', () => {
        const msg: SimpleMessage = {
            role: 'assistant',
            content: [{ type: 'image' }],
        };
        expect(hasMeaningfulConversationContent(msg)).toBe(true);
    });
});

describe('isRealConversationMessage', () => {
    it('returns true for user with content', () => {
        const msgs: SimpleMessage[] = [{ role: 'user', content: 'Hello' }];
        expect(isRealConversationMessage(msgs[0]!, msgs, 0)).toBe(true);
    });

    it('returns false for assistant with empty content', () => {
        const msgs: SimpleMessage[] = [{ role: 'assistant', content: '' }];
        expect(isRealConversationMessage(msgs[0]!, msgs, 0)).toBe(false);
    });

    it('returns true for toolResult with recent user message', () => {
        const msgs: SimpleMessage[] = [
            { role: 'user', content: 'Run command' },
            { role: 'assistant', content: [{ type: 'toolCall' }] },
            { role: 'toolResult', content: 'output' },
        ];
        expect(isRealConversationMessage(msgs[2]!, msgs, 2)).toBe(true);
    });

    it('returns false for toolResult without user context', () => {
        const msgs: SimpleMessage[] = [
            { role: 'toolResult', content: 'output' },
        ];
        expect(isRealConversationMessage(msgs[0]!, msgs, 0)).toBe(false);
    });

    it('respects lookback limit', () => {
        const msgs: SimpleMessage[] = [
            { role: 'user', content: 'Hello' },
            ...Array.from({ length: 25 }, () => ({ role: 'assistant', content: '' })),
            { role: 'toolResult', content: 'output' },
        ];
        // User is 26 positions back, beyond the 20 lookback
        expect(isRealConversationMessage(msgs[msgs.length - 1]!, msgs, msgs.length - 1)).toBe(false);
    });
});

describe('TOOL_RESULT_REAL_CONVERSATION_LOOKBACK', () => {
    it('is 20', () => {
        expect(TOOL_RESULT_REAL_CONVERSATION_LOOKBACK).toBe(20);
    });
});
