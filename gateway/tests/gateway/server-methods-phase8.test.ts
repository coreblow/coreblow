import { describe, it, expect, vi } from 'vitest';
import { coreGatewayHandlers } from '../../src/gateway/server-methods.js';

describe('Gateway RPC - End-to-End Surface Tests (Phase 8 Mocks)', () => {

    function createMockReq() { return {}; }
    function createMockClient() { return {}; }
    function createMockContext() { return {}; }

    function testRpc(method: string, params: object): any {
        const handler = coreGatewayHandlers[method];
        let result: any = null;
        let didRespond = false;
        
        handler({
            params,
            req: createMockReq() as any,
            client: createMockClient() as any,
            context: createMockContext() as any,
            respond: (ok, payload, error) => {
                didRespond = true;
                result = { ok, payload, error };
            }
        });
        
        return result;
    }

    it('chat.send should return mock started status', () => {
        const res = testRpc('chat.send', { sessionKey: 'test_session', message: 'Hello!' });
        expect(res.ok).toBe(true);
        expect(res.payload.status).toBe('started');
    });

    it('sessions.create should mock creation', () => {
        const res = testRpc('sessions.create', {});
        expect(res.ok).toBe(true);
        expect(res.payload.sessionKey).toBeDefined();
    });

    it('agents.list should return mock agent', () => {
        const res = testRpc('agents.list', {});
        expect(res.ok).toBe(true);
        expect(res.payload.length).toBeGreaterThan(0);
        expect(res.payload[0].id).toBe('builtin_agent');
    });

    it('system-event should validate params successfully', () => {
        const res = testRpc('system-event', { text: 'heartbeat' });
        expect(res.ok).toBe(true);
    });

    it('talk.start should be rejected as unavailable', () => {
        const res = testRpc('talk.start', {});
        expect(res.ok).toBe(false);
        expect(res.error.code).toBe('unavailable');
    });

    it('nodes.invoke should be rejected as unavailable', () => {
        const res = testRpc('node.invoke', { nodeId: 'foo', command: 'bar' });
        expect(res.ok).toBe(false);
        expect(res.error.code).toBe('unavailable');
    });
});
