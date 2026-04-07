// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import { WebSocketManager } from './websocket-manager.js';
import { GracefulShutdown } from './graceful-shutdown.js';
import { UsageBilling } from './usage-billing.js';

describe('Gateway Infrastructure — Phase 7', () => {

    // ─── WebSocket Manager ─────────────────────────────────────

    describe('WebSocketManager', () => {
        let ws: WebSocketManager;

        beforeEach(() => {
            ws = new WebSocketManager();
        });

        it('connects a client', () => {
            const conn = ws.connect('alice');
            expect(conn.id).toBeTruthy();
            expect(conn.userId).toBe('alice');
            expect(conn.status).toBe('open');
            expect(ws.count()).toBe(1);
        });

        it('disconnects client', () => {
            const conn = ws.connect();
            ws.disconnect(conn.id);
            expect(ws.count()).toBe(0);
            expect(ws.get(conn.id)).toBeNull();
        });

        it('joins and leaves rooms', () => {
            const conn = ws.connect('bob');
            ws.joinRoom(conn.id, 'general');
            ws.joinRoom(conn.id, 'dev');
            expect(ws.getRoomMembers('general')).toContain(conn.id);
            expect(ws.listRooms()).toHaveLength(2);
            ws.leaveRoom(conn.id, 'general');
            expect(ws.getRoomMembers('general')).not.toContain(conn.id);
        });

        it('auto-removes empty rooms', () => {
            const conn = ws.connect();
            ws.joinRoom(conn.id, 'temp');
            ws.leaveRoom(conn.id, 'temp');
            expect(ws.listRooms()).toHaveLength(0);
        });

        it('sends to specific connection', () => {
            const conn = ws.connect();
            expect(ws.send(conn.id, 'ping', { ts: 1 })).toBe(true);
            expect(conn.messageCount).toBe(1);
        });

        it('send fails for closed connection', () => {
            const conn = ws.connect();
            ws.disconnect(conn.id);
            expect(ws.send(conn.id, 'ping', {})).toBe(false);
        });

        it('broadcasts to room', () => {
            const c1 = ws.connect('a');
            const c2 = ws.connect('b');
            const c3 = ws.connect('c');
            ws.joinRoom(c1.id, 'lobby');
            ws.joinRoom(c2.id, 'lobby');
            // c3 not in lobby
            const sent = ws.broadcast('lobby', 'msg', { text: 'hello' });
            expect(sent).toBe(2);
        });

        it('broadcast excludes sender', () => {
            const c1 = ws.connect();
            const c2 = ws.connect();
            ws.joinRoom(c1.id, 'room');
            ws.joinRoom(c2.id, 'room');
            const sent = ws.broadcast('room', 'msg', {}, c1.id);
            expect(sent).toBe(1);
        });

        it('broadcastAll sends to everyone', () => {
            ws.connect(); ws.connect(); ws.connect();
            expect(ws.broadcastAll('alert', { level: 'info' })).toBe(3);
        });

        it('disconnect cleans up room memberships', () => {
            const conn = ws.connect();
            ws.joinRoom(conn.id, 'r1');
            ws.joinRoom(conn.id, 'r2');
            ws.disconnect(conn.id);
            expect(ws.getRoomMembers('r1')).not.toContain(conn.id);
            expect(ws.listRooms()).toHaveLength(0);
        });

        it('getStats returns correct counts', () => {
            ws.connect(); ws.connect();
            const c = ws.connect();
            ws.joinRoom(c.id, 'test');
            ws.send(c.id, 'ping', {});
            const stats = ws.getStats();
            expect(stats.connections).toBe(3);
            expect(stats.rooms).toBe(1);
            expect(stats.totalMessages).toBe(1);
        });
    });

    // ─── Graceful Shutdown ─────────────────────────────────────

    describe('GracefulShutdown', () => {
        let shutdown: GracefulShutdown;

        beforeEach(() => {
            shutdown = new GracefulShutdown();
        });

        it('registers hooks', () => {
            shutdown.register({ name: 'db', order: 1, handler: async () => {} });
            shutdown.register({ name: 'http', order: 2, handler: async () => {} });
            expect(shutdown.count()).toBe(2);
            expect(shutdown.list().map(h => h.name)).toEqual(['db', 'http']);
        });

        it('executes hooks in order', async () => {
            const order: string[] = [];
            shutdown.register({ name: 'second', order: 2, handler: async () => { order.push('second'); } });
            shutdown.register({ name: 'first', order: 1, handler: async () => { order.push('first'); } });
            const result = await shutdown.shutdown();
            expect(order).toEqual(['first', 'second']);
            expect(result.completed).toEqual(['first', 'second']);
        });

        it('handles hook failure', async () => {
            shutdown.register({ name: 'broken', order: 1, handler: async () => { throw new Error('db down'); } });
            const result = await shutdown.shutdown();
            expect(result.failed).toHaveLength(1);
            expect(result.failed[0]!.name).toBe('broken');
            expect(result.failed[0]!.error).toBe('db down');
        });

        it('handles hook timeout', async () => {
            shutdown.register({
                name: 'slow', order: 1, timeoutMs: 50,
                handler: () => new Promise(r => setTimeout(r, 5000)),
            });
            const result = await shutdown.shutdown();
            expect(result.timedOut).toContain('slow');
        });

        it('tracks total duration', async () => {
            shutdown.register({ name: 'fast', order: 1, handler: async () => {} });
            const result = await shutdown.shutdown();
            expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
        });

        it('getLastResult returns previous result', async () => {
            shutdown.register({ name: 'ok', order: 1, handler: async () => {} });
            expect(shutdown.getLastResult()).toBeNull();
            await shutdown.shutdown();
            expect(shutdown.getLastResult()).not.toBeNull();
        });
    });

    // ─── Usage Billing ─────────────────────────────────────────

    describe('UsageBilling', () => {
        let billing: UsageBilling;

        beforeEach(() => {
            billing = new UsageBilling();
        });

        it('records usage', () => {
            billing.record('tenant-1', 'api_calls', 100);
            billing.record('tenant-1', 'tokens', 5000);
            expect(billing.count()).toBe(2);
        });

        it('getCurrentUsage aggregates', () => {
            billing.record('t1', 'api_calls', 50);
            billing.record('t1', 'api_calls', 30);
            billing.record('t2', 'api_calls', 10);
            const usage = billing.getCurrentUsage('t1');
            expect(usage.api_calls).toBe(80);
        });

        it('generates invoice', () => {
            const now = Date.now();
            billing.record('t1', 'api_calls', 1000);
            billing.record('t1', 'tokens', 50000);
            const invoice = billing.generateInvoice('t1', now - 10000, now + 10000);
            expect(invoice.id).toContain('inv-');
            expect(invoice.tenantId).toBe('t1');
            expect(invoice.lineItems).toHaveLength(2);
            expect(invoice.totalAmount).toBeGreaterThan(0);
            expect(invoice.currency).toBe('USD');
        });

        it('setPrice changes unit price', () => {
            billing.setPrice('api_calls', 0.01);
            billing.record('t1', 'api_calls', 100);
            const now = Date.now();
            const invoice = billing.generateInvoice('t1', now - 1000, now + 1000);
            expect(invoice.lineItems[0]!.unitPrice).toBe(0.01);
            expect(invoice.lineItems[0]!.total).toBe(1);
        });

        it('getInvoices returns tenant invoices', () => {
            const now = Date.now();
            billing.record('t1', 'api_calls', 10);
            billing.record('t2', 'api_calls', 5);
            billing.generateInvoice('t1', now - 1000, now + 1000);
            billing.generateInvoice('t2', now - 1000, now + 1000);
            expect(billing.getInvoices('t1')).toHaveLength(1);
            expect(billing.getInvoices('t2')).toHaveLength(1);
        });

        it('getTotalRevenue sums all invoices', () => {
            const now = Date.now();
            billing.record('t1', 'api_calls', 1000);
            billing.generateInvoice('t1', now - 1000, now + 1000);
            expect(billing.getTotalRevenue()).toBeGreaterThan(0);
        });

        it('empty invoice for no usage', () => {
            const now = Date.now();
            const invoice = billing.generateInvoice('empty', now - 1000, now + 1000);
            expect(invoice.lineItems).toHaveLength(0);
            expect(invoice.totalAmount).toBe(0);
        });
    });
});
