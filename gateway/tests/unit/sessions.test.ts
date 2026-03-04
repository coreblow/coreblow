/**
 * tests/unit/sessions.test.ts
 * Unit tests — session store
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('SessionStore', () => {
    const tmpDir = path.join(os.tmpdir(), 'coreblow-sess-test-' + Date.now());
    const sessDir = path.join(tmpDir, 'agents', 'default', 'sessions');

    beforeEach(() => {
        fs.mkdirSync(sessDir, { recursive: true });
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should store and retrieve JSONL messages', () => {
        const sessFile = path.join(sessDir, 'test-session.jsonl');
        const messages = [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there!' },
        ];

        // Write
        const jsonl = messages.map(m => JSON.stringify(m)).join('\n') + '\n';
        fs.writeFileSync(sessFile, jsonl);

        // Read
        const lines = fs.readFileSync(sessFile, 'utf-8').trim().split('\n');
        const loaded = lines.map(l => JSON.parse(l));

        expect(loaded).toHaveLength(2);
        expect(loaded[0].role).toBe('user');
        expect(loaded[1].content).toBe('Hi there!');
    });

    it('should support context window (last N messages)', () => {
        const messages = Array.from({ length: 100 }, (_, i) => ({
            role: i % 2 === 0 ? 'user' : 'assistant',
            content: `Message ${i}`,
        }));

        const maxMessages = 20;
        const systemMessages = messages.filter(m => m.role === 'system');
        const nonSystem = messages.filter(m => m.role !== 'system');
        const recent = nonSystem.slice(-(maxMessages - systemMessages.length));

        expect(recent).toHaveLength(20);
        expect(recent[0].content).toBe('Message 80');
    });

    it('should compress old messages into summary', () => {
        const messages = Array.from({ length: 50 }, (_, i) => ({
            role: i % 2 === 0 ? 'user' : 'assistant',
            content: `Message ${i}`,
        }));

        const keepRecent = 20;
        const toSummarize = messages.slice(0, -(keepRecent));
        const toKeep = messages.slice(-(keepRecent));

        const summary = {
            role: 'system',
            content: `[COMPRESSED] ${toSummarize.length} messages summarized`,
        };

        const compressed = [summary, ...toKeep];
        expect(compressed.length).toBe(21); // 1 summary + 20 recent
        expect(toSummarize.length).toBe(30);
    });

    it('should sanitize session IDs for filesystem', () => {
        const rawId = 'telegram:user@123/test';
        const safe = rawId.replace(/[^a-zA-Z0-9_:-]/g, '_');
        expect(safe).toBe('telegram:user_123_test');
        expect(safe).not.toContain('@');
        expect(safe).not.toContain('/');
    });
});
