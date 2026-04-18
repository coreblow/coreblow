/**
 * agents/session-state.ts
 * Agent session state management.
 * Ported from CoreBlow src/agents/session-state.ts.
 */

import type { ContentBlock } from './content-blocks.js';

export type SessionStatus = 'idle' | 'active' | 'thinking' | 'tool_use' | 'paused' | 'terminated';

export interface SessionMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string | ContentBlock[];
    timestamp: number;
    name?: string;
    toolCallId?: string;
    metadata?: Record<string, unknown>;
}

export interface SessionState {
    sessionId: string;
    agentId: string;
    status: SessionStatus;
    createdAt: number;
    lastActivityAt: number;
    turnCount: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCost: number;
    messages: SessionMessage[];
    metadata: Record<string, unknown>;
}

export class AgentSession {
    private state: SessionState;
    private maxHistoryLength: number;

    constructor(sessionId: string, agentId: string, opts?: { maxHistoryLength?: number }) {
        this.maxHistoryLength = opts?.maxHistoryLength ?? 200;
        this.state = {
            sessionId, agentId,
            status: 'idle', createdAt: Date.now(), lastActivityAt: Date.now(),
            turnCount: 0, totalInputTokens: 0, totalOutputTokens: 0, totalCost: 0,
            messages: [], metadata: {},
        };
    }

    addMessage(msg: Omit<SessionMessage, 'timestamp'>): void {
        this.state.messages.push({ ...msg, timestamp: Date.now() });
        this.state.lastActivityAt = Date.now();
        if (msg.role === 'user') this.state.turnCount++;
        if (this.state.messages.length > this.maxHistoryLength) {
            this.state.messages.splice(0, this.state.messages.length - this.maxHistoryLength);
        }
    }

    setStatus(status: SessionStatus): void {
        this.state.status = status;
        this.state.lastActivityAt = Date.now();
    }

    recordUsage(input: number, output: number, cost?: number): void {
        this.state.totalInputTokens += input;
        this.state.totalOutputTokens += output;
        if (cost) this.state.totalCost += cost;
    }

    setMetadata(key: string, value: unknown): void { this.state.metadata[key] = value; }
    getMetadata(key: string): unknown { return this.state.metadata[key]; }

    getMessages(): readonly SessionMessage[] { return this.state.messages; }
    getLastMessages(n: number): SessionMessage[] { return this.state.messages.slice(-n); }
    getState(): Readonly<SessionState> { return { ...this.state }; }

    isActive(): boolean { return this.state.status !== 'idle' && this.state.status !== 'terminated'; }
    isTerminated(): boolean { return this.state.status === 'terminated'; }

    terminate(): void {
        this.state.status = 'terminated';
        this.state.lastActivityAt = Date.now();
    }

    /**
     * Compact older messages to reduce memory.
     */
    compact(keepRecent = 20): number {
        if (this.state.messages.length <= keepRecent) return 0;
        const removed = this.state.messages.length - keepRecent;
        this.state.messages = this.state.messages.slice(-keepRecent);
        return removed;
    }

    formatStatusLine(): string {
        const dur = Date.now() - this.state.createdAt;
        const durStr = dur < 60_000 ? `${Math.floor(dur / 1000)}s` : `${Math.floor(dur / 60_000)}m`;
        return `[${this.state.sessionId}] ${this.state.agentId} — ${this.state.status} — ${this.state.turnCount} turns — ${durStr} — ${this.state.totalInputTokens + this.state.totalOutputTokens} tokens`;
    }
}
