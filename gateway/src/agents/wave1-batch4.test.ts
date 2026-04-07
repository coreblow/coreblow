/**
 * Tests for OpenAI WebSocket Stream and CLI Credentials
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ─── OpenAI WebSocket Connection Tests ───────────────────────────

import {
    WSConnectionManager,
    createStreamProcessor,
    type WSStreamDelta,
} from './openai-ws-stream.js';

describe('WSConnectionManager', () => {
    it('should initialize in disconnected state', () => {
        const manager = new WSConnectionManager({
            url: 'wss://api.openai.com/v1/realtime',
            apiKey: 'sk-test',
            model: 'gpt-4o-realtime-preview',
        });
        expect(manager.getState()).toBe('disconnected');
        expect(manager.isConnected()).toBe(false);
    });

    it('should track stats', () => {
        const manager = new WSConnectionManager({
            url: 'wss://api.openai.com/v1/realtime',
            apiKey: 'sk-test',
            model: 'gpt-4o-realtime-preview',
        });
        const stats = manager.getStats();
        expect(stats.messagesReceived).toBe(0);
        expect(stats.messagesSent).toBe(0);
    });

    it('should buffer messages when not connected', () => {
        const manager = new WSConnectionManager({
            url: 'wss://api.openai.com/v1/realtime',
            apiKey: 'sk-test',
            model: 'gpt-4o-realtime-preview',
        });
        const sent = manager.send({
            type: 'test',
            data: {},
            timestamp: Date.now(),
        });
        expect(sent).toBe(false); // Buffered, not connected
    });

    it('should emit state changes', () => {
        const manager = new WSConnectionManager({
            url: 'wss://api.openai.com/v1/realtime',
            apiKey: 'sk-test',
            model: 'gpt-4o-realtime-preview',
        });
        const changes: Array<{ from: string; to: string }> = [];
        manager.on('stateChange', (change) => changes.push(change));
        manager.disconnect();
        expect(changes.length).toBeGreaterThan(0);
    });
});

describe('Stream Processor', () => {
    it('should create stream processor', () => {
        const manager = new WSConnectionManager({
            url: 'wss://test.com',
            apiKey: 'sk-test',
            model: 'gpt-4o',
        });
        const processor = createStreamProcessor(manager);
        expect(processor.getAccumulatedText()).toBe('');
    });

    it('should accumulate text from deltas', () => {
        const manager = new WSConnectionManager({
            url: 'wss://test.com',
            apiKey: 'sk-test',
            model: 'gpt-4o',
        });
        const processor = createStreamProcessor(manager);

        // Simulate deltas
        manager.emit('delta', { type: 'text', content: 'Hello ', index: 0, finished: false } satisfies WSStreamDelta);
        manager.emit('delta', { type: 'text', content: 'World', index: 0, finished: false } satisfies WSStreamDelta);
        expect(processor.getAccumulatedText()).toBe('Hello World');
    });

    it('should handle delta callbacks', () => {
        const manager = new WSConnectionManager({
            url: 'wss://test.com',
            apiKey: 'sk-test',
            model: 'gpt-4o',
        });
        const processor = createStreamProcessor(manager);
        const received: WSStreamDelta[] = [];
        processor.onDelta((d) => received.push(d));

        manager.emit('delta', { type: 'text', content: 'Hi', index: 0, finished: false });
        expect(received).toHaveLength(1);
    });

    it('should support destroy cleanup', () => {
        const manager = new WSConnectionManager({
            url: 'wss://test.com',
            apiKey: 'sk-test',
            model: 'gpt-4o',
        });
        const processor = createStreamProcessor(manager);
        processor.destroy();
        // After destroy, deltas should not accumulate
        manager.emit('delta', { type: 'text', content: 'After destroy', index: 0, finished: false });
        expect(processor.getAccumulatedText()).toBe('');
    });
});

// ─── CLI Credentials Tests ──────────────────────────────────────

import {
    setCredential,
    getCredential,
    removeCredential,
    listCredentials,
    clearCredentials,
    validateCredential,
    getStoreDiagnostics,
} from './cli-credentials.js';

describe('CLI Credentials', () => {
    beforeEach(() => clearCredentials(false));

    it('should set and get credentials', () => {
        setCredential('openai', 'sk-test-1234567890abcdef', { save: false });
        const cred = getCredential('openai');
        expect(cred).toBeDefined();
        expect(cred!.key).toBe('sk-test-1234567890abcdef');
    });

    it('should normalize provider names', () => {
        setCredential('  OpenAI  ', 'sk-key-123456', { save: false });
        expect(getCredential('openai')).toBeDefined();
    });

    it('should remove credentials', () => {
        setCredential('openai', 'sk-key-123456', { save: false });
        expect(removeCredential('openai', false)).toBe(true);
        expect(getCredential('openai')).toBeUndefined();
    });

    it('should list credentials with masked keys', () => {
        setCredential('openai', 'sk-1234567890abcdef', { save: false });
        setCredential('anthropic', 'sk-ant-1234567890abcdef', { save: false });
        const list = listCredentials();
        expect(list).toHaveLength(2);
        expect(list[0]!.maskedKey).toContain('...');
    });

    it('should validate credentials', () => {
        expect(validateCredential({
            provider: 'openai',
            key: 'sk-test-1234567890abcdef',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            source: 'interactive',
        }).valid).toBe(true);

        expect(validateCredential({
            provider: '',
            key: '',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            source: 'interactive',
        }).valid).toBe(false);
    });

    it('should provide diagnostics', () => {
        setCredential('openai', 'sk-key-1234567890', { save: false });
        const diag = getStoreDiagnostics();
        expect(diag.totalCredentials).toBe(1);
        expect(diag.providers).toContain('openai');
    });
});
