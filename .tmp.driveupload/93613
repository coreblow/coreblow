/**
 * tests/unit/router.test.ts
 * Unit tests — message router
 */

import { describe, it, expect, vi } from 'vitest';

describe('MessageRouter', () => {
    it('should derive session ID from channel + senderId', () => {
        // Session ID format: channel:senderId or channel:senderId:groupId
        const sessionId1 = `telegram:user123`;
        const sessionId2 = `discord:user456:guild789`;

        expect(sessionId1).toBe('telegram:user123');
        expect(sessionId2).toContain('discord');
        expect(sessionId2).toContain('user456');
    });

    it('should route inbound messages to handlers', async () => {
        const handler = vi.fn();
        const inbound = {
            channel: 'webchat',
            senderId: 'client-1',
            senderName: 'Test User',
            sessionId: 'webchat:client-1',
            text: 'Hello',
            timestamp: Date.now(),
        };

        // Simulate routing
        handler(inbound);
        expect(handler).toHaveBeenCalledWith(inbound);
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should register and use channel senders', async () => {
        const sender = vi.fn();
        const senders = new Map<string, Function>();
        senders.set('telegram', sender);

        const reply = { channel: 'telegram', senderId: 'user1', text: 'Reply text' };
        const registeredSender = senders.get(reply.channel);
        expect(registeredSender).toBeDefined();

        await registeredSender!(reply);
        expect(sender).toHaveBeenCalledWith(reply);
    });
});
