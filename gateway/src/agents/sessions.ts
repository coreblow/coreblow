/**
 * src/agents/sessions.ts
 * JSONL session store — persistent conversation history
 */

import fs from 'node:fs';
import path from 'node:path';
import type { ChatMessage } from '../providers/interface.js';
import { getHomeDir } from '../gateway/config.js';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('sessions');

export class SessionStore {
    private sessionsDir: string;
    private cache: Map<string, ChatMessage[]> = new Map();

    constructor(agentId = 'default') {
        this.sessionsDir = path.join(getHomeDir(), 'agents', agentId, 'sessions');
        fs.mkdirSync(this.sessionsDir, { recursive: true });
    }

    /**
     * Get all messages in a session
     */
    getMessages(sessionId: string): ChatMessage[] {
        if (this.cache.has(sessionId)) {
            return this.cache.get(sessionId)!;
        }

        const filePath = this.getFilePath(sessionId);
        if (!fs.existsSync(filePath)) {
            this.cache.set(sessionId, []);
            return [];
        }

        try {
            const lines = fs.readFileSync(filePath, 'utf-8').trim().split('\n');
            const messages = lines
                .filter((line) => line.trim())
                .map((line) => JSON.parse(line) as ChatMessage);
            this.cache.set(sessionId, messages);
            return messages;
        } catch (err) {
            log.error({ err, sessionId }, 'Failed to read session');
            return [];
        }
    }

    /**
     * Append a message to a session
     */
    appendMessage(sessionId: string, message: ChatMessage) {
        const filePath = this.getFilePath(sessionId);
        const line = JSON.stringify(message) + '\n';
        fs.appendFileSync(filePath, line);

        // Update cache
        const messages = this.cache.get(sessionId) || [];
        messages.push(message);
        this.cache.set(sessionId, messages);
    }

    /**
     * Append multiple messages
     */
    appendMessages(sessionId: string, messages: ChatMessage[]) {
        for (const msg of messages) {
            this.appendMessage(sessionId, msg);
        }
    }

    /**
     * Get context window (last N messages, keeping system messages)
     */
    getContextWindow(sessionId: string, maxMessages = 50): ChatMessage[] {
        const all = this.getMessages(sessionId);
        if (all.length <= maxMessages) return all;

        const systemMessages = all.filter((m) => m.role === 'system');
        const nonSystem = all.filter((m) => m.role !== 'system');
        const recent = nonSystem.slice(-(maxMessages - systemMessages.length));
        return [...systemMessages, ...recent];
    }

    /**
     * Clear a session
     */
    clearSession(sessionId: string) {
        const filePath = this.getFilePath(sessionId);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        this.cache.delete(sessionId);
        log.info({ sessionId }, 'Session cleared');
    }

    /**
     * List all sessions for this agent
     */
    listSessions(): string[] {
        try {
            return fs
                .readdirSync(this.sessionsDir)
                .filter((f) => f.endsWith('.jsonl'))
                .map((f) => f.replace('.jsonl', ''));
        } catch {
            return [];
        }
    }

    private getFilePath(sessionId: string): string {
        // Sanitize session ID for filesystem
        const safe = sessionId.replace(/[^a-zA-Z0-9_:-]/g, '_');
        return path.join(this.sessionsDir, `${safe}.jsonl`);
    }
}
