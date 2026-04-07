/**
 * CoreBlow Phase 41 — MCP Channel Bridge Extended Tests
 *
 * Layer 1 (Edge Cases):
 *   - MCP Bridge: start/close, filter matching, message sending, pending approvals
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { CoreBlowChannelBridge } from '../../src/mcp/channel-bridge.js';

describe('MCP Channel Bridge — Extended', () => {
    let bridge: CoreBlowChannelBridge;

    beforeEach(() => {
        bridge = new CoreBlowChannelBridge({});
    });

    it('should start and close without errors', async () => {
        await bridge.start();
        expect(true).toBe(true); // Should not throw
        await bridge.close();
    });

    it('should send message and generate event', async () => {
        await bridge.start();
        // Fire message
        const res = await bridge.sendMessage('session-1', 'Hello world');
        expect(res.success).toBe(true);
        expect(res.messageId).toBeDefined();

        // Check if event was buffered
        const event = await bridge.waitForEvent({ type: 'message', sessionKey: 'session-1' }, 10);
        expect(event).not.toBeNull();
        expect((event as any)?.text).toBe('Hello world');
    });

    it('should resolve waitForEvent when event occurs', async () => {
        await bridge.start();

        const waitPromise = bridge.waitForEvent({ type: 'message' }, 500);

        // Send message slightly after waiting
        setTimeout(() => bridge.sendMessage('s1', 'Delayed msg'), 50);

        const event = await waitPromise;
        expect(event).not.toBeNull();
        expect((event as any)?.text).toBe('Delayed msg');
    });

    it('should timeout waitForEvent if no event', async () => {
        await bridge.start();
        const event = await bridge.waitForEvent({ type: 'ghost_event' }, 50);
        expect(event).toBeNull();
    });

    it('should handle claude permission requests (approvals)', async () => {
        await bridge.start();
        await bridge.handleClaudePermissionRequest({
            requestId: 'req-1', toolName: 'bash', description: 'Run cmd', inputPreview: {},
        });

        const pending = await bridge.listPendingApprovals();
        expect(pending).toHaveLength(1);
        expect(pending[0]?.id).toBe('req-1');

        // Resolve
        const handled = await bridge.handleApproval('req-1', 'approved');
        expect(handled).toBe(true);
        expect(await bridge.listPendingApprovals()).toHaveLength(0);

        // Event generated for approval resolve
        const event = await bridge.waitForEvent({ type: 'exec_approval_resolved' }, 10);
        expect((event as any)?.raw?.decision).toBe('approved');
    });

    it('should return false for unknown approvals', async () => {
        const handled = await bridge.handleApproval('unknown-id', 'approved');
        expect(handled).toBe(false);
    });

    it('should list conversations (mocked gateway)', async () => {
        const convos = await bridge.listConversations();
        expect(convos).toEqual([]); // Internal gateway fetch returns empty []
    });
});
