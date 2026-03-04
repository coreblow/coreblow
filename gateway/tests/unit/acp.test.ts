/**
 * tests/unit/acp.test.ts
 * Tests for ACP Protocol implementation
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    AcpServer,
    AcpSessionStore,
    StdioAcpConnection,
    extractTextFromPrompt,
    extractAttachments,
    inferToolKind,
    formatToolTitle,
    ACP_AGENT_INFO,
    PROTOCOL_VERSION,
    type AcpMessage,
    type AcpConnection,
} from '../../src/acp/index.js';

// Mock connection
class MockAcpConnection implements AcpConnection {
    id = 'mock-1';
    messages: AcpMessage[] = [];
    send(msg: AcpMessage): void { this.messages.push(msg); }
    close(): void { }
}

describe('AcpSessionStore', () => {
    let store: AcpSessionStore;

    beforeEach(() => {
        store = new AcpSessionStore({ maxSessions: 10 });
    });

    afterEach(() => {
        store.clear();
    });

    it('should create a session', () => {
        const session = store.create({ sessionKey: 'test:main', cwd: '/tmp' });
        expect(session.sessionId).toBeTruthy();
        expect(session.sessionKey).toBe('test:main');
    });

    it('should get session by ID', () => {
        const session = store.create({ sessionKey: 'key', cwd: '/tmp' });
        expect(store.get(session.sessionId)?.sessionKey).toBe('key');
    });

    it('should return existing session on duplicate create', () => {
        const s1 = store.create({ sessionId: 'fixed-id', sessionKey: 'key1', cwd: '/tmp' });
        const s2 = store.create({ sessionId: 'fixed-id', sessionKey: 'key2', cwd: '/tmp' });
        expect(s1.sessionId).toBe(s2.sessionId);
        expect(s2.sessionKey).toBe('key2'); // Updated
    });

    it('should track session count', () => {
        store.create({ sessionKey: 'a', cwd: '/tmp' });
        store.create({ sessionKey: 'b', cwd: '/tmp' });
        expect(store.size).toBe(2);
    });

    it('should delete sessions', () => {
        const s = store.create({ sessionKey: 'x', cwd: '/tmp' });
        expect(store.remove(s.sessionId)).toBe(true);
        expect(store.has(s.sessionId)).toBe(false);
    });

    it('should set and clear active run', () => {
        const s = store.create({ sessionKey: 'x', cwd: '/tmp' });
        const ac = new AbortController();
        store.setActiveRun(s.sessionId, 'run-1', ac);
        expect(store.getByRunId('run-1')?.sessionId).toBe(s.sessionId);

        store.clearActiveRun(s.sessionId);
        expect(store.getByRunId('run-1')).toBeUndefined();
    });

    it('should cancel active run', () => {
        const s = store.create({ sessionKey: 'x', cwd: '/tmp' });
        const ac = new AbortController();
        store.setActiveRun(s.sessionId, 'run-1', ac);
        expect(store.cancelActiveRun(s.sessionId)).toBe(true);
        expect(ac.signal.aborted).toBe(true);
    });

    it('should list all sessions', () => {
        store.create({ sessionKey: 'a', cwd: '/tmp' });
        store.create({ sessionKey: 'b', cwd: '/tmp' });
        expect(store.list().length).toBe(2);
    });

    it('should enforce max sessions', () => {
        for (let i = 0; i < 10; i++) {
            store.create({ sessionKey: `key-${i}`, cwd: '/tmp' });
        }
        expect(store.size).toBe(10);
        // 11th should evict oldest idle
        store.create({ sessionKey: 'key-11', cwd: '/tmp' });
        expect(store.size).toBe(10); // Oldest evicted
    });
});

describe('AcpServer', () => {
    let server: AcpServer;
    let conn: MockAcpConnection;

    beforeEach(() => {
        server = new AcpServer({ maxSessions: 100 });
        conn = new MockAcpConnection();
    });

    afterEach(() => {
        server.close();
    });

    it('should handle initialize', async () => {
        const resp = await server.handleMessage({
            type: 'initialize',
            id: '1',
            payload: { protocolVersion: PROTOCOL_VERSION },
        }, conn);
        expect(resp?.type).toBe('initialize_response');
        expect((resp?.payload as any).agentInfo.name).toBe('coreblow-acp');
    });

    it('should create new session', async () => {
        const resp = await server.handleMessage({
            type: 'new_session',
            id: '2',
            payload: { cwd: '/test' },
        }, conn);
        expect(resp?.type).toBe('new_session_response');
        expect((resp?.payload as any).sessionId).toBeTruthy();
    });

    it('should list sessions', async () => {
        await server.handleMessage({ type: 'new_session', id: '1', payload: { cwd: '/a' } }, conn);
        await server.handleMessage({ type: 'new_session', id: '2', payload: { cwd: '/b' } }, conn);

        const resp = await server.handleMessage({
            type: 'list_sessions',
            id: '3',
            payload: {},
        }, conn);
        expect(resp?.type).toBe('list_sessions_response');
        expect((resp?.payload as any).count).toBe(2);
    });

    it('should handle prompt (local mode)', async () => {
        const newResp = await server.handleMessage({
            type: 'new_session',
            id: '1',
            payload: { cwd: '/test' },
        }, conn);
        const sessionId = (newResp?.payload as any).sessionId;

        const resp = await server.handleMessage({
            type: 'prompt',
            id: '2',
            sessionId,
            payload: {
                sessionId,
                prompt: [{ type: 'text', text: 'Hello' }],
            },
        }, conn);
        expect(resp?.type).toBe('prompt_response');
        expect((resp?.payload as any).stopReason).toBe('end_turn');
    });

    it('should handle unknown message type', async () => {
        const resp = await server.handleMessage({
            type: 'unknown_type' as any,
            id: '1',
            payload: {},
        }, conn);
        expect(resp?.type).toBe('error');
    });

    it('should report stats', async () => {
        await server.handleMessage({ type: 'new_session', id: '1', payload: { cwd: '/' } }, conn);
        const stats = server.getStats();
        expect(stats.sessions).toBe(1);
    });
});

describe('extractTextFromPrompt', () => {
    it('should extract text blocks', () => {
        const text = extractTextFromPrompt([
            { type: 'text', text: 'Hello' },
            { type: 'text', text: 'World' },
        ]);
        expect(text).toBe('Hello\nWorld');
    });

    it('should handle resource links', () => {
        const text = extractTextFromPrompt([
            { type: 'resource_link', uri: 'file:///test.txt', title: 'Test' },
        ]);
        expect(text).toContain('Resource');
        expect(text).toContain('test.txt');
    });

    it('should enforce max bytes', () => {
        const bigText = 'x'.repeat(3_000_000);
        expect(() => extractTextFromPrompt([{ type: 'text', text: bigText }], 2_000_000))
            .toThrow('exceeds');
    });

    it('should handle empty blocks', () => {
        expect(extractTextFromPrompt([])).toBe('');
    });
});

describe('extractAttachments', () => {
    it('should extract image blocks', () => {
        const attachments = extractAttachments([
            { type: 'image', data: 'base64data', mimeType: 'image/png' },
            { type: 'text', text: 'hi' },
        ]);
        expect(attachments.length).toBe(1);
        expect(attachments[0].mimeType).toBe('image/png');
    });

    it('should skip images without data', () => {
        expect(extractAttachments([{ type: 'image' }]).length).toBe(0);
    });
});

describe('inferToolKind', () => {
    it('should detect read tools', () => expect(inferToolKind('readFile')).toBe('read'));
    it('should detect edit tools', () => expect(inferToolKind('writeFile')).toBe('edit'));
    it('should detect delete tools', () => expect(inferToolKind('deleteEntry')).toBe('delete'));
    it('should detect search tools', () => expect(inferToolKind('grep_search')).toBe('search'));
    it('should detect execute tools', () => expect(inferToolKind('bash')).toBe('execute'));
    it('should detect fetch tools', () => expect(inferToolKind('http_get')).toBe('fetch'));
    it('should default to other', () => expect(inferToolKind('custom')).toBe('other'));
    it('should handle undefined', () => expect(inferToolKind()).toBe('other'));
});

describe('formatToolTitle', () => {
    it('should format with args', () => {
        const title = formatToolTitle('read', { path: '/test.ts' });
        expect(title).toContain('read');
        expect(title).toContain('/test.ts');
    });

    it('should truncate long args', () => {
        const title = formatToolTitle('tool', { content: 'x'.repeat(200) });
        expect(title).toContain('...');
    });

    it('should handle no args', () => {
        expect(formatToolTitle('tool')).toBe('tool');
    });

    it('should default name', () => {
        expect(formatToolTitle(undefined)).toBe('tool');
    });
});

describe('ACP Protocol Constants', () => {
    it('should have correct agent info', () => {
        expect(ACP_AGENT_INFO.name).toBe('coreblow-acp');
        expect(ACP_AGENT_INFO.title).toContain('CoreBlow');
    });

    it('should have protocol version', () => {
        expect(PROTOCOL_VERSION).toBeTruthy();
    });
});
