/**
 * CoreBlow Phase 26 — Real-time & Streaming Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { WebSocketManager } from '../../src/gateway/websocket-manager.js';
import { SSEHandler } from '../../src/gateway/sse-handler.js';
import { StreamProcessor } from '../../src/gateway/stream-processor.js';
import { ConnectionPool } from '../../src/infra/connection-pool.js';
import { TokenBucket } from '../../src/security/token-bucket.js';

// ================================================================
// WebSocket Manager Tests
// ================================================================
describe('WebSocketManager', () => {
    let ws: WebSocketManager;
    beforeEach(() => { ws = new WebSocketManager(); });

    it('should connect clients', () => {
        const conn = ws.connect('user1');
        expect(conn.id).toBeTruthy();
        expect(ws.count()).toBe(1);
    });

    it('should disconnect clients', () => {
        const conn = ws.connect();
        ws.disconnect(conn.id);
        expect(ws.count()).toBe(0);
    });

    it('should join rooms', () => {
        const conn = ws.connect();
        ws.joinRoom(conn.id, 'chat');
        expect(ws.getRoomMembers('chat')).toContain(conn.id);
    });

    it('should leave rooms', () => {
        const conn = ws.connect();
        ws.joinRoom(conn.id, 'chat');
        ws.leaveRoom(conn.id, 'chat');
        expect(ws.getRoomMembers('chat')).toHaveLength(0);
    });

    it('should send to connection', () => {
        const conn = ws.connect();
        expect(ws.send(conn.id, 'message', { text: 'hi' })).toBe(true);
    });

    it('should broadcast to room', () => {
        const c1 = ws.connect();
        const c2 = ws.connect();
        ws.joinRoom(c1.id, 'room1');
        ws.joinRoom(c2.id, 'room1');
        expect(ws.broadcast('room1', 'msg', 'hello')).toBe(2);
    });

    it('should broadcast all', () => {
        ws.connect(); ws.connect(); ws.connect();
        expect(ws.broadcastAll('ping', {})).toBe(3);
    });

    it('should list rooms', () => {
        const c = ws.connect();
        ws.joinRoom(c.id, 'a');
        ws.joinRoom(c.id, 'b');
        expect(ws.listRooms()).toHaveLength(2);
    });

    it('should get stats', () => {
        ws.connect();
        const stats = ws.getStats();
        expect(stats.connections).toBe(1);
    });
});

// ================================================================
// SSE Handler Tests
// ================================================================
describe('SSEHandler', () => {
    let sse: SSEHandler;
    beforeEach(() => { sse = new SSEHandler(); });

    it('should subscribe clients', () => {
        const client = sse.subscribe('updates');
        expect(client.id).toBeTruthy();
        expect(sse.count()).toBe(1);
    });

    it('should unsubscribe', () => {
        const client = sse.subscribe('updates');
        sse.unsubscribe(client.id);
        expect(sse.count()).toBe(0);
    });

    it('should send events', () => {
        const client = sse.subscribe('ch');
        expect(sse.sendTo(client.id, { data: 'test' })).toBe(true);
    });

    it('should broadcast channel', () => {
        sse.subscribe('ch');
        sse.subscribe('ch');
        expect(sse.broadcast('ch', { data: 'hi' })).toBe(2);
    });

    it('should format SSE', () => {
        const formatted = sse.formatEvent({ id: '1', event: 'message', data: 'hello' });
        expect(formatted).toContain('id: 1');
        expect(formatted).toContain('event: message');
        expect(formatted).toContain('data: hello');
    });

    it('should list channels', () => {
        sse.subscribe('a');
        sse.subscribe('b');
        expect(sse.listChannels()).toHaveLength(2);
    });

    it('should track stats', () => {
        sse.subscribe('ch');
        const stats = sse.getStats();
        expect(stats.clients).toBe(1);
    });
});

// ================================================================
// Stream Processor Tests
// ================================================================
describe('StreamProcessor', () => {
    let proc: StreamProcessor;
    beforeEach(() => { proc = new StreamProcessor(); });

    it('should start sessions', () => {
        const s = proc.startSession();
        expect(s.status).toBe('active');
    });

    it('should push text chunks', () => {
        const s = proc.startSession();
        proc.push(s.id, 'text', 'Hello ');
        proc.push(s.id, 'text', 'World');
        expect(proc.getContent(s.id)).toBe('Hello World');
    });

    it('should complete on done', () => {
        const s = proc.startSession();
        proc.push(s.id, 'text', 'content');
        proc.push(s.id, 'done', '');
        expect(proc.get(s.id)?.status).toBe('completed');
    });

    it('should error on error chunk', () => {
        const s = proc.startSession();
        proc.push(s.id, 'error', 'failed');
        expect(proc.get(s.id)?.status).toBe('error');
    });

    it('should notify listeners', () => {
        const s = proc.startSession();
        const chunks: string[] = [];
        proc.onChunk(s.id, (c) => chunks.push(c.content));
        proc.push(s.id, 'text', 'A');
        proc.push(s.id, 'text', 'B');
        expect(chunks).toEqual(['A', 'B']);
    });

    it('should get stats', () => {
        const s = proc.startSession();
        proc.push(s.id, 'text', 'hello world test');
        const stats = proc.getSessionStats(s.id);
        expect(stats?.chunks).toBe(1);
        expect(stats?.tokens).toBeGreaterThan(0);
    });

    it('should cleanup completed', () => {
        const s = proc.startSession();
        proc.push(s.id, 'done', '');
        expect(proc.cleanup()).toBe(1);
    });
});

// ================================================================
// Connection Pool Tests
// ================================================================
describe('ConnectionPool', () => {
    let pool: ConnectionPool;
    beforeEach(() => { pool = new ConnectionPool({ maxSize: 3 }); });

    it('should acquire connections', () => {
        const conn = pool.acquire('db');
        expect(conn?.status).toBe('active');
    });

    it('should release connections', () => {
        const conn = pool.acquire('db')!;
        pool.release(conn.id);
        expect(pool.getStats().idle).toBe(1);
    });

    it('should reuse idle', () => {
        const c1 = pool.acquire('db')!;
        pool.release(c1.id);
        const c2 = pool.acquire('db');
        expect(c2?.id).toBe(c1.id);
    });

    it('should enforce max size', () => {
        pool.acquire('a');
        pool.acquire('b');
        pool.acquire('c');
        expect(pool.acquire('d')).toBeNull();
    });

    it('should close connections', () => {
        const conn = pool.acquire('db')!;
        pool.close(conn.id);
        expect(pool.count()).toBe(0);
    });

    it('should get stats', () => {
        pool.acquire('a');
        pool.acquire('b');
        const stats = pool.getStats();
        expect(stats.active).toBe(2);
        expect(stats.maxSize).toBe(3);
    });

    it('should drain all', () => {
        pool.acquire('a');
        pool.acquire('b');
        expect(pool.drain()).toBe(2);
    });
});

// ================================================================
// Token Bucket Tests
// ================================================================
describe('TokenBucket', () => {
    let bucket: TokenBucket;
    beforeEach(() => { bucket = new TokenBucket(10, 5); }); // 10 max, 5/sec refill

    it('should consume tokens', () => {
        expect(bucket.consume('user1')).toBe(true);
        expect(bucket.remaining('user1')).toBe(9);
    });

    it('should reject when empty', () => {
        bucket.configure('user1', 2, 1); // Only 2 tokens
        bucket.consume('user1');
        bucket.consume('user1');
        expect(bucket.consume('user1')).toBe(false);
    });

    it('should check without consuming', () => {
        expect(bucket.check('user1', 5)).toBe(true);
        expect(bucket.remaining('user1')).toBe(10); // Not consumed
    });

    it('should calculate wait time', () => {
        bucket.configure('user1', 2, 1);
        bucket.consume('user1');
        bucket.consume('user1');
        expect(bucket.waitTime('user1')).toBeGreaterThan(0);
    });

    it('should reset buckets', () => {
        bucket.consume('user1', 5);
        bucket.reset('user1');
        expect(bucket.remaining('user1')).toBe(10);
    });

    it('should get stats', () => {
        bucket.consume('user1', 3);
        const stats = bucket.getStats('user1');
        expect(stats?.consumed).toBe(3);
    });

    it('should remove buckets', () => {
        bucket.consume('user1');
        expect(bucket.remove('user1')).toBe(true);
    });
});
