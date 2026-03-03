import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentStreamBridge } from './agent-stream-bridge.js';

describe('AgentStreamBridge', () => {
    let bridge: AgentStreamBridge;

    beforeEach(() => {
        bridge = new AgentStreamBridge();
    });

    describe('subscribe', () => {
        it('registers a client', () => {
            bridge.subscribe('session1', 'client1', vi.fn());
            expect(bridge.getSubscriberCount('session1')).toBe(1);
        });

        it('supports multiple clients per session', () => {
            bridge.subscribe('session1', 'client1', vi.fn());
            bridge.subscribe('session1', 'client2', vi.fn());
            expect(bridge.getSubscriberCount('session1')).toBe(2);
        });

        it('returns unsubscribe function', () => {
            const unsub = bridge.subscribe('session1', 'client1', vi.fn());
            expect(typeof unsub).toBe('function');
            unsub();
            expect(bridge.getSubscriberCount('session1')).toBe(0);
        });
    });

    describe('unsubscribe', () => {
        it('removes specific client', () => {
            bridge.subscribe('session1', 'client1', vi.fn());
            bridge.subscribe('session1', 'client2', vi.fn());
            bridge.unsubscribe('session1', 'client1');
            expect(bridge.getSubscriberCount('session1')).toBe(1);
        });

        it('deletes session when last client removed', () => {
            bridge.subscribe('session1', 'client1', vi.fn());
            bridge.unsubscribe('session1', 'client1');
            expect(bridge.getSubscriberCount('session1')).toBe(0);
        });

        it('handles non-existent session', () => {
            expect(() => bridge.unsubscribe('ghost', 'client1')).not.toThrow();
        });
    });

    describe('createStreamHandler', () => {
        it('sends chunks to all subscribers', () => {
            const send1 = vi.fn();
            const send2 = vi.fn();
            bridge.subscribe('session1', 'client1', send1);
            bridge.subscribe('session1', 'client2', send2);

            const handler = bridge.createStreamHandler('session1');
            handler({ type: 'text', content: 'hello' } as any);

            expect(send1).toHaveBeenCalledOnce();
            expect(send2).toHaveBeenCalledOnce();
            const payload = JSON.parse(send1.mock.calls[0][0]);
            expect(payload.event).toBe('stream');
            expect(payload.sessionId).toBe('session1');
        });

        it('handles disconnected clients gracefully', () => {
            const goodSend = vi.fn();
            const badSend = vi.fn(() => { throw new Error('disconnected'); });
            bridge.subscribe('session1', 'good', goodSend);
            bridge.subscribe('session1', 'bad', badSend);

            const handler = bridge.createStreamHandler('session1');
            expect(() => handler({ type: 'text' } as any)).not.toThrow();
            expect(goodSend).toHaveBeenCalledOnce();
        });
    });

    describe('getSubscriberCount', () => {
        it('returns 0 for unknown session', () => {
            expect(bridge.getSubscriberCount('nonexistent')).toBe(0);
        });
    });

    describe('clear', () => {
        it('removes all subscriptions', () => {
            bridge.subscribe('s1', 'c1', vi.fn());
            bridge.subscribe('s2', 'c2', vi.fn());
            bridge.clear();
            expect(bridge.getSubscriberCount('s1')).toBe(0);
            expect(bridge.getSubscriberCount('s2')).toBe(0);
        });
    });
});
