import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WsHandler } from './ws-handler.js';

function createMockWs() {
    const sent: string[] = [];
    return {
        ws: {
            send: (data: string) => sent.push(data),
            close: vi.fn(),
        },
        sent,
        messageHandlers: [] as ((data: string) => void)[],
        closeHandlers: [] as (() => void)[],
        onMessage: (h: (data: string) => void) => { createMockWs.lastHandlers!.messageHandlers.push(h); },
        onClose: (h: () => void) => { createMockWs.lastHandlers!.closeHandlers.push(h); },
    };
}
createMockWs.lastHandlers = null as any;

function connectClient(handler: WsHandler) {
    const sent: string[] = [];
    const closeFn = vi.fn();
    let msgHandler: ((data: string) => void) | null = null;
    let closeHandler: (() => void) | null = null;

    const client = handler.onConnect(
        { send: (d) => sent.push(d), close: closeFn },
        (h) => { msgHandler = h; },
        (h) => { closeHandler = h; },
    );

    return { client, sent, closeFn, sendMessage: (d: string) => msgHandler?.(d), disconnect: () => closeHandler?.() };
}

describe('WsHandler', () => {
    let handler: WsHandler;

    beforeEach(() => { handler = new WsHandler(); });
    afterEach(() => { handler.closeAll(); });

    // --- Connection ---
    it('connects a client', () => {
        const { client } = connectClient(handler);
        expect(client.id).toBeTruthy();
        expect(client.authenticated).toBe(false);
        expect(handler.getClientCount()).toBe(1);
    });

    it('tracks multiple clients', () => {
        connectClient(handler);
        connectClient(handler);
        connectClient(handler);
        expect(handler.getClientCount()).toBe(3);
    });

    it('removes client on disconnect', () => {
        const { disconnect } = connectClient(handler);
        disconnect();
        expect(handler.getClientCount()).toBe(0);
    });

    // --- Ping/Pong ---
    it('responds to ping', async () => {
        const { sent, sendMessage } = connectClient(handler);
        sendMessage(JSON.stringify({ method: 'ping', id: '1' }));
        await vi.waitFor(() => expect(sent.length).toBe(1));
        const response = JSON.parse(sent[0]);
        expect(response.result.pong).toBe(true);
    });

    // --- Method Dispatch ---
    it('dispatches registered method', async () => {
        handler.registerMethod('greet', async (client, params) => {
            return { message: `Hello ${params.name}` };
        });
        const { sent, sendMessage } = connectClient(handler);
        sendMessage(JSON.stringify({ method: 'greet', id: 'r1', params: { name: 'World' } }));
        await vi.waitFor(() => expect(sent.length).toBe(1));
        const response = JSON.parse(sent[0]);
        expect(response.id).toBe('r1');
        expect(response.result.message).toBe('Hello World');
    });

    it('returns error for unknown method', async () => {
        const { sent, sendMessage } = connectClient(handler);
        sendMessage(JSON.stringify({ method: 'nonexistent', id: 'r1' }));
        await vi.waitFor(() => expect(sent.length).toBe(1));
        const response = JSON.parse(sent[0]);
        expect(response.error.code).toBe('UNKNOWN_METHOD');
    });

    it('returns error for invalid JSON', async () => {
        const { sent, sendMessage } = connectClient(handler);
        sendMessage('not json at all');
        await vi.waitFor(() => expect(sent.length).toBe(1));
        const response = JSON.parse(sent[0]);
        expect(response.error.code).toBe('PARSE_ERROR');
    });

    it('returns error for missing method', async () => {
        const { sent, sendMessage } = connectClient(handler);
        sendMessage(JSON.stringify({ params: { foo: 1 } }));
        await vi.waitFor(() => expect(sent.length).toBe(1));
        const response = JSON.parse(sent[0]);
        expect(response.error.code).toBe('INVALID_METHOD');
    });

    it('catches handler errors', async () => {
        handler.registerMethod('fail', async () => { throw new Error('Oops'); });
        const { sent, sendMessage } = connectClient(handler);
        sendMessage(JSON.stringify({ method: 'fail', id: 'r1' }));
        await vi.waitFor(() => expect(sent.length).toBe(1));
        const response = JSON.parse(sent[0]);
        expect(response.error.code).toBe('HANDLER_ERROR');
        expect(response.error.message).toContain('Oops');
    });

    // --- Broadcast ---
    it('broadcasts to all clients', () => {
        const c1 = connectClient(handler);
        const c2 = connectClient(handler);
        handler.broadcast('update', { data: 'hi' });
        expect(c1.sent).toHaveLength(1);
        expect(c2.sent).toHaveLength(1);
        expect(JSON.parse(c1.sent[0]).event).toBe('update');
    });

    it('skips unauthenticated on requireAuth', () => {
        const c1 = connectClient(handler);
        c1.client.authenticated = true;
        const c2 = connectClient(handler);
        handler.broadcast('secret', { data: 'classified' }, { requireAuth: true });
        expect(c1.sent).toHaveLength(1);
        expect(c2.sent).toHaveLength(0);
    });

    // --- CloseAll ---
    it('closes all clients', () => {
        const c1 = connectClient(handler);
        const c2 = connectClient(handler);
        handler.closeAll('bye');
        expect(c1.closeFn).toHaveBeenCalledWith(1001, 'bye');
        expect(c2.closeFn).toHaveBeenCalledWith(1001, 'bye');
        expect(handler.getClientCount()).toBe(0);
    });

    // --- Multiple Methods ---
    it('supports multiple registered methods', async () => {
        handler.registerMethod('add', async (_, p) => ({ sum: (p.a as number) + (p.b as number) }));
        handler.registerMethod('mul', async (_, p) => ({ product: (p.a as number) * (p.b as number) }));

        const { sent, sendMessage } = connectClient(handler);
        sendMessage(JSON.stringify({ method: 'add', id: '1', params: { a: 3, b: 4 } }));
        await vi.waitFor(() => expect(sent.length).toBe(1));
        expect(JSON.parse(sent[0]).result.sum).toBe(7);

        sendMessage(JSON.stringify({ method: 'mul', id: '2', params: { a: 3, b: 4 } }));
        await vi.waitFor(() => expect(sent.length).toBe(2));
        expect(JSON.parse(sent[1]).result.product).toBe(12);
    });

    // --- Edge Cases ---
    it('handles empty message', async () => {
        const { sent, sendMessage } = connectClient(handler);
        sendMessage('');
        await vi.waitFor(() => expect(sent.length).toBe(1));
        expect(JSON.parse(sent[0]).error).toBeDefined();
    });

    it('handles message without id', async () => {
        handler.registerMethod('test', async () => 'ok');
        const { sent, sendMessage } = connectClient(handler);
        sendMessage(JSON.stringify({ method: 'test' }));
        await vi.waitFor(() => expect(sent.length).toBe(1));
        const response = JSON.parse(sent[0]);
        expect(response.id).toBeNull();
        expect(response.result).toBe('ok');
    });
});
