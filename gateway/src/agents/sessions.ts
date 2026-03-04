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

    /**
     * Get message count for a session
     */
    getMessageCount(sessionId: string): number {
        return this.getMessages(sessionId).length;
    }

    /**
     * Compress a session by summarizing old messages
     * Keeps system messages + last `keepRecent` messages, replaces
     * the rest with a single summary message
     */
    compress(sessionId: string, keepRecent = 20): { before: number; after: number } {
        const all = this.getMessages(sessionId);
        if (all.length <= keepRecent + 5) {
            return { before: all.length, after: all.length }; // too short
        }

        const systemMsgs = all.filter(m => m.role === 'system');
        const nonSystem = all.filter(m => m.role !== 'system');
        const toSummarize = nonSystem.slice(0, -(keepRecent));
        const toKeep = nonSystem.slice(-(keepRecent));

        // Build a summary from old messages
        const summaryParts: string[] = [];
        for (const msg of toSummarize) {
            const role = msg.role === 'user' ? 'User' : msg.role === 'assistant' ? 'AI' : msg.role;
            const text = (msg.content || '').substring(0, 200);
            if (text) summaryParts.push(`[${role}]: ${text}`);
        }

        const summaryMsg: ChatMessage = {
            role: 'system',
            content: `[CONVERSATION SUMMARY - ${toSummarize.length} messages compressed]\n${summaryParts.join('\n')}`,
        };

        // Rebuild session file
        const newMessages = [...systemMsgs, summaryMsg, ...toKeep];
        const filePath = this.getFilePath(sessionId);
        const lines = newMessages.map(m => JSON.stringify(m)).join('\n') + '\n';
        fs.writeFileSync(filePath, lines);
        this.cache.set(sessionId, newMessages);

        const result = { before: all.length, after: newMessages.length };
        log.info({ sessionId, ...result }, 'Session compressed');
        return result;
    }

    /**
     * Export a session as JSON (for backup/transfer)
     */
    exportSession(sessionId: string): { sessionId: string; messages: ChatMessage[]; exportedAt: number } {
        return {
            sessionId,
            messages: this.getMessages(sessionId),
            exportedAt: Date.now(),
        };
    }

    private getFilePath(sessionId: string): string {
        // Sanitize session ID for filesystem
        const safe = sessionId.replace(/[^a-zA-Z0-9_:-]/g, '_');
        return path.join(this.sessionsDir, `${safe}.jsonl`);
    }
}
