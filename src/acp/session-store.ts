// @ts-nocheck
/**
 * src/acp/session-store.ts
 * In-memory ACP session store with idle TTL, max sessions, and eviction
 * All code written from scratch, inspired by session management concepts
 */

import { randomUUID } from 'node:crypto';
import { createChildLogger } from '../utils/logger.js';
import type { AcpSession } from './types.js';

const log = createChildLogger('acp:sessions');

export interface SessionStoreConfig {
    maxSessions?: number;
    idleTtlMs?: number;
    now?: () => number;
}

const DEFAULT_MAX_SESSIONS = 5_000;
const DEFAULT_IDLE_TTL_MS = 24 * 60 * 60 * 1_000; // 24h

export class AcpSessionStore {
    private sessions = new Map<string, AcpSession>();
    private runIdToSessionId = new Map<string, string>();
    private maxSessions: number;
    private idleTtlMs: number;
    private now: () => number;

    constructor(config: SessionStoreConfig = {}) {
        this.maxSessions = Math.max(1, config.maxSessions ?? DEFAULT_MAX_SESSIONS);
        this.idleTtlMs = Math.max(1_000, config.idleTtlMs ?? DEFAULT_IDLE_TTL_MS);
        this.now = config.now ?? Date.now;
    }

    create(params: {
        sessionKey: string;
        cwd: string;
        sessionId?: string;
        metadata?: Record<string, unknown>;
    }): AcpSession {
        const nowMs = this.now();
        const sessionId = params.sessionId ?? randomUUID();

        // Return existing session if re-creating with same ID
        const existing = this.sessions.get(sessionId);
        if (existing) {
            existing.sessionKey = params.sessionKey;
            existing.cwd = params.cwd;
            existing.lastTouchedAt = nowMs;
            return existing;
        }

        // Reap idle sessions before checking limit
        this.reapIdle(nowMs);

        // Evict oldest idle if at limit
        if (this.sessions.size >= this.maxSessions) {
            if (!this.evictOldest()) {
                throw new Error(`ACP session limit reached (max ${this.maxSessions})`);
            }
        }

        const session: AcpSession = {
            sessionId,
            sessionKey: params.sessionKey,
            cwd: params.cwd,
            createdAt: nowMs,
            lastTouchedAt: nowMs,
            abortController: null,
            activeRunId: null,
            metadata: params.metadata,
        };

        this.sessions.set(sessionId, session);
        log.debug({ sessionId, sessionKey: params.sessionKey }, 'Session created');
        return session;
    }

    has(sessionId: string): boolean {
        return this.sessions.has(sessionId);
    }

    get(sessionId: string): AcpSession | undefined {
        const session = this.sessions.get(sessionId);
        if (session) session.lastTouchedAt = this.now();
        return session;
    }

    getByRunId(runId: string): AcpSession | undefined {
        const sessionId = this.runIdToSessionId.get(runId);
        return sessionId ? this.get(sessionId) : undefined;
    }

    setActiveRun(sessionId: string, runId: string, abortController: AbortController): void {
        const session = this.sessions.get(sessionId);
        if (!session) return;
        session.activeRunId = runId;
        session.abortController = abortController;
        this.runIdToSessionId.set(runId, sessionId);
        session.lastTouchedAt = this.now();
    }

    clearActiveRun(sessionId: string): void {
        const session = this.sessions.get(sessionId);
        if (!session) return;
        if (session.activeRunId) this.runIdToSessionId.delete(session.activeRunId);
        session.activeRunId = null;
        session.abortController = null;
        session.lastTouchedAt = this.now();
    }

    cancelActiveRun(sessionId: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session?.abortController) return false;
        session.abortController.abort();
        if (session.activeRunId) this.runIdToSessionId.delete(session.activeRunId);
        session.abortController = null;
        session.activeRunId = null;
        session.lastTouchedAt = this.now();
        return true;
    }

    remove(sessionId: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session) return false;
        if (session.activeRunId) this.runIdToSessionId.delete(session.activeRunId);
        session.abortController?.abort();
        this.sessions.delete(sessionId);
        return true;
    }

    list(): AcpSession[] {
        return Array.from(this.sessions.values());
    }

    get size(): number {
        return this.sessions.size;
    }

    clear(): void {
        for (const session of this.sessions.values()) {
            session.abortController?.abort();
        }
        this.sessions.clear();
        this.runIdToSessionId.clear();
    }

    private reapIdle(nowMs: number): void {
        const cutoff = nowMs - this.idleTtlMs;
        for (const [id, session] of this.sessions) {
            if (session.activeRunId || session.abortController) continue;
            if (session.lastTouchedAt > cutoff) continue;
            this.remove(id);
        }
    }

    private evictOldest(): boolean {
        let oldestId: string | null = null;
        let oldestTime = Infinity;

        for (const [id, session] of this.sessions) {
            if (session.activeRunId || session.abortController) continue;
            if (session.lastTouchedAt < oldestTime) {
                oldestTime = session.lastTouchedAt;
                oldestId = id;
            }
        }

        return oldestId ? this.remove(oldestId) : false;
    }
}
