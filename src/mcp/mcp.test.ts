import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CoreBlowChannelBridge } from './channel-bridge.js';
import {
    toText,
    toConversation,
    matchEventFilter,
    resolveMessageId,
    summarizeResult,
    extractAttachmentsFromMessage,
    normalizeApprovalId,
    type SessionRow,
    type QueueEvent,
    type WaitFilter,
} from './channel-types.js';

describe('MCP Module', () => {
    describe('channel-types.ts: utility functions', () => {
        it('toText returns trimmed string or undefined', () => {
            expect(toText('hello')).toBe('hello');
            expect(toText('  spaces  ')).toBe('spaces');
            expect(toText('')).toBeUndefined();
            expect(toText(null)).toBeUndefined();
            expect(toText(42)).toBeUndefined();
        });

        it('toConversation maps SessionRow to ConversationDescriptor', () => {
            const row: SessionRow = { id: 's1', channel: 'discord', model: 'gpt-4o', createdAt: 1000 };
            const conv = toConversation(row);
            expect(conv).not.toBeNull();
            expect(conv!.sessionKey).toBe('s1');
            expect(conv!.channel).toBe('discord');
            expect(conv!.startedAt).toBe(1000);
        });

        it('toConversation returns null for falsy input', () => {
            expect(toConversation(null as any)).toBeNull();
            expect(toConversation(undefined as any)).toBeNull();
        });

        it('matchEventFilter matches by type', () => {
            const event: QueueEvent = { type: 'message', channel: 'slack' };
            expect(matchEventFilter(event, { type: 'message' })).toBe(true);
            expect(matchEventFilter(event, { type: 'approval' })).toBe(false);
        });

        it('matchEventFilter matches by channel', () => {
            const event: QueueEvent = { type: 'message', channel: 'slack' };
            expect(matchEventFilter(event, { channel: 'slack' })).toBe(true);
            expect(matchEventFilter(event, { channel: 'discord' })).toBe(false);
        });

        it('matchEventFilter matches empty filter (matches all)', () => {
            const event: QueueEvent = { type: 'message' };
            expect(matchEventFilter(event, {})).toBe(true);
        });

        it('resolveMessageId extracts id from entry', () => {
            expect(resolveMessageId({ id: 'msg-1' })).toBe('msg-1');
            expect(resolveMessageId({})).toBeUndefined();
        });

        it('resolveMessageId extracts id from __coreblow namespace', () => {
            expect(resolveMessageId({ __coreblow: { id: 'cb-1' } })).toBe('cb-1');
        });

        it('summarizeResult formats content correctly', () => {
            const result = summarizeResult('Conversations', 5);
            expect(result.content[0].type).toBe('text');
            expect(result.content[0].text).toBe('Conversations: 5');
        });

        it('extractAttachmentsFromMessage extracts array', () => {
            expect(extractAttachmentsFromMessage({ attachments: [1, 2] })).toEqual([1, 2]);
            expect(extractAttachmentsFromMessage({})).toEqual([]);
            expect(extractAttachmentsFromMessage(null)).toEqual([]);
        });

        it('normalizeApprovalId validates strings', () => {
            expect(normalizeApprovalId('abc-123')).toBe('abc-123');
            expect(normalizeApprovalId('')).toBeUndefined();
            expect(normalizeApprovalId(42)).toBeUndefined();
        });
    });

    describe('channel-bridge.ts: CoreBlowChannelBridge', () => {
        let bridge: CoreBlowChannelBridge;

        beforeEach(() => {
            bridge = new CoreBlowChannelBridge({}, { verbose: false });
        });

        it('starts and stops correctly', async () => {
            await bridge.start();
            // Second start is idempotent
            await bridge.start();
            await bridge.close();
        });

        it('sends message and gets success', async () => {
            await bridge.start();
            const result = await bridge.sendMessage('session-1', 'Hello');
            expect(result.success).toBe(true);
            expect(result.messageId).toBeDefined();
            expect(result.messageId).toContain('msg_');
        });

        it('listConversations returns empty by default', async () => {
            await bridge.start();
            const convs = await bridge.listConversations();
            expect(convs).toEqual([]);
        });

        it('getConversationHistory returns empty messages', async () => {
            const history = await bridge.getConversationHistory('session-x');
            expect(history.messages).toEqual([]);
        });

        it('handles approval lifecycle', async () => {
            await bridge.start();

            // Add a pending approval via permission request
            await bridge.handleClaudePermissionRequest({
                requestId: 'req-1',
                toolName: 'bash',
                description: 'Run command',
                inputPreview: 'ls -la',
            });

            const pending = await bridge.listPendingApprovals();
            expect(pending.length).toBe(1);
            expect(pending[0].id).toBe('req-1');

            // Handle the approval
            const handled = await bridge.handleApproval('req-1', 'allow' as any);
            expect(handled).toBe(true);

            // Verify it's removed
            const afterApproval = await bridge.listPendingApprovals();
            expect(afterApproval.length).toBe(0);
        });

        it('handleApproval returns false for unknown id', async () => {
            const handled = await bridge.handleApproval('unknown-id', 'deny' as any);
            expect(handled).toBe(false);
        });

        it('waitForEvent returns buffered event immediately', async () => {
            await bridge.start();
            await bridge.sendMessage('s1', 'test'); // pushes event to buffer

            const event = await bridge.waitForEvent({ type: 'message' }, 100);
            expect(event).not.toBeNull();
            expect(event!.type).toBe('message');
        });

        it('waitForEvent times out when no matching event', async () => {
            const event = await bridge.waitForEvent({ type: 'nonexistent' }, 50);
            expect(event).toBeNull();
        });

        it('close resolves all pending waiters with null', async () => {
            await bridge.start();

            // Start a waiter that won't match anything
            const waitPromise = bridge.waitForEvent({ type: 'special' }, 30000);

            // Close immediately
            await bridge.close();

            const result = await waitPromise;
            expect(result).toBeNull();
        });
    });
});
